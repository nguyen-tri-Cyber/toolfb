import type Database from 'better-sqlite3';
import { getDatabase } from './index';

export interface ContentListQuery {
  pageId?: number;
  search?: string;
  limit: number;
  offset: number;
}

export interface CommentListQuery extends ContentListQuery {
  onlyLeads?: boolean;
}

export interface PostListItem {
  id: number;
  pageId: number;
  pageName: string;
  facebookPostId: string;
  message: string | null;
  permalinkUrl: string | null;
  createdTime: string | null;
  reactionsCount: number;
  commentsCount: number;
  sharesCount: number;
}

export interface CommentListItem {
  id: number;
  pageId: number;
  pageName: string;
  postId: number;
  facebookPostId: string;
  postPermalinkUrl: string | null;
  facebookCommentId: string;
  authorName: string | null;
  message: string | null;
  createdTime: string | null;
  likeCount: number;
  leadId: number | null;
  leadStatus: string | null;
  leadScore: number | null;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

function buildContentFilters(
  query: ContentListQuery,
  searchColumns: string[]
): { where: string; params: Array<string | number> } {
  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (query.pageId) {
    clauses.push('pg.id = ?');
    params.push(query.pageId);
  }

  if (query.search?.trim()) {
    const search = `%${query.search.trim()}%`;
    clauses.push(`(${searchColumns.map((column) => `COALESCE(${column}, '') LIKE ?`).join(' OR ')})`);
    for (let index = 0; index < searchColumns.length; index += 1) {
      params.push(search);
    }
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  };
}

export function listPosts(query: ContentListQuery): PaginatedResult<PostListItem> {
  return listPostsFromDatabase(getDatabase().sqlite, query);
}

export function listPostsFromDatabase(
  sqlite: Database.Database,
  query: ContentListQuery
): PaginatedResult<PostListItem> {
  const { where, params } = buildContentFilters(query, ['p.message', 'pg.name']);
  const from = 'FROM facebook_posts p JOIN facebook_pages pg ON pg.id = p.page_id';
  const total = sqlite
    .prepare(`SELECT COUNT(*) AS total ${from} ${where}`)
    .get(...params) as { total: number };
  const items = sqlite
    .prepare(
      `SELECT
        p.id,
        pg.id AS pageId,
        pg.name AS pageName,
        p.facebook_post_id AS facebookPostId,
        p.message,
        p.permalink_url AS permalinkUrl,
        p.created_time AS createdTime,
        p.reactions_count AS reactionsCount,
        p.comments_count AS commentsCount,
        p.shares_count AS sharesCount
       ${from}
       ${where}
       ORDER BY p.created_time DESC, p.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, query.limit, query.offset) as PostListItem[];

  return { items, total: total.total };
}

export function listComments(query: CommentListQuery): PaginatedResult<CommentListItem> {
  return listCommentsFromDatabase(getDatabase().sqlite, query);
}

export function listCommentsFromDatabase(
  sqlite: Database.Database,
  query: CommentListQuery
): PaginatedResult<CommentListItem> {
  const { where: baseWhere, params } = buildContentFilters(query, [
    'c.author_name',
    'c.message',
    'pg.name'
  ]);
  const clauses = baseWhere ? [baseWhere.replace(/^WHERE\s+/i, '')] : [];

  if (query.onlyLeads) {
    clauses.push('l.id IS NOT NULL');
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const from = `
    FROM facebook_comments c
    JOIN facebook_posts p ON p.id = c.post_id
    JOIN facebook_pages pg ON pg.id = p.page_id
    LEFT JOIN leads l ON l.source_comment_id = c.id
  `;
  const total = sqlite
    .prepare(`SELECT COUNT(*) AS total ${from} ${where}`)
    .get(...params) as { total: number };
  const items = sqlite
    .prepare(
      `SELECT
        c.id,
        pg.id AS pageId,
        pg.name AS pageName,
        p.id AS postId,
        p.facebook_post_id AS facebookPostId,
        p.permalink_url AS postPermalinkUrl,
        c.facebook_comment_id AS facebookCommentId,
        c.author_name AS authorName,
        c.message,
        c.created_time AS createdTime,
        c.like_count AS likeCount,
        l.id AS leadId,
        l.status AS leadStatus,
        l.score AS leadScore
       ${from}
       ${where}
       ORDER BY c.created_time DESC, c.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, query.limit, query.offset) as CommentListItem[];

  return { items, total: total.total };
}
