import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  bulkAddLeadTagsInDatabase,
  bulkUpdateLeadStatusInDatabase,
  getLeadHistoryFromDatabase,
  listLeadsFromDatabase,
  updateLeadDetailsInDatabase,
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

    CREATE TABLE lead_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES leads (id) ON DELETE CASCADE
    );
  `);

  sqlite.prepare('INSERT INTO facebook_pages (facebook_page_id, name) VALUES (?, ?)').run('page-1', 'Phân bón shop');
  sqlite.prepare(
    'INSERT INTO facebook_posts (page_id, facebook_post_id, message, permalink_url, created_time) VALUES (1, ?, ?, ?, ?)'
  ).run('post-1', 'Bài bán hàng', 'https://facebook.com/post-1', '2026-09-28T01:00:00Z');
  sqlite.prepare(
    'INSERT INTO facebook_comments (post_id, facebook_comment_id, author_name, message, created_time) VALUES (1, ?, ?, ?, ?)'
  ).run('comment-1', 'Khách A', 'Giá bao nhiêu?', '2026-09-28T02:00:00Z');
  sqlite.prepare(
    'INSERT INTO facebook_comments (post_id, facebook_comment_id, author_name, message, created_time) VALUES (1, ?, ?, ?, ?)'
  ).run('comment-2', 'Khách B', 'Mua 2 bao', '2026-09-28T03:00:00Z');

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

  it('tracks change history when status and details are updated', () => {
    const sqlite = createTestDatabase();
    const leadId = upsertLeadFromCommentInDatabase(sqlite, 1, {
      intentLevel: 'HIGH',
      intentType: 'BUY',
      score: 90,
      summary: 'Đặt mua hàng'
    });

    updateLeadStatusInDatabase(sqlite, leadId, 'CONTACTED');
    updateLeadStatusInDatabase(sqlite, leadId, 'WON');
    updateLeadDetailsInDatabase(sqlite, leadId, 'Đã chốt đơn qua điện thoại', ['VIP', 'Hot']);

    const history = getLeadHistoryFromDatabase(sqlite, leadId);
    expect(history.length).toBe(4);
    expect(history[0].action).toBe('TAGS_UPDATED');
    expect(history[1].action).toBe('NOTE_UPDATED');
    expect(history[2].action).toBe('STATUS_CHANGED');
    expect(history[2].oldValue).toBe('CONTACTED');
    expect(history[2].newValue).toBe('WON');
    expect(history[3].action).toBe('STATUS_CHANGED');
    expect(history[3].oldValue).toBe('NEW');
    expect(history[3].newValue).toBe('CONTACTED');
  });

  it('rolls back a status change when its history cannot be recorded', () => {
    const sqlite = createTestDatabase();
    const leadId = upsertLeadFromCommentInDatabase(sqlite, 1, {
      intentLevel: 'HIGH', intentType: 'BUY', score: 90, summary: 'Mua hàng'
    });
    sqlite.exec(`CREATE TRIGGER reject_lead_history BEFORE INSERT ON lead_history
      BEGIN SELECT RAISE(FAIL, 'history unavailable'); END;`);

    expect(() => updateLeadStatusInDatabase(sqlite, leadId, 'WON')).toThrow('history unavailable');
    expect(sqlite.prepare('SELECT status FROM leads WHERE id = ?').get(leadId)).toEqual({ status: 'NEW' });
  });

  it('rolls back note and tags when their history cannot be recorded', () => {
    const sqlite = createTestDatabase();
    const leadId = upsertLeadFromCommentInDatabase(sqlite, 1, {
      intentLevel: 'HIGH', intentType: 'BUY', score: 90, summary: 'Mua hàng'
    });
    sqlite.exec(`CREATE TRIGGER reject_lead_history BEFORE INSERT ON lead_history
      BEGIN SELECT RAISE(FAIL, 'history unavailable'); END;`);

    expect(() => updateLeadDetailsInDatabase(sqlite, leadId, 'Đã gọi', ['VIP'])).toThrow('history unavailable');
    expect(sqlite.prepare('SELECT note, tags_json FROM leads WHERE id = ?').get(leadId)).toEqual({
      note: null, tags_json: '[]'
    });
  });

  it('performs bulk status update and records history for each lead', () => {
    const sqlite = createTestDatabase();
    const lead1 = upsertLeadFromCommentInDatabase(sqlite, 1, {
      intentLevel: 'MEDIUM',
      intentType: 'PRICE',
      score: 60,
      summary: 'Hỏi giá'
    });
    const lead2 = upsertLeadFromCommentInDatabase(sqlite, 2, {
      intentLevel: 'HIGH',
      intentType: 'BUY',
      score: 85,
      summary: 'Mua hàng'
    });

    const result = bulkUpdateLeadStatusInDatabase(sqlite, [lead1, lead2], 'QUALIFIED');
    expect(result.updated).toBe(2);

    expect(sqlite.prepare('SELECT status FROM leads WHERE id = ?').get(lead1)).toEqual({ status: 'QUALIFIED' });
    expect(sqlite.prepare('SELECT status FROM leads WHERE id = ?').get(lead2)).toEqual({ status: 'QUALIFIED' });

    const hist1 = getLeadHistoryFromDatabase(sqlite, lead1);
    expect(hist1[0].action).toBe('BULK_STATUS_CHANGED');
    expect(hist1[0].newValue).toBe('QUALIFIED');
  });

  it('performs bulk add tags and merges without duplicates', () => {
    const sqlite = createTestDatabase();
    const lead1 = upsertLeadFromCommentInDatabase(sqlite, 1, {
      intentLevel: 'MEDIUM',
      intentType: 'PRICE',
      score: 60,
      summary: 'Hỏi giá'
    });
    updateLeadDetailsInDatabase(sqlite, lead1, null, ['Ưu tiên']);

    const result = bulkAddLeadTagsInDatabase(sqlite, [lead1], ['Ưu tiên', 'Khách quen', 'Zalo']);
    expect(result.updated).toBe(1);

    const row = sqlite.prepare('SELECT tags_json FROM leads WHERE id = ?').get(lead1) as { tags_json: string };
    const tags = JSON.parse(row.tags_json);
    expect(tags).toEqual(['Ưu tiên', 'Khách quen', 'Zalo']);
  });
});
