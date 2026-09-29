import type Database from 'better-sqlite3';
import { getDatabase } from './index';

export interface SyncCheckpointData {
  facebookPageId: string;
  stage: string;
  postsProcessed: number;
  commentsProcessed: number;
  leadsDetected: number;
  completedPostIds: string[];
  cursor?: string | null;
  since?: string | null;
  lastError?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface SyncCheckpointRow {
  id: number;
  facebook_page_id: string;
  stage: string;
  posts_processed: number;
  comments_processed: number;
  leads_detected: number;
  completed_post_ids_json: string;
  cursor: string | null;
  since: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

function parsePostIds(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function saveSyncCheckpoint(checkpoint: SyncCheckpointData): void {
  saveSyncCheckpointInDatabase(getDatabase().sqlite, checkpoint);
}

export function saveSyncCheckpointInDatabase(
  sqlite: Database.Database,
  checkpoint: SyncCheckpointData
): void {
  sqlite
    .prepare(
      `INSERT INTO sync_checkpoints (
        facebook_page_id, stage, posts_processed, comments_processed, leads_detected,
        completed_post_ids_json, cursor, since, last_error, updated_at
      ) VALUES (
        @facebookPageId, @stage, @postsProcessed, @commentsProcessed, @leadsDetected,
        @completedPostIdsJson, @cursor, @since, @lastError, CURRENT_TIMESTAMP
      )
      ON CONFLICT(facebook_page_id) DO UPDATE SET
        stage = excluded.stage,
        posts_processed = excluded.posts_processed,
        comments_processed = excluded.comments_processed,
        leads_detected = excluded.leads_detected,
        completed_post_ids_json = excluded.completed_post_ids_json,
        cursor = excluded.cursor,
        since = excluded.since,
        last_error = excluded.last_error,
        updated_at = CURRENT_TIMESTAMP`
    )
    .run({
      facebookPageId: checkpoint.facebookPageId,
      stage: checkpoint.stage,
      postsProcessed: checkpoint.postsProcessed,
      commentsProcessed: checkpoint.commentsProcessed,
      leadsDetected: checkpoint.leadsDetected,
      completedPostIdsJson: JSON.stringify(checkpoint.completedPostIds),
      cursor: checkpoint.cursor ?? null,
      since: checkpoint.since ?? null,
      lastError: checkpoint.lastError ?? null
    });
}

export function getSyncCheckpoint(facebookPageId: string): SyncCheckpointData | null {
  return getSyncCheckpointFromDatabase(getDatabase().sqlite, facebookPageId);
}

export function getSyncCheckpointFromDatabase(
  sqlite: Database.Database,
  facebookPageId: string
): SyncCheckpointData | null {
  const row = sqlite
    .prepare('SELECT * FROM sync_checkpoints WHERE facebook_page_id = ?')
    .get(facebookPageId) as SyncCheckpointRow | undefined;

  if (!row) return null;

  return {
    facebookPageId: row.facebook_page_id,
    stage: row.stage,
    postsProcessed: row.posts_processed,
    commentsProcessed: row.comments_processed,
    leadsDetected: row.leads_detected,
    completedPostIds: parsePostIds(row.completed_post_ids_json),
    cursor: row.cursor,
    since: row.since,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function deleteSyncCheckpoint(facebookPageId: string): void {
  deleteSyncCheckpointInDatabase(getDatabase().sqlite, facebookPageId);
}

export function deleteSyncCheckpointInDatabase(
  sqlite: Database.Database,
  facebookPageId: string
): void {
  sqlite.prepare('DELETE FROM sync_checkpoints WHERE facebook_page_id = ?').run(facebookPageId);
}
