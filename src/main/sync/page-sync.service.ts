import type { FacebookPageRecord } from '@shared/types/ipc';
import {
  findFacebookPageByFacebookId,
  markFacebookPageSynced
} from '../database/pages.repository';
import {
  upsertFacebookComment,
  upsertFacebookPost
} from '../database/content.repository';
import { upsertLeadFromComment } from '../database/leads.repository';
import {
  failSyncJob,
  finishSyncJob,
  startSyncJob
} from '../database/sync-jobs.repository';
import { detectLeadIntent, type LeadDetectionResult } from '../leads/lead-detector';
import { MetaError } from '../meta/meta.errors';
import { MetaGraphApiClient } from '../meta/meta.client';
import type { FacebookCommentDetails, FacebookPostDetails } from '../meta/meta.types';
import { readDevelopmentToken } from '../meta/token.service';

export interface PageSyncResult {
  facebookPageId: string;
  postsProcessed: number;
  commentsProcessed: number;
  leadsDetected: number;
  jobId: number;
  syncedAt: string;
}

export interface PageSyncDependencies {
  readToken?: () => string | null;
  findPage?: (facebookPageId: string) => FacebookPageRecord | null;
  upsertPost?: (localPageId: number, post: FacebookPostDetails) => number;
  upsertComment?: (localPostId: number, comment: FacebookCommentDetails) => number;
  upsertLead?: (localCommentId: number, classification: LeadDetectionResult) => number;
  detectLead?: (message: string) => LeadDetectionResult;
  markSynced?: (facebookPageId: string, syncedAt: string) => void;
  startJob?: (jobType: string, pageId: number) => number;
  finishJob?: (jobId: number, processedItems: number) => void;
  failJob?: (jobId: number, errorCode: string, errorMessage: string, failedItems?: number) => void;
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
  private readonly detectLead: (message: string) => LeadDetectionResult;
  private readonly markSynced: (facebookPageId: string, syncedAt: string) => void;
  private readonly startJob: (jobType: string, pageId: number) => number;
  private readonly finishJob: (jobId: number, processedItems: number) => void;
  private readonly failJob: (
    jobId: number,
    errorCode: string,
    errorMessage: string,
    failedItems?: number
  ) => void;
  private readonly client: Pick<
    MetaGraphApiClient,
    'getPageAccessToken' | 'getPagePosts' | 'getPostComments'
  >;

  constructor(dependencies: PageSyncDependencies = {}) {
    this.readToken = dependencies.readToken ?? readDevelopmentToken;
    this.findPage = dependencies.findPage ?? findFacebookPageByFacebookId;
    this.upsertPost = dependencies.upsertPost ?? upsertFacebookPost;
    this.upsertComment = dependencies.upsertComment ?? upsertFacebookComment;
    this.upsertLead = dependencies.upsertLead ?? upsertLeadFromComment;
    this.detectLead = dependencies.detectLead ?? detectLeadIntent;
    this.markSynced = dependencies.markSynced ?? markFacebookPageSynced;
    this.startJob = dependencies.startJob ?? startSyncJob;
    this.finishJob = dependencies.finishJob ?? finishSyncJob;
    this.failJob = dependencies.failJob ?? failSyncJob;
    this.client = dependencies.client ?? new MetaGraphApiClient();
  }

  async syncOwnedPage(facebookPageId: string): Promise<PageSyncResult> {
    const userToken = this.readToken();
    if (!userToken) {
      throw new MetaError('META_TOKEN_MISSING', 'Development token is missing.');
    }

    const page = this.findPage(facebookPageId);
    if (!page || !page.isOwned) {
      throw new MetaError('META_PERMISSION_DENIED', 'Owned Page has not been imported.');
    }

    const jobId = this.startJob('OWNED_PAGE_SYNC', page.id);
    let postsProcessed = 0;
    let commentsProcessed = 0;
    let leadsDetected = 0;

    try {
      const pageToken = await this.client.getPageAccessToken(userToken, facebookPageId);
      const since = toIncrementalSince(page.lastSyncedAt);
      const posts = await this.client.getPagePosts(pageToken, facebookPageId, {
        ...(since ? { since } : {})
      });
      postsProcessed = posts.length;

      for (const post of posts) {
        const localPostId = this.upsertPost(page.id, post);
        const comments = await this.client.getPostComments(pageToken, post.facebookPostId);

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
      }

      const syncedAt = new Date().toISOString();
      this.markSynced(facebookPageId, syncedAt);
      this.finishJob(jobId, postsProcessed + commentsProcessed);

      return {
        facebookPageId,
        postsProcessed,
        commentsProcessed,
        leadsDetected,
        jobId,
        syncedAt
      };
    } catch (error) {
      const code = error instanceof MetaError ? error.code : 'SYNC_FAILED';
      const message = error instanceof Error ? error.message : 'Unexpected synchronization failure.';
      this.failJob(jobId, code, message, commentsProcessed);
      throw error;
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
