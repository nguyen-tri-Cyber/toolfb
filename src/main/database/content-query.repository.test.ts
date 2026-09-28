import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  listCommentsFromDatabase,
  listPostsFromDatabase
} from './content-query.repository';

function createDatabase(): Database.Database {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE facebook_pages (
      id INTEGER PRIMARY KEY,
      facebook_page_id TEXT NOT NULL,
      name TEXT NOT NULL
    );
    CREATE TABLE facebook_posts (
      id INTEGER PRIMARY KEY,
      page_id INTEGER NOT NULL,
      facebook_post_id TEXT NOT NULL,
      message TEXT,
      permalink_url TEXT,
      created_time TEXT,
      reactions_count INTEGER NOT NULL,
      comments_count INTEGER NOT NULL,
      shares_count INTEGER NOT NULL
    );
    CREATE TABLE facebook_comments (
      id INTEGER PRIMARY KEY,
      post_id INTEGER NOT NULL,
      facebook_comment_id TEXT NOT NULL,
      author_name TEXT,
      message TEXT,
      created_time TEXT,
      like_count INTEGER NOT NULL
    );
    CREATE TABLE leads (
      id INTEGER PRIMARY KEY,
      source_comment_id INTEGER,
      status TEXT NOT NULL,
      score INTEGER NOT NULL
    );
  `);
  sqlite.prepare('INSERT INTO facebook_pages VALUES (1, ?, ?)').run('page-1', 'Phân bón shop');
  sqlite.prepare('INSERT INTO facebook_posts VALUES (1, 1, ?, ?, ?, ?, 5, 2, 1)').run(
    'post-1',
    'Khuyến mãi phân bón',
    'https://facebook.com/post-1',
    '2026-09-28T01:00:00Z'
  );
  sqlite.prepare('INSERT INTO facebook_comments VALUES (1, 1, ?, ?, ?, ?, 2)').run(
    'comment-1',
    'Khách A',
    'Giá bao nhiêu?',
    '2026-09-28T02:00:00Z'
  );
  sqlite.prepare('INSERT INTO leads VALUES (1, 1, ?, 55)').run('NEW');
  return sqlite;
}

describe('content-query.repository', () => {
  it('lists posts with page context and search', () => {
    const result = listPostsFromDatabase(createDatabase(), {
      search: 'khuyến mãi',
      limit: 20,
      offset: 0
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      pageName: 'Phân bón shop',
      facebookPostId: 'post-1',
      reactionsCount: 5
    });
  });

  it('lists comments with lead context and search', () => {
    const result = listCommentsFromDatabase(createDatabase(), {
      search: 'Khách A',
      onlyLeads: true,
      limit: 20,
      offset: 0
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      authorName: 'Khách A',
      leadId: 1,
      leadStatus: 'NEW',
      leadScore: 55
    });
  });
});
