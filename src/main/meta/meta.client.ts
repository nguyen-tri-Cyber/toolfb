import { z } from 'zod';
import { META_GRAPH_API_VERSION, META_GRAPH_BASE_URL } from '@shared/constants/meta';
import { MetaError, normalizeGraphError, toMetaError } from './meta.errors';
import {
  graphAccessiblePagesResponseSchema,
  graphCommentsResponseSchema,
  graphErrorResponseSchema,
  graphPageAccessTokensResponseSchema,
  graphPageDetailsResponseSchema,
  graphPostsResponseSchema,
  normalizeAccessiblePagesResponse,
  normalizeGraphComment,
  normalizeGraphPage,
  normalizeGraphPost,
  type FacebookCommentDetails,
  type FacebookPostDetails,
  type FacebookPageDetails
} from './meta.types';
import type { FacebookPageSummary } from '@shared/types/ipc';

const DEFAULT_TIMEOUT_MS = 15000;
const ACCESSIBLE_PAGE_FIELDS = 'id,name,category,picture.type(normal){url}';
const PAGE_DETAIL_FIELDS = 'id,name,username,category,picture.type(normal){url}';
const PAGE_ACCESS_TOKEN_FIELDS = 'id,access_token';
const PAGE_POST_FIELDS =
  'id,message,status_type,permalink_url,created_time,reactions.limit(0).summary(true),comments.limit(0).summary(true),shares';
const POST_COMMENT_FIELDS = 'id,message,created_time,from,like_count,parent';

export interface MetaGraphApiClientOptions {
  version?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  maxRetries?: number;
  retryDelayMs?: number;
}

export class MetaGraphApiClient {
  private readonly version: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(options: MetaGraphApiClientOptions = {}) {
    this.version = options.version ?? process.env.META_GRAPH_API_VERSION ?? META_GRAPH_API_VERSION;
    this.baseUrl = options.baseUrl ?? META_GRAPH_BASE_URL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = options.fetchFn ?? fetch;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 300;
  }

  async getAccessiblePages(
    token: string,
    importedPageIds: Set<string> = new Set()
  ): Promise<FacebookPageSummary[]> {
    const response = await this.request('/me/accounts', token, { fields: ACCESSIBLE_PAGE_FIELDS }, graphAccessiblePagesResponseSchema);
    return normalizeAccessiblePagesResponse(response, importedPageIds);
  }

  async getPageDetails(token: string, pageId: string): Promise<FacebookPageDetails> {
    const response = await this.request(`/${pageId}`, token, { fields: PAGE_DETAIL_FIELDS }, graphPageDetailsResponseSchema);
    return normalizeGraphPage(response);
  }

  async getPageAccessToken(userToken: string, pageId: string): Promise<string> {
    const response = await this.request(
      '/me/accounts',
      userToken,
      { fields: PAGE_ACCESS_TOKEN_FIELDS },
      graphPageAccessTokensResponseSchema
    );
    const page = response.data.find((item) => item.id === pageId);

    if (!page?.access_token) {
      throw new MetaError('META_PERMISSION_DENIED', 'Page access token is unavailable.');
    }

    return page.access_token;
  }

  async getPagePosts(
    pageToken: string,
    pageId: string,
    options: { since?: string; maxPages?: number } = {}
  ): Promise<FacebookPostDetails[]> {
    const posts: FacebookPostDetails[] = [];
    const seenCursors = new Set<string>();
    const maxPages = options.maxPages ?? 20;
    let after: string | undefined;

    for (let page = 0; page < maxPages; page += 1) {
      const response = await this.request(
        `/${pageId}/posts`,
        pageToken,
        {
          fields: PAGE_POST_FIELDS,
          limit: '100',
          ...(options.since ? { since: options.since } : {}),
          ...(after ? { after } : {})
        },
        graphPostsResponseSchema
      );
      posts.push(...response.data.map(normalizeGraphPost));

      const next = response.paging?.cursors?.after;
      if (!next || seenCursors.has(next)) break;
      seenCursors.add(next);
      after = next;
    }

    return posts;
  }

  async getPostComments(
    pageToken: string,
    postId: string,
    options: { maxPages?: number } = {}
  ): Promise<FacebookCommentDetails[]> {
    const comments: FacebookCommentDetails[] = [];
    const seenCursors = new Set<string>();
    const maxPages = options.maxPages ?? 50;
    let after: string | undefined;

    for (let page = 0; page < maxPages; page += 1) {
      const response = await this.request(
        `/${postId}/comments`,
        pageToken,
        {
          fields: POST_COMMENT_FIELDS,
          limit: '100',
          ...(after ? { after } : {})
        },
        graphCommentsResponseSchema
      );
      comments.push(...response.data.map(normalizeGraphComment));

      const next = response.paging?.cursors?.after;
      if (!next || seenCursors.has(next)) break;
      seenCursors.add(next);
      after = next;
    }

    return comments;
  }

  buildUrl(path: string, query: Record<string, string>): URL {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}/${this.version}${cleanPath}`);

    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    return url;
  }

  private async request<T>(
    path: string,
    token: string,
    query: Record<string, string>,
    schema: z.ZodType<T>
  ): Promise<T> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const url = this.buildUrl(path, { ...query, access_token: token });
        const response = await this.fetchFn(url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            Accept: 'application/json'
          }
        });

        const body = await response.json();

        if (!response.ok) {
          const graphError = graphErrorResponseSchema.safeParse(body);
          const code = normalizeGraphError(
            response.status,
            graphError.success ? graphError.data.error.code : undefined
          );
          const retryable = code === 'META_RATE_LIMITED' || response.status >= 500;
          if (retryable && attempt < this.maxRetries) {
            await this.waitBeforeRetry(attempt);
            continue;
          }
          throw new MetaError(code, 'Meta Graph API returned an error.');
        }

        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          throw new MetaError('META_VALIDATION_ERROR', 'Unexpected Meta response shape.');
        }

        return parsed.data;
      } catch (error) {
        const metaError = toMetaError(error);
        if (metaError.code === 'META_NETWORK_ERROR' && attempt < this.maxRetries) {
          await this.waitBeforeRetry(attempt);
          continue;
        }
        throw metaError;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new MetaError('META_API_ERROR', 'Meta request failed after retries.');
  }

  private async waitBeforeRetry(attempt: number): Promise<void> {
    const delay = this.retryDelayMs * 2 ** attempt;
    if (delay <= 0) return;
    await new Promise<void>((resolve) => setTimeout(resolve, delay));
  }
}
