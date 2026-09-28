import { describe, expect, it } from 'vitest';
import { PageSyncService } from './page-sync.service';

describe('PageSyncService', () => {
  it('syncs owned page posts and comments and reports persisted totals', async () => {
    const storedPosts: string[] = [];
    const storedComments: string[] = [];
    let syncedAt: string | null = null;
    let pageSince: string | undefined;
    const leadCommentIds: number[] = [];
    const finishedJobs: Array<[number, number]> = [];

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
});
