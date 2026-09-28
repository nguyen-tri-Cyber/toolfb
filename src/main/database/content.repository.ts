import type Database from 'better-sqlite3';
import type { FacebookCommentDetails, FacebookPostDetails } from '../meta/meta.types';
import { getDatabase } from './index';

export function upsertFacebookPost(
  localPageId: number,
  post: FacebookPostDetails
): number {
  return upsertFacebookPostInDatabase(getDatabase().sqlite, localPageId, post);
}

export function upsertFacebookPostInDatabase(
  sqlite: Database.Database,
  localPageId: number,
  post: FacebookPostDetails
): number {
  sqlite
    .prepare(
      `INSERT INTO facebook_posts (
        page_id, facebook_post_id, message, post_type, permalink_url, created_time,
        reactions_count, comments_count, shares_count, raw_json
      ) VALUES (
        @pageId, @facebookPostId, @message, @postType, @permalinkUrl, @createdTime,
        @reactionsCount, @commentsCount, @sharesCount, @rawJson
      )
      ON CONFLICT(facebook_post_id) DO UPDATE SET
        page_id = excluded.page_id,
        message = excluded.message,
        post_type = excluded.post_type,
        permalink_url = excluded.permalink_url,
        created_time = excluded.created_time,
        reactions_count = excluded.reactions_count,
        comments_count = excluded.comments_count,
        shares_count = excluded.shares_count,
        raw_json = excluded.raw_json,
        updated_at = CURRENT_TIMESTAMP`
    )
    .run({
      pageId: localPageId,
      facebookPostId: post.facebookPostId,
      message: post.message ?? null,
      postType: post.postType ?? null,
      permalinkUrl: post.permalinkUrl ?? null,
      createdTime: post.createdTime ?? null,
      reactionsCount: post.reactionsCount,
      commentsCount: post.commentsCount,
      sharesCount: post.sharesCount,
      rawJson: post.rawJson
    });

  const row = sqlite
    .prepare('SELECT id FROM facebook_posts WHERE facebook_post_id = ?')
    .get(post.facebookPostId) as { id: number };
  return row.id;
}

export function upsertFacebookComment(
  localPostId: number,
  comment: FacebookCommentDetails
): number {
  return upsertFacebookCommentInDatabase(getDatabase().sqlite, localPostId, comment);
}

export function upsertFacebookCommentInDatabase(
  sqlite: Database.Database,
  localPostId: number,
  comment: FacebookCommentDetails
): number {
  sqlite
    .prepare(
      `INSERT INTO facebook_comments (
        post_id, facebook_comment_id, parent_comment_id, author_external_id, author_name,
        message, created_time, like_count, raw_json
      ) VALUES (
        @postId, @facebookCommentId, @parentCommentId, @authorExternalId, @authorName,
        @message, @createdTime, @likeCount, @rawJson
      )
      ON CONFLICT(facebook_comment_id) DO UPDATE SET
        post_id = excluded.post_id,
        parent_comment_id = excluded.parent_comment_id,
        author_external_id = excluded.author_external_id,
        author_name = excluded.author_name,
        message = excluded.message,
        created_time = excluded.created_time,
        like_count = excluded.like_count,
        raw_json = excluded.raw_json,
        updated_at = CURRENT_TIMESTAMP`
    )
    .run({
      postId: localPostId,
      facebookCommentId: comment.facebookCommentId,
      parentCommentId: comment.parentCommentId,
      authorExternalId: comment.authorExternalId ?? null,
      authorName: comment.authorName ?? null,
      message: comment.message ?? null,
      createdTime: comment.createdTime ?? null,
      likeCount: comment.likeCount,
      rawJson: comment.rawJson
    });

  const row = sqlite
    .prepare('SELECT id FROM facebook_comments WHERE facebook_comment_id = ?')
    .get(comment.facebookCommentId) as { id: number };
  return row.id;
}
