import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  listStoredPostsForPageInDatabase,
  upsertFacebookCommentInDatabase,
  upsertFacebookPostInDatabase
} from './content.repository';

function createTestDatabase(): Database.Database {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(`
    CREATE TABLE facebook_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facebook_page_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL
    );
    CREATE TABLE facebook_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER NOT NULL,
      facebook_post_id TEXT NOT NULL UNIQUE,
      message TEXT,
      post_type TEXT,
      permalink_url TEXT,
      created_time TEXT,
      reactions_count INTEGER NOT NULL DEFAULT 0,
      comments_count INTEGER NOT NULL DEFAULT 0,
      shares_count INTEGER NOT NULL DEFAULT 0,
      raw_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (page_id) REFERENCES facebook_pages (id) ON DELETE CASCADE
    );
    CREATE TABLE facebook_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      facebook_comment_id TEXT NOT NULL UNIQUE,
      parent_comment_id TEXT,
      author_external_id TEXT,
      author_name TEXT,
      message TEXT,
      created_time TEXT,
      like_count INTEGER NOT NULL DEFAULT 0,
      raw_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES facebook_posts (id) ON DELETE CASCADE
    );
  `);
  sqlite.prepare('INSERT INTO facebook_pages (facebook_page_id, name) VALUES (?, ?)').run('page-1', 'Page test');
  return sqlite;
}

describe('content.repository', () => {
  it('lists stored post references for only the requested Page', () => {
    const sqlite = createTestDatabase();
    sqlite.prepare('INSERT INTO facebook_pages (facebook_page_id, name) VALUES (?, ?)').run('page-2', 'Other');
    const post = {
      facebookPostId: 'old-post', message: 'Old', postType: null,
      reactionsCount: 0, commentsCount: 0, sharesCount: 0, rawJson: '{}'
    };
    const id = upsertFacebookPostInDatabase(sqlite, 1, post);
    upsertFacebookPostInDatabase(sqlite, 2, { ...post, facebookPostId: 'other-post' });

    expect(listStoredPostsForPageInDatabase(sqlite, 1)).toEqual([{ id, facebookPostId: 'old-post' }]);
  });

  it('upserts posts and comments by Facebook id without creating duplicates', () => {
    const sqlite = createTestDatabase();
    const post = {
      facebookPostId: 'page-1_100',
      message: 'Bài viết đầu tiên',
      postType: 'added_photos',
      permalinkUrl: 'https://facebook.com/page-1/posts/100',
      createdTime: '2026-09-28T00:00:00+0000',
      reactionsCount: 10,
      commentsCount: 2,
      sharesCount: 1,
      rawJson: '{}'
    };

    const firstPostId = upsertFacebookPostInDatabase(sqlite, 1, post);
    const secondPostId = upsertFacebookPostInDatabase(sqlite, 1, {
      ...post,
      message: 'Nội dung đã cập nhật',
      reactionsCount: 15
    });

    expect(secondPostId).toBe(firstPostId);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM facebook_posts').get()).toEqual({ count: 1 });
    expect(
      sqlite.prepare('SELECT message, reactions_count FROM facebook_posts WHERE id = ?').get(firstPostId)
    ).toEqual({ message: 'Nội dung đã cập nhật', reactions_count: 15 });

    const comment = {
      facebookCommentId: 'comment-1',
      parentCommentId: null,
      authorExternalId: 'user-1',
      authorName: 'Khách hàng A',
      message: 'Giá bao nhiêu?',
      createdTime: '2026-09-28T00:10:00+0000',
      likeCount: 3,
      rawJson: '{}'
    };

    const firstCommentId = upsertFacebookCommentInDatabase(sqlite, firstPostId, comment);
    const secondCommentId = upsertFacebookCommentInDatabase(sqlite, firstPostId, {
      ...comment,
      message: 'Còn hàng không?',
      likeCount: 4
    });

    expect(secondCommentId).toBe(firstCommentId);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM facebook_comments').get()).toEqual({ count: 1 });
    expect(
      sqlite.prepare('SELECT message, like_count FROM facebook_comments WHERE id = ?').get(firstCommentId)
    ).toEqual({ message: 'Còn hàng không?', like_count: 4 });
  });
});
