import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  failSyncJobInDatabase,
  finishSyncJobInDatabase,
  recoverInterruptedSyncJobsInDatabase,
  startSyncJobInDatabase
} from './sync-jobs.repository';

function createDatabase(): Database.Database {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE sync_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      page_id INTEGER,
      started_at TEXT,
      finished_at TEXT,
      processed_items INTEGER NOT NULL DEFAULT 0,
      failed_items INTEGER NOT NULL DEFAULT 0,
      error_code TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return sqlite;
}

describe('sync-jobs.repository', () => {
  it('records running and successful sync state', () => {
    const sqlite = createDatabase();
    const id = startSyncJobInDatabase(sqlite, 'OWNED_PAGE_SYNC', 7);
    finishSyncJobInDatabase(sqlite, id, 42);

    expect(sqlite.prepare('SELECT status, processed_items, page_id FROM sync_jobs WHERE id = ?').get(id)).toEqual({
      status: 'SUCCESS',
      processed_items: 42,
      page_id: 7
    });
  });

  it('records failure codes and recovers interrupted jobs after restart', () => {
    const sqlite = createDatabase();
    const failedId = startSyncJobInDatabase(sqlite, 'OWNED_PAGE_SYNC', 7);
    failSyncJobInDatabase(sqlite, failedId, 'META_NETWORK_ERROR', 'Network unavailable', 3);
    const interruptedId = startSyncJobInDatabase(sqlite, 'OWNED_PAGE_SYNC', 8);

    recoverInterruptedSyncJobsInDatabase(sqlite);

    expect(sqlite.prepare('SELECT status, error_code, failed_items FROM sync_jobs WHERE id = ?').get(failedId)).toEqual({
      status: 'FAILED',
      error_code: 'META_NETWORK_ERROR',
      failed_items: 3
    });
    expect(sqlite.prepare('SELECT status, error_code FROM sync_jobs WHERE id = ?').get(interruptedId)).toEqual({
      status: 'FAILED',
      error_code: 'APP_RESTARTED'
    });
  });
});
