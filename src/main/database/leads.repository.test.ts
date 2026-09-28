import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  listLeadsFromDatabase,
  updateLeadStatusInDatabase,
  upsertLeadFromCommentInDatabase
} from './leads.repository';

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
      permalink_url TEXT,
      created_time TEXT,
      FOREIGN KEY (page_id) REFERENCES facebook_pages (id)
    );
    CREATE TABLE facebook_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      facebook_comment_id TEXT NOT NULL UNIQUE,
      author_name TEXT,
      message TEXT,
      created_time TEXT,
      FOREIGN KEY (post_id) REFERENCES facebook_posts (id)
    );
    CREATE TABLE leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL,
      source_comment_id INTEGER,
      status TEXT NOT NULL DEFAULT 'NEW',
      intent_level TEXT,
      intent_type TEXT,
      score INTEGER NOT NULL DEFAULT 0,
      sentiment TEXT,
      summary TEXT,
      note TEXT,
      tags_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (source_comment_id) REFERENCES facebook_comments (id)
    );
    CREATE UNIQUE INDEX leads_source_comment_unique
      ON leads (source_comment_id) WHERE source_comment_id IS NOT NULL;
  `);

  sqlite.prepare('INSERT INTO facebook_pages (facebook_page_id, name) VALUES (?, ?)').run('page-1', 'Phân bón shop');
  sqlite.prepare(
    'INSERT INTO facebook_posts (page_id, facebook_post_id, message, permalink_url, created_time) VALUES (1, ?, ?, ?, ?)'
  ).run('post-1', 'Bài bán hàng', 'https://facebook.com/post-1', '2026-09-28T01:00:00Z');
  sqlite.prepare(
    'INSERT INTO facebook_comments (post_id, facebook_comment_id, author_name, message, created_time) VALUES (1, ?, ?, ?, ?)'
  ).run('comment-1', 'Khách A', 'Giá bao nhiêu?', '2026-09-28T02:00:00Z');

  return sqlite;
}

describe('leads.repository', () => {
  it('upserts one lead per source comment and preserves workflow status', () => {
    const sqlite = createTestDatabase();

    const firstId = upsertLeadFromCommentInDatabase(sqlite, 1, {
      intentLevel: 'MEDIUM',
      intentType: 'PRICE',
      score: 55,
      summary: 'Hỏi giá sản phẩm'
    });
    updateLeadStatusInDatabase(sqlite, firstId, 'CONTACTED');

    const secondId = upsertLeadFromCommentInDatabase(sqlite, 1, {
      intentLevel: 'HIGH',
      intentType: 'BUY',
      score: 85,
      summary: 'Muốn mua sản phẩm'
    });

    expect(secondId).toBe(firstId);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM leads').get()).toEqual({ count: 1 });
    expect(sqlite.prepare('SELECT status, score, intent_type FROM leads WHERE id = ?').get(firstId)).toEqual({
      status: 'CONTACTED',
      score: 85,
      intent_type: 'BUY'
    });
  });

  it('lists joined lead context and filters by status/search', () => {
    const sqlite = createTestDatabase();
    const leadId = upsertLeadFromCommentInDatabase(sqlite, 1, {
      intentLevel: 'MEDIUM',
      intentType: 'PRICE',
      score: 55,
      summary: 'Hỏi giá sản phẩm'
    });
    updateLeadStatusInDatabase(sqlite, leadId, 'QUALIFIED');

    const result = listLeadsFromDatabase(sqlite, {
      status: 'QUALIFIED',
      search: 'Khách A',
      limit: 20,
      offset: 0
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: leadId,
      pageName: 'Phân bón shop',
      authorName: 'Khách A',
      commentMessage: 'Giá bao nhiêu?',
      status: 'QUALIFIED'
    });
  });
});
