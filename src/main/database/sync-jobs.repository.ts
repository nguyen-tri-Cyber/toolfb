import type Database from 'better-sqlite3';
import { getDatabase } from './index';

export function startSyncJob(jobType: string, pageId: number): number {
  return startSyncJobInDatabase(getDatabase().sqlite, jobType, pageId);
}

export function startSyncJobInDatabase(
  sqlite: Database.Database,
  jobType: string,
  pageId: number
): number {
  const result = sqlite
    .prepare(
      `INSERT INTO sync_jobs (job_type, status, page_id, started_at)
       VALUES (?, 'RUNNING', ?, CURRENT_TIMESTAMP)`
    )
    .run(jobType, pageId);
  return Number(result.lastInsertRowid);
}

export function finishSyncJob(jobId: number, processedItems: number): void {
  finishSyncJobInDatabase(getDatabase().sqlite, jobId, processedItems);
}

export function finishSyncJobInDatabase(
  sqlite: Database.Database,
  jobId: number,
  processedItems: number
): void {
  sqlite
    .prepare(
      `UPDATE sync_jobs
       SET status = 'SUCCESS',
           processed_items = ?,
           failed_items = 0,
           error_code = NULL,
           error_message = NULL,
           finished_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .run(processedItems, jobId);
}

export function failSyncJob(
  jobId: number,
  errorCode: string,
  errorMessage: string,
  failedItems = 0
): void {
  failSyncJobInDatabase(getDatabase().sqlite, jobId, errorCode, errorMessage, failedItems);
}

export function cancelSyncJob(jobId: number, processedItems: number): void {
  cancelSyncJobInDatabase(getDatabase().sqlite, jobId, processedItems);
}

export function cancelSyncJobInDatabase(
  sqlite: Database.Database,
  jobId: number,
  processedItems: number
): void {
  sqlite.prepare(
    `UPDATE sync_jobs
     SET status = 'CANCELLED', processed_items = ?, finished_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'RUNNING'`
  ).run(processedItems, jobId);
}

export function failSyncJobInDatabase(
  sqlite: Database.Database,
  jobId: number,
  errorCode: string,
  errorMessage: string,
  failedItems = 0
): void {
  sqlite
    .prepare(
      `UPDATE sync_jobs
       SET status = 'FAILED',
           failed_items = ?,
           error_code = ?,
           error_message = ?,
           finished_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .run(failedItems, errorCode, errorMessage, jobId);
}

export function recoverInterruptedSyncJobs(): void {
  recoverInterruptedSyncJobsInDatabase(getDatabase().sqlite);
}

export function recoverInterruptedSyncJobsInDatabase(sqlite: Database.Database): void {
  sqlite
    .prepare(
      `UPDATE sync_jobs
       SET status = 'FAILED',
           error_code = 'APP_RESTARTED',
           error_message = 'The application restarted before the synchronization job finished.',
           finished_at = CURRENT_TIMESTAMP
       WHERE status = 'RUNNING'`
    )
    .run();
}
