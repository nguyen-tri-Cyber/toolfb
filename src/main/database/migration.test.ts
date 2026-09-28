import Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getPath: () => '.' } }));

import { runMigrations } from './index';

describe('database migration compatibility', () => {
  it('adds Owned Page MVP columns to an older database', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
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
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE sync_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        started_at TEXT,
        finished_at TEXT,
        processed_items INTEGER NOT NULL DEFAULT 0,
        failed_items INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    runMigrations(sqlite);

    const leadColumns = sqlite.prepare('PRAGMA table_info(leads)').all() as Array<{ name: string }>;
    const jobColumns = sqlite.prepare('PRAGMA table_info(sync_jobs)').all() as Array<{ name: string }>;
    expect(leadColumns.map((column) => column.name)).toEqual(expect.arrayContaining(['note', 'tags_json']));
    expect(jobColumns.map((column) => column.name)).toEqual(expect.arrayContaining(['page_id', 'error_code']));

    sqlite.prepare("INSERT INTO leads (source_type, source_comment_id) VALUES ('FACEBOOK_COMMENT', 10)").run();
    expect(() =>
      sqlite.prepare("INSERT INTO leads (source_type, source_comment_id) VALUES ('FACEBOOK_COMMENT', 10)").run()
    ).toThrow();
  });
});
