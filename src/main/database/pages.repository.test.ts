import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { listFacebookPagesFromDatabase, upsertFacebookPageInDatabase } from './pages.repository';

function createTestDatabase(): Database.Database {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE facebook_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facebook_page_id TEXT NOT NULL,
      name TEXT NOT NULL,
      username TEXT,
      category TEXT,
      picture_url TEXT,
      is_owned INTEGER NOT NULL DEFAULT 0,
      sync_enabled INTEGER NOT NULL DEFAULT 0,
      last_synced_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX facebook_pages_facebook_page_id_unique
      ON facebook_pages (facebook_page_id);
  `);
  return sqlite;
}

describe('pages.repository', () => {
  it('upserts Facebook Pages by facebook_page_id and prevents duplicates', () => {
    const sqlite = createTestDatabase();

    const first = upsertFacebookPageInDatabase(sqlite, {
      facebookPageId: '123456789',
      name: 'Trang ban đầu',
      category: 'Retail',
      imported: false
    });

    const second = upsertFacebookPageInDatabase(sqlite, {
      facebookPageId: '123456789',
      name: 'Trang đã cập nhật',
      username: 'updated-page',
      category: 'Shopping',
      pictureUrl: 'https://example.com/page.jpg',
      imported: false
    });

    const pages = listFacebookPagesFromDatabase(sqlite);
    expect(second.id).toBe(first.id);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({
      facebookPageId: '123456789',
      name: 'Trang đã cập nhật',
      username: 'updated-page',
      category: 'Shopping',
      pictureUrl: 'https://example.com/page.jpg',
      isOwned: true
    });
  });
});
