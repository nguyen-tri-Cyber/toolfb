import { describe, expect, it } from 'vitest';
import { MetaGraphApiClient } from './meta.client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('MetaGraphApiClient', () => {
  it('does not fall back to an identity request after Page token lookup is cancelled', async () => {
    const controller = new AbortController();
    let calls = 0;
    const fetchFn: typeof fetch = async () => {
      calls += 1;
      controller.abort();
      throw new DOMException('Aborted', 'AbortError');
    };
    const client = new MetaGraphApiClient({ fetchFn, maxRetries: 0 });

    await expect(client.getPageAccessToken('user-token', 'page-1', { signal: controller.signal }))
      .rejects.toMatchObject({ code: 'SYNC_CANCELLED' });
    expect(calls).toBe(1);
  });
  it('stops an in-flight Graph request when sync is cancelled', async () => {
    let started!: () => void;
    const requestStarted = new Promise<void>((resolve) => { started = resolve; });
    const fetchFn: typeof fetch = async (_input, init) => {
      started();
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
    };
    const client = new MetaGraphApiClient({ fetchFn, timeoutMs: 25, maxRetries: 0 });
    const controller = new AbortController();
    const pending = client.getPostComments('token', 'post-1', { signal: controller.signal });
    await requestStarted;
    controller.abort();

    await expect(pending).rejects.toMatchObject({ code: 'SYNC_CANCELLED' });
  });

  it('reports incomplete pagination when the configured page limit is reached', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      return jsonResponse({
        data: [{ id: url.pathname.endsWith('/posts') ? 'post-1' : 'comment-1' }],
        paging: { cursors: { after: 'more' } }
      });
    };
    const client = new MetaGraphApiClient({ fetchFn });

    await expect(client.getPagePosts('token', 'page-1', { maxPages: 1 })).rejects.toMatchObject({ code: 'META_PAGINATION_LIMIT' });
    await expect(client.getPostComments('token', 'post-1', { maxPages: 1 })).rejects.toMatchObject({ code: 'META_PAGINATION_LIMIT' });
  });

  it('retrieves a Page access token without exposing it through page summaries', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      expect(url.pathname).toContain('/me/accounts');
      expect(url.searchParams.get('fields')).toContain('access_token');

      return jsonResponse({
        data: [
          {
            id: 'page-1',
            name: 'Page test',
            access_token: 'page-token'
          }
        ]
      });
    };

    const client = new MetaGraphApiClient({ fetchFn });
    await expect(client.getPageAccessToken('user-token', 'page-1')).resolves.toBe('page-token');
  });

  it('normalizes posts and comments returned by Graph API', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));

      if (url.pathname.endsWith('/page-1/posts')) {
        return jsonResponse({
          data: [
            {
              id: 'post-1',
              message: 'Xin chào',
              status_type: 'mobile_status_update',
              created_time: '2026-09-28T00:00:00+0000',
              permalink_url: 'https://facebook.com/page-1/posts/1',
              reactions: { summary: { total_count: 5 } },
              comments: { summary: { total_count: 1 } },
              shares: { count: 2 }
            }
          ]
        });
      }

      return jsonResponse({
        data: [
          {
            id: 'comment-1',
            message: 'Còn hàng không?',
            created_time: '2026-09-28T00:10:00+0000',
            from: { id: 'user-1', name: 'Khách A' },
            like_count: 1
          }
        ]
      });
    };

    const client = new MetaGraphApiClient({ fetchFn });

    await expect(client.getPagePosts('page-token', 'page-1')).resolves.toEqual([
      expect.objectContaining({
        facebookPostId: 'post-1',
        reactionsCount: 5,
        commentsCount: 1,
        sharesCount: 2
      })
    ]);
    await expect(client.getPostComments('page-token', 'post-1')).resolves.toEqual([
      expect.objectContaining({
        facebookCommentId: 'comment-1',
        authorName: 'Khách A',
        message: 'Còn hàng không?'
      })
    ]);
  });

  it('follows Graph pagination cursors for posts and comments', async () => {
    const requestedAfter: Array<string | null> = [];
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      const after = url.searchParams.get('after');
      requestedAfter.push(after);

      if (url.pathname.endsWith('/page-1/posts')) {
        if (!after) {
          return jsonResponse({
            data: [{ id: 'post-1', message: 'Post 1' }],
            paging: { cursors: { after: 'posts-next' } }
          });
        }
        return jsonResponse({ data: [{ id: 'post-2', message: 'Post 2' }] });
      }

      if (!after) {
        return jsonResponse({
          data: [{ id: 'comment-1', message: 'Giá?' }],
          paging: { cursors: { after: 'comments-next' } }
        });
      }
      return jsonResponse({ data: [{ id: 'comment-2', message: 'Còn hàng?' }] });
    };

    const client = new MetaGraphApiClient({ fetchFn, retryDelayMs: 0 });
    await expect(client.getPagePosts('page-token', 'page-1')).resolves.toHaveLength(2);
    await expect(client.getPostComments('page-token', 'post-1')).resolves.toHaveLength(2);
    expect(requestedAfter).toEqual([null, 'posts-next', null, 'comments-next']);
  });

  it('retries a rate-limited request a bounded number of times', async () => {
    let calls = 0;
    const fetchFn: typeof fetch = async () => {
      calls += 1;
      if (calls === 1) {
        return jsonResponse({ error: { code: 4, message: 'Rate limited' } }, 429);
      }
      return jsonResponse({ data: [] });
    };

    const client = new MetaGraphApiClient({ fetchFn, retryDelayMs: 0, maxRetries: 2 });
    await expect(client.getPagePosts('page-token', 'page-1')).resolves.toEqual([]);
    expect(calls).toBe(2);
  });
});
