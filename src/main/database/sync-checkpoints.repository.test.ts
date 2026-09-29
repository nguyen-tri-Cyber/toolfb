import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  deleteSyncCheckpointInDatabase,
  getSyncCheckpointFromDatabase,
  saveSyncCheckpointInDatabase
} from './sync-checkpoints.repository';

function createDatabase(): Database.Database {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE sync_checkpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facebook_page_id TEXT NOT NULL UNIQUE,
      stage TEXT NOT NULL,
      posts_processed INTEGER NOT NULL DEFAULT 0,
      comments_processed INTEGER NOT NULL DEFAULT 0,
      leads_detected INTEGER NOT NULL DEFAULT 0,
      completed_post_ids_json TEXT NOT NULL DEFAULT '[]',
      cursor TEXT,
      since TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return sqlite;
}

describe('sync-checkpoints.repository', () => {
  it('saves and retrieves a sync checkpoint', () => {
    const sqlite = createDatabase();
    saveSyncCheckpointInDatabase(sqlite, {
      facebookPageId: 'page_123',
      stage: 'PROCESSING_POSTS',
      postsProcessed: 5,
      commentsProcessed: 20,
      leadsDetected: 3,
      completedPostIds: ['post_1', 'post_2'],
      cursor: 'cursor_abc',
      since: '1700000000',
      lastError: null
    });

    const checkpoint = getSyncCheckpointFromDatabase(sqlite, 'page_123');
    expect(checkpoint).not.toBeNull();
    expect(checkpoint?.facebookPageId).toBe('page_123');
    expect(checkpoint?.stage).toBe('PROCESSING_POSTS');
    expect(checkpoint?.postsProcessed).toBe(5);
    expect(checkpoint?.commentsProcessed).toBe(20);
    expect(checkpoint?.leadsDetected).toBe(3);
    expect(checkpoint?.completedPostIds).toEqual(['post_1', 'post_2']);
    expect(checkpoint?.cursor).toBe('cursor_abc');
  });

  it('updates an existing checkpoint on conflict', () => {
    const sqlite = createDatabase();
    saveSyncCheckpointInDatabase(sqlite, {
      facebookPageId: 'page_123',
      stage: 'PROCESSING_POSTS',
      postsProcessed: 5,
      commentsProcessed: 20,
      leadsDetected: 3,
      completedPostIds: ['post_1']
    });

    saveSyncCheckpointInDatabase(sqlite, {
      facebookPageId: 'page_123',
      stage: 'PROCESSING_COMMENTS',
      postsProcessed: 10,
      commentsProcessed: 50,
      leadsDetected: 8,
      completedPostIds: ['post_1', 'post_2']
    });

    const checkpoint = getSyncCheckpointFromDatabase(sqlite, 'page_123');
    expect(checkpoint?.postsProcessed).toBe(10);
    expect(checkpoint?.commentsProcessed).toBe(50);
    expect(checkpoint?.leadsDetected).toBe(8);
    expect(checkpoint?.completedPostIds).toEqual(['post_1', 'post_2']);
  });

  it('deletes checkpoint after complete synchronization', () => {
    const sqlite = createDatabase();
    saveSyncCheckpointInDatabase(sqlite, {
      facebookPageId: 'page_123',
      stage: 'PROCESSING_POSTS',
      postsProcessed: 5,
      commentsProcessed: 20,
      leadsDetected: 3,
      completedPostIds: ['post_1']
    });

    deleteSyncCheckpointInDatabase(sqlite, 'page_123');
    expect(getSyncCheckpointFromDatabase(sqlite, 'page_123')).toBeNull();
  });
});
