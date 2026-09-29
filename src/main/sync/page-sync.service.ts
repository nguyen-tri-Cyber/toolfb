import type { FacebookPageRecord } from '@shared/types/ipc';
import {
  findFacebookPageByFacebookId,
  markFacebookPageSynced
} from '../database/pages.repository';
import {
  listStoredPostsForPage,
  type StoredPostReference,
  upsertFacebookComment,
  upsertFacebookPost
} from '../database/content.repository';
import { upsertLeadFromComment } from '../database/leads.repository';
import {
  cancelSyncJob,
  failSyncJob,
  finishSyncJob,
  startSyncJob
} from '../database/sync-jobs.repository';
import {
  deleteSyncCheckpoint,
  getSyncCheckpoint,
  saveSyncCheckpoint,
  type SyncCheckpointData
} from '../database/sync-checkpoints.repository';
import { detectLeadIntent, type LeadDetectionResult } from '../leads/lead-detector';
import { MetaError } from '../meta/meta.errors';
import { MetaGraphApiClient } from '../meta/meta.client';
import type { FacebookCommentDetails, FacebookPostDetails } from '../meta/meta.types';
import { readAccessToken } from '../meta/token.service';

export interface PageSyncResult {
  facebookPageId: string;
  postsProcessed: number;
  commentsProcessed: number;
  leadsDetected: number;
  jobId: number;
  syncedAt: string;
}

export interface SyncProgressEvent {
  facebookPageId: string;
  stage:
    | 'STARTING'
    | 'FETCHING_PAGE_TOKEN'
    | 'FETCHING_POSTS'
    | 'PROCESSING_POSTS'
    | 'CHECKING_STORED_POSTS'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'FAILED';
  message: string;
  postsProcessed: number;
  commentsProcessed: number;
  leadsDetected: number;
  currentPostIndex?: number;
  totalPosts?: number;
}

export interface SyncOptions {
  resume?: boolean;
  onProgress?: (progress: SyncProgressEvent) => void;
}

export interface PageSyncDependencies {
  readToken?: () => string | null;
  findPage?: (facebookPageId: string) => FacebookPageRecord | null;
  upsertPost?: (localPageId: number, post: FacebookPostDetails) => number;
  upsertComment?: (localPostId: number, comment: FacebookCommentDetails) => number;
  upsertLead?: (localCommentId: number, classification: LeadDetectionResult) => number;
  listStoredPosts?: (localPageId: number) => StoredPostReference[];
  detectLead?: (message: string) => LeadDetectionResult;
  markSynced?: (facebookPageId: string, syncedAt: string) => void;
  startJob?: (jobType: string, pageId: number) => number;
  finishJob?: (jobId: number, processedItems: number) => void;
  cancelJob?: (jobId: number, processedItems: number) => void;
  failJob?: (jobId: number, errorCode: string, errorMessage: string, failedItems?: number) => void;
  getCheckpoint?: (facebookPageId: string) => SyncCheckpointData | null;
  saveCheckpoint?: (checkpoint: SyncCheckpointData) => void;
  deleteCheckpoint?: (facebookPageId: string) => void;
  client?: Pick<
    MetaGraphApiClient,
    'getPageAccessToken' | 'getPagePosts' | 'getPostComments'
  >;
}

export class PageSyncService {
  private readonly readToken: () => string | null;
  private readonly findPage: (facebookPageId: string) => FacebookPageRecord | null;
  private readonly upsertPost: (localPageId: number, post: FacebookPostDetails) => number;
  private readonly upsertComment: (localPostId: number, comment: FacebookCommentDetails) => number;
  private readonly upsertLead: (localCommentId: number, classification: LeadDetectionResult) => number;
  private readonly listStoredPosts: (localPageId: number) => StoredPostReference[];
  private readonly detectLead: (message: string) => LeadDetectionResult;
  private readonly markSynced: (facebookPageId: string, syncedAt: string) => void;
  private readonly startJob: (jobType: string, pageId: number) => number;
  private readonly finishJob: (jobId: number, processedItems: number) => void;
  private readonly cancelJob: (jobId: number, processedItems: number) => void;
  private readonly failJob: (
    jobId: number,
    errorCode: string,
    errorMessage: string,
    failedItems?: number
  ) => void;
  private readonly getCheckpoint: (facebookPageId: string) => SyncCheckpointData | null;
  private readonly saveCheckpoint: (checkpoint: SyncCheckpointData) => void;
  private readonly deleteCheckpoint: (facebookPageId: string) => void;
  private readonly client: Pick<
    MetaGraphApiClient,
    'getPageAccessToken' | 'getPagePosts' | 'getPostComments'
  >;
  private readonly activeSyncs = new Map<string, AbortController>();

  constructor(dependencies: PageSyncDependencies = {}) {
    this.readToken = dependencies.readToken ?? readAccessToken;
    this.findPage = dependencies.findPage ?? findFacebookPageByFacebookId;
    this.upsertPost = dependencies.upsertPost ?? upsertFacebookPost;
    this.upsertComment = dependencies.upsertComment ?? upsertFacebookComment;
    this.upsertLead = dependencies.upsertLead ?? upsertLeadFromComment;
    this.listStoredPosts = dependencies.listStoredPosts ?? listStoredPostsForPage;
    this.detectLead = dependencies.detectLead ?? detectLeadIntent;
    this.markSynced = dependencies.markSynced ?? markFacebookPageSynced;
    this.startJob = dependencies.startJob ?? startSyncJob;
    this.finishJob = dependencies.finishJob ?? finishSyncJob;
    this.cancelJob = dependencies.cancelJob ?? cancelSyncJob;
    this.failJob = dependencies.failJob ?? failSyncJob;
    this.getCheckpoint = dependencies.getCheckpoint ?? getSyncCheckpoint;
    this.saveCheckpoint = dependencies.saveCheckpoint ?? saveSyncCheckpoint;
    this.deleteCheckpoint = dependencies.deleteCheckpoint ?? deleteSyncCheckpoint;
    this.client = dependencies.client ?? new MetaGraphApiClient();
  }

  cancelSync(facebookPageId: string): boolean {
    const active = this.activeSyncs.get(facebookPageId);
    if (!active) return false;
    active.abort();
    return true;
  }

  getSavedCheckpoint(facebookPageId: string): SyncCheckpointData | null {
    return this.getCheckpoint(facebookPageId);
  }

  discardCheckpoint(facebookPageId: string): void {
    this.deleteCheckpoint(facebookPageId);
  }

  async syncOwnedPage(facebookPageId: string, options: SyncOptions = {}): Promise<PageSyncResult> {
    if (this.activeSyncs.has(facebookPageId)) {
      throw new MetaError('SYNC_IN_PROGRESS', 'Page synchronization is already in progress.');
    }
    const userToken = this.readToken();
    if (!userToken) {
      throw new MetaError('META_TOKEN_MISSING', 'Meta connection is missing.');
    }

    const page = this.findPage(facebookPageId);
    if (!page || !page.isOwned) {
      throw new MetaError('META_PERMISSION_DENIED', 'Owned Page has not been imported.');
    }

    const checkpoint = options.resume !== false ? this.getCheckpoint(facebookPageId) : null;
    const active = new AbortController();
    const jobId = this.startJob('OWNED_PAGE_SYNC', page.id);
    this.activeSyncs.set(facebookPageId, active);
    let postsProcessed = checkpoint?.postsProcessed ?? 0;
    let commentsProcessed = checkpoint?.commentsProcessed ?? 0;
    let leadsDetected = checkpoint?.leadsDetected ?? 0;
    const completedPostIds = new Set<string>(checkpoint?.completedPostIds ?? []);

    const reportProgress = (
      stage: SyncProgressEvent['stage'],
      message: string,
      currentPostIndex?: number,
      totalPosts?: number
    ): void => {
      options.onProgress?.({
        facebookPageId,
        stage,
        message,
        postsProcessed,
        commentsProcessed,
        leadsDetected,
        currentPostIndex,
        totalPosts
      });
    };

    const since = checkpoint?.since ?? toIncrementalSince(page.lastSyncedAt);

    try {
      const checkCancelled = (): void => {
        if (active.signal.aborted) throw new MetaError('SYNC_CANCELLED', 'Page synchronization cancelled.');
      };

      reportProgress(
        'STARTING',
        checkpoint
          ? `Tiếp tục đồng bộ từ checkpoint (${completedPostIds.size} bài viết đã lưu)...`
          : 'Bắt đầu quá trình đồng bộ...'
      );

      reportProgress('FETCHING_PAGE_TOKEN', 'Đang xác thực Page Access Token từ Meta...');
      const pageToken = await this.client.getPageAccessToken(userToken, facebookPageId, { signal: active.signal });
      checkCancelled();

      reportProgress('FETCHING_POSTS', 'Đang tải danh sách bài viết từ Trang...');
      const posts = await this.client.getPagePosts(pageToken, facebookPageId, {
        ...(since ? { since } : {}),
        signal: active.signal
      });
      checkCancelled();
      postsProcessed = Math.max(postsProcessed, posts.length);

      const refreshedPostIds = new Set<string>();

      for (let i = 0; i < posts.length; i += 1) {
        checkCancelled();
        const post = posts[i];
        refreshedPostIds.add(post.facebookPostId);

        if (completedPostIds.has(post.facebookPostId)) {
          continue;
        }

        reportProgress(
          'PROCESSING_POSTS',
          `Đang quét bình luận bài viết ${i + 1}/${posts.length}...`,
          i + 1,
          posts.length
        );

        const localPostId = this.upsertPost(page.id, post);
        const comments = await this.client.getPostComments(pageToken, post.facebookPostId, { signal: active.signal });
        checkCancelled();

        for (const comment of comments) {
          const localCommentId = this.upsertComment(localPostId, comment);
          commentsProcessed += 1;

          if (comment.authorExternalId === facebookPageId) {
            continue;
          }

          const classification = this.detectLead(comment.message ?? '');
          if (classification.isLead) {
            this.upsertLead(localCommentId, classification);
            leadsDetected += 1;
          }
        }

        completedPostIds.add(post.facebookPostId);
        this.saveCheckpoint({
          facebookPageId,
          stage: 'PROCESSING_POSTS',
          postsProcessed,
          commentsProcessed,
          leadsDetected,
          completedPostIds: Array.from(completedPostIds),
          since
        });
      }

      // Check stored posts outside the incremental window to catch new comments on older posts
      reportProgress('CHECKING_STORED_POSTS', 'Đang quét bình luận mới trên các bài viết cũ...');
      const storedPosts = this.listStoredPosts(page.id);
      for (const storedPost of storedPosts) {
        checkCancelled();
        if (refreshedPostIds.has(storedPost.facebookPostId)) continue;
        if (completedPostIds.has(storedPost.facebookPostId)) continue;

        const comments = await this.client.getPostComments(pageToken, storedPost.facebookPostId, { signal: active.signal });
        checkCancelled();

        for (const comment of comments) {
          const localCommentId = this.upsertComment(storedPost.id, comment);
          commentsProcessed += 1;
          if (comment.authorExternalId === facebookPageId) continue;
          const classification = this.detectLead(comment.message ?? '');
          if (classification.isLead) {
            this.upsertLead(localCommentId, classification);
            leadsDetected += 1;
          }
        }

        completedPostIds.add(storedPost.facebookPostId);
        this.saveCheckpoint({
          facebookPageId,
          stage: 'CHECKING_STORED_POSTS',
          postsProcessed,
          commentsProcessed,
          leadsDetected,
          completedPostIds: Array.from(completedPostIds),
          since
        });
      }

      checkCancelled();
      const syncedAt = new Date().toISOString();
      this.markSynced(facebookPageId, syncedAt);
      this.deleteCheckpoint(facebookPageId);
      this.finishJob(jobId, postsProcessed + commentsProcessed);

      reportProgress(
        'COMPLETED',
        `Đồng bộ hoàn tất: ${postsProcessed} bài viết, ${commentsProcessed} bình luận, ${leadsDetected} lead.`
      );

      return {
        facebookPageId,
        postsProcessed,
        commentsProcessed,
        leadsDetected,
        jobId,
        syncedAt
      };
    } catch (error) {
      if (active.signal.aborted || (error instanceof MetaError && error.code === 'SYNC_CANCELLED')) {
        this.saveCheckpoint({
          facebookPageId,
          stage: 'CANCELLED',
          postsProcessed,
          commentsProcessed,
          leadsDetected,
          completedPostIds: Array.from(completedPostIds),
          since,
          lastError: 'CANCELLED'
        });
        this.cancelJob(jobId, postsProcessed + commentsProcessed);
        reportProgress('CANCELLED', 'Đã hủy đồng bộ. Tiến độ đã được lưu lại để có thể tiếp tục sau.');
        throw new MetaError('SYNC_CANCELLED', 'Page synchronization cancelled.');
      }

      const code = error instanceof MetaError ? error.code : 'SYNC_FAILED';
      const message = error instanceof Error ? error.message : 'Unexpected synchronization failure.';

      this.saveCheckpoint({
        facebookPageId,
        stage: 'FAILED',
        postsProcessed,
        commentsProcessed,
        leadsDetected,
        completedPostIds: Array.from(completedPostIds),
        since,
        lastError: message
      });

      this.failJob(jobId, code, message, commentsProcessed);
      reportProgress('FAILED', `Đồng bộ thất bại: ${message}. Tiến độ đã được lưu lại.`);
      throw error;
    } finally {
      this.activeSyncs.delete(facebookPageId);
    }
  }
}

export const pageSyncService = new PageSyncService();

const INCREMENTAL_OVERLAP_MS = 7 * 24 * 60 * 60 * 1000;

function toIncrementalSince(lastSyncedAt: string | null): string | undefined {
  if (!lastSyncedAt) return undefined;
  const timestamp = Date.parse(lastSyncedAt);
  if (Number.isNaN(timestamp)) return undefined;
  return Math.floor(Math.max(0, timestamp - INCREMENTAL_OVERLAP_MS) / 1000).toString();
}
