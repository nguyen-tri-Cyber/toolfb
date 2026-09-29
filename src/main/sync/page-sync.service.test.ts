import { describe, expect, it } from 'vitest';
import type { SyncCheckpoint } from '@shared/types/ipc';
import { PageSyncService } from './page-sync.service';

describe('PageSyncService', () => {
  it('does not leave a running job when reading the saved checkpoint fails', async () => {
    let jobsStarted = 0;
    const service = new PageSyncService({
      readToken: () => 'user-token',
      findPage: () => ({
        id: 7, facebookPageId: 'page-1', name: 'Page', username: null,
        category: undefined, pictureUrl: undefined, isOwned: true, syncEnabled: false,
        lastSyncedAt: null, createdAt: '', updatedAt: '', imported: true
      }),
      getCheckpoint: () => { throw new Error('database unavailable'); },
      startJob: () => ++jobsStarted
    });

    await expect(service.syncOwnedPage('page-1')).rejects.toThrow('database unavailable');
    await expect(service.syncOwnedPage('page-1')).rejects.toThrow('database unavailable');
    expect(jobsStarted).toBe(0);
  });
  it('cancels a running sync and allows a fresh retry', async () => {
    let releasePosts!: () => void;
    const postsPending = new Promise<void>((resolve) => { releasePosts = resolve; });
    let signalStarted!: () => void;
    const started = new Promise<void>((resolve) => { signalStarted = resolve; });
    const persisted: string[] = [];
    const jobStates: string[] = [];
    let requests = 0;
    const service = new PageSyncService({
      readToken: () => 'user-token',
      findPage: () => ({
        id: 7, facebookPageId: 'page-1', name: 'Page', username: null,
        category: undefined, pictureUrl: undefined, isOwned: true, syncEnabled: false,
        lastSyncedAt: null, createdAt: '', updatedAt: '', imported: true
      }),
      listStoredPosts: () => [],
      client: {
        getPageAccessToken: async () => 'page-token',
        getPagePosts: async () => {
          if (requests++ === 0) {
            signalStarted();
            await postsPending;
          }
          return [{ facebookPostId: 'post-1', message: 'Post', postType: null,
            reactionsCount: 0, commentsCount: 0, sharesCount: 0, rawJson: '{}' }];
        },
        getPostComments: async () => []
      },
      upsertPost: (_pageId, post) => { persisted.push(post.facebookPostId); return 1; },
      startJob: () => 1,
      finishJob: () => jobStates.push('SUCCESS'),
      cancelJob: () => jobStates.push('CANCELLED'),
      failJob: () => jobStates.push('FAILED'),
      markSynced: () => undefined
    });

    const first = service.syncOwnedPage('page-1');
    await started;
    await expect(service.syncOwnedPage('page-1')).rejects.toMatchObject({ code: 'SYNC_IN_PROGRESS' });
    expect(service.cancelSync('page-1')).toBe(true);
    releasePosts();
    await expect(first).rejects.toMatchObject({ code: 'SYNC_CANCELLED' });
    expect(persisted).toEqual([]);
    expect(jobStates).toEqual(['CANCELLED']);

    await expect(service.syncOwnedPage('page-1')).resolves.toMatchObject({ postsProcessed: 1 });
    expect(persisted).toEqual(['post-1']);
    expect(jobStates).toEqual(['CANCELLED', 'SUCCESS']);
  });

  it('syncs a new comment on a stored post outside the incremental post window only once', async () => {
    const comments: string[] = [];
    const syncedPostIds: string[] = [];
    const service = new PageSyncService({
      readToken: () => 'user-token',
      findPage: () => ({
        id: 7, facebookPageId: 'page-1', name: 'Page test', username: null,
        category: undefined, pictureUrl: undefined, isOwned: true, syncEnabled: false,
        lastSyncedAt: '2026-09-27T00:00:00.000Z', createdAt: '', updatedAt: '', imported: true
      }),
      listStoredPosts: () => [
        { id: 10, facebookPostId: 'old-post' },
        { id: 11, facebookPostId: 'recent-post' }
      ],
      client: {
        getPageAccessToken: async () => 'page-token',
        getPagePosts: async () => [{
          facebookPostId: 'recent-post', message: 'Recent', postType: null,
          reactionsCount: 0, commentsCount: 0, sharesCount: 0, rawJson: '{}'
        }],
        getPostComments: async (_token, postId) => {
          syncedPostIds.push(postId);
          return postId === 'old-post' ? [{
            facebookCommentId: 'new-comment', parentCommentId: null,
            authorExternalId: 'buyer', authorName: 'Buyer', message: 'Giá bao nhiêu?',
            createdTime: '2026-09-28T00:00:00Z', likeCount: 0, rawJson: '{}'
          }] : [];
        }
      },
      upsertPost: () => 11,
      upsertComment: (_postId, comment) => {
        comments.push(comment.facebookCommentId);
        return 22;
      },
      upsertLead: () => 1,
      startJob: () => 1,
      finishJob: () => undefined,
      failJob: () => undefined,
      markSynced: () => undefined
    });

    const result = await service.syncOwnedPage('page-1');
    expect(result.commentsProcessed).toBe(1);
    expect(comments).toEqual(['new-comment']);
    expect(syncedPostIds).toEqual(['recent-post', 'old-post']);
  });

  it('retries an interrupted old-post scan without advancing the sync marker or duplicating comments', async () => {
    const persisted = new Set<string>();
    const jobStates: string[] = [];
    let attempts = 0;
    let syncedAt: string | null = null;
    const service = new PageSyncService({
      readToken: () => 'user-token',
      findPage: () => ({
        id: 7, facebookPageId: 'page-1', name: 'Page test', username: null,
        category: undefined, pictureUrl: undefined, isOwned: true, syncEnabled: false,
        lastSyncedAt: syncedAt, createdAt: '', updatedAt: '', imported: true
      }),
      listStoredPosts: () => [
        { id: 10, facebookPostId: 'old-one' },
        { id: 11, facebookPostId: 'old-two' }
      ],
      client: {
        getPageAccessToken: async () => 'page-token',
        getPagePosts: async () => [],
        getPostComments: async (_token, postId) => {
          if (postId === 'old-two' && attempts++ === 0) throw new Error('Network unavailable');
          return [{
            facebookCommentId: `comment-${postId}`, parentCommentId: null,
            authorExternalId: 'buyer', authorName: 'Buyer', message: 'Giá bao nhiêu?',
            createdTime: '2026-09-28T00:00:00Z', likeCount: 0, rawJson: '{}'
          }];
        }
      },
      upsertComment: (_postId, comment) => {
        persisted.add(comment.facebookCommentId);
        return persisted.size;
      },
      upsertLead: () => 1,
      startJob: () => 1,
      finishJob: () => jobStates.push('SUCCESS'),
      failJob: () => jobStates.push('FAILED'),
      markSynced: (_pageId, value) => { syncedAt = value; }
    });

    await expect(service.syncOwnedPage('page-1')).rejects.toThrow('Network unavailable');
    expect(syncedAt).toBeNull();
    expect(jobStates).toEqual(['FAILED']);

    await expect(service.syncOwnedPage('page-1')).resolves.toMatchObject({ commentsProcessed: 2 });
    expect(persisted).toEqual(new Set(['comment-old-one', 'comment-old-two']));
    expect(jobStates).toEqual(['FAILED', 'SUCCESS']);
    expect(syncedAt).not.toBeNull();
  });

  it('syncs owned page posts and comments and reports persisted totals', async () => {
    const storedPosts: string[] = [];
    const storedComments: string[] = [];
    let syncedAt: string | null = null;
    let pageSince: string | undefined;
    const leadCommentIds: number[] = [];
    const finishedJobs: Array<[number, number]> = [];

    const service = new PageSyncService({
      readToken: () => 'user-token',
      listStoredPosts: () => [],
      findPage: () => ({
        id: 7,
        facebookPageId: 'page-1',
        name: 'Page test',
        username: null,
        category: undefined,
        pictureUrl: undefined,
        isOwned: true,
        syncEnabled: false,
        lastSyncedAt: '2026-09-27T00:00:00.000Z',
        createdAt: '2026-09-28 00:00:00',
        updatedAt: '2026-09-28 00:00:00',
        imported: true
      }),
      client: {
        getPageAccessToken: async () => 'page-token',
        getPagePosts: async (_pageToken, _pageId, options) => {
          pageSince = options?.since;
          return [
          {
            facebookPostId: 'post-1',
            message: 'Post 1',
            postType: 'mobile_status_update',
            createdTime: '2026-09-28T00:00:00+0000',
            reactionsCount: 2,
            commentsCount: 1,
            sharesCount: 0,
            rawJson: '{}'
          },
          {
            facebookPostId: 'post-2',
            message: 'Post 2',
            postType: null,
            createdTime: '2026-09-28T01:00:00+0000',
            reactionsCount: 1,
            commentsCount: 1,
            sharesCount: 0,
            rawJson: '{}'
          }
        ];
        },
        getPostComments: async (_pageToken, postId) => [
          {
            facebookCommentId: `comment-${postId}`,
            parentCommentId: null,
            authorExternalId: 'user-1',
            authorName: 'Khách A',
            message: 'Giá bao nhiêu?',
            createdTime: '2026-09-28T02:00:00+0000',
            likeCount: 0,
            rawJson: '{}'
          }
        ]
      },
      upsertPost: (_localPageId, post) => {
        storedPosts.push(post.facebookPostId);
        return storedPosts.length;
      },
      upsertComment: (_localPostId, comment) => {
        storedComments.push(comment.facebookCommentId);
        return storedComments.length;
      },
      upsertLead: (commentId) => {
        leadCommentIds.push(commentId);
        return commentId;
      },
      startJob: () => 99,
      finishJob: (jobId, processed) => {
        finishedJobs.push([jobId, processed]);
      },
      failJob: () => {
        throw new Error('job should not fail');
      },
      markSynced: (_pageId, value) => {
        syncedAt = value;
      }
    });

    const result = await service.syncOwnedPage('page-1');

    expect(result).toMatchObject({
      facebookPageId: 'page-1',
      postsProcessed: 2,
      commentsProcessed: 2,
      leadsDetected: 2,
      jobId: 99
    });
    expect(storedPosts).toEqual(['post-1', 'post-2']);
    expect(storedComments).toEqual(['comment-post-1', 'comment-post-2']);
    expect(leadCommentIds).toEqual([1, 2]);
    expect(pageSince).toBe('1789862400');
    expect(finishedJobs).toEqual([[99, 4]]);
    expect(syncedAt).toBe(result.syncedAt);
  });

  it('records a failed sync job when Meta returns a permission error', async () => {
    let failure: { code: string; message: string } | null = null;
    const service = new PageSyncService({
      readToken: () => 'user-token',
      listStoredPosts: () => [],
      findPage: () => ({
        id: 7,
        facebookPageId: 'page-1',
        name: 'Page test',
        username: null,
        category: undefined,
        pictureUrl: undefined,
        isOwned: true,
        syncEnabled: false,
        lastSyncedAt: null,
        createdAt: '2026-09-28 00:00:00',
        updatedAt: '2026-09-28 00:00:00',
        imported: true
      }),
      client: {
        getPageAccessToken: async () => 'page-token',
        getPagePosts: async () => {
          throw new (await import('../meta/meta.errors')).MetaError(
            'META_PERMISSION_DENIED',
            'Missing permission'
          );
        },
        getPostComments: async () => []
      },
      startJob: () => 77,
      finishJob: () => undefined,
      failJob: (_jobId, code, message) => {
        failure = { code, message };
      }
    });

    await expect(service.syncOwnedPage('page-1')).rejects.toMatchObject({
      code: 'META_PERMISSION_DENIED'
    });
    expect(failure).toEqual({
      code: 'META_PERMISSION_DENIED',
      message: 'Missing permission'
    });
  });

  it('resumes from checkpoint, skips already processed posts, and emits progress events', async () => {
    const progressEvents: string[] = [];
    const commentsFetchedForPosts: string[] = [];
    let savedCheckpoint: SyncCheckpoint | null = {
      facebookPageId: 'page-1',
      stage: 'PROCESSING_POSTS',
      postsProcessed: 1,
      commentsProcessed: 5,
      leadsDetected: 2,
      completedPostIds: ['post-1']
    };
    let checkpointDeleted = false;

    const service = new PageSyncService({
      readToken: () => 'user-token',
      findPage: () => ({
        id: 7,
        facebookPageId: 'page-1',
        name: 'Page test',
        username: null,
        category: undefined,
        pictureUrl: undefined,
        isOwned: true,
        syncEnabled: false,
        lastSyncedAt: null,
        createdAt: '2026-09-28 00:00:00',
        updatedAt: '2026-09-28 00:00:00',
        imported: true
      }),
      listStoredPosts: () => [],
      client: {
        getPageAccessToken: async () => 'page-token',
        getPagePosts: async () => [
          {
            facebookPostId: 'post-1',
            message: 'First post',
            postType: null,
            reactionsCount: 0,
            commentsCount: 0,
            sharesCount: 0,
            rawJson: '{}'
          },
          {
            facebookPostId: 'post-2',
            message: 'Second post',
            postType: null,
            reactionsCount: 0,
            commentsCount: 0,
            sharesCount: 0,
            rawJson: '{}'
          }
        ],
        getPostComments: async (_token, postId) => {
          commentsFetchedForPosts.push(postId);
          return [
            {
              facebookCommentId: `comment-${postId}`,
              parentCommentId: null,
              authorExternalId: 'buyer',
              authorName: 'Buyer',
              message: 'Cần mua',
              createdTime: '2026-09-28T00:00:00Z',
              likeCount: 0,
              rawJson: '{}'
            }
          ];
        }
      },
      upsertPost: () => 1,
      upsertComment: () => 1,
      upsertLead: () => 1,
      detectLead: () => ({ isLead: true, intentLevel: 'HIGH', intentType: 'BUY', score: 90, summary: 'Mua hàng' }),
      startJob: () => 1,
      finishJob: () => undefined,
      failJob: () => undefined,
      markSynced: () => undefined,
      getCheckpoint: () => savedCheckpoint,
      saveCheckpoint: (cp) => {
        savedCheckpoint = cp;
      },
      deleteCheckpoint: () => {
        checkpointDeleted = true;
      }
    });

    const result = await service.syncOwnedPage('page-1', {
      onProgress: (p) => {
        progressEvents.push(p.stage);
      }
    });

    // post-1 was in completedPostIds, so only post-2 was scanned for comments
    expect(commentsFetchedForPosts).toEqual(['post-2']);
    expect(result.postsProcessed).toBe(2);
    expect(result.commentsProcessed).toBe(6); // 5 from checkpoint + 1 new
    expect(result.leadsDetected).toBe(3); // 2 from checkpoint + 1 new
    expect(checkpointDeleted).toBe(true);
    expect(progressEvents).toContain('STARTING');
    expect(progressEvents).toContain('FETCHING_PAGE_TOKEN');
    expect(progressEvents).toContain('FETCHING_POSTS');
    expect(progressEvents).toContain('PROCESSING_POSTS');
    expect(progressEvents).toContain('COMPLETED');
  });
});
