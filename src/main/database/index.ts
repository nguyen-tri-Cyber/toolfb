import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { app } from 'electron';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from './schema';

type DrizzleDatabase = ReturnType<typeof drizzle<typeof schema>>;

interface DatabaseContext {
  sqlite: Database.Database;
  db: DrizzleDatabase;
  path: string;
}

let context: DatabaseContext | null = null;

function createSqliteDatabase(databasePath: string): Database.Database {
  mkdirSync(dirname(databasePath), { recursive: true });
  const sqlite = new Database(databasePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return sqlite;
}

export function runMigrations(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS app_settings_key_unique ON app_settings (key);

    CREATE TABLE IF NOT EXISTS facebook_pages (
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
    CREATE UNIQUE INDEX IF NOT EXISTS facebook_pages_facebook_page_id_unique ON facebook_pages (facebook_page_id);
    CREATE INDEX IF NOT EXISTS facebook_pages_name_idx ON facebook_pages (name);

    CREATE TABLE IF NOT EXISTS facebook_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER NOT NULL,
      facebook_post_id TEXT NOT NULL,
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
    CREATE UNIQUE INDEX IF NOT EXISTS facebook_posts_facebook_post_id_unique ON facebook_posts (facebook_post_id);
    CREATE INDEX IF NOT EXISTS facebook_posts_page_id_idx ON facebook_posts (page_id);
    CREATE INDEX IF NOT EXISTS facebook_posts_created_time_idx ON facebook_posts (created_time);

    CREATE TABLE IF NOT EXISTS facebook_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      facebook_comment_id TEXT NOT NULL,
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
    CREATE UNIQUE INDEX IF NOT EXISTS facebook_comments_facebook_comment_id_unique ON facebook_comments (facebook_comment_id);
    CREATE INDEX IF NOT EXISTS facebook_comments_post_id_idx ON facebook_comments (post_id);
    CREATE INDEX IF NOT EXISTS facebook_comments_parent_comment_id_idx ON facebook_comments (parent_comment_id);
    CREATE INDEX IF NOT EXISTS facebook_comments_created_time_idx ON facebook_comments (created_time);

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL,
      source_comment_id INTEGER,
      status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST')),
      intent_level TEXT,
      intent_type TEXT,
      score INTEGER NOT NULL DEFAULT 0,
      sentiment TEXT,
      summary TEXT,
      note TEXT,
      tags_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (source_comment_id) REFERENCES facebook_comments (id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS leads_source_comment_id_idx ON leads (source_comment_id);
    CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status);

    CREATE TABLE IF NOT EXISTS ai_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      buyer_intent TEXT,
      intent_type TEXT,
      pain_points_json TEXT,
      product_interests_json TEXT,
      sentiment TEXT,
      questions_json TEXT,
      confidence INTEGER NOT NULL DEFAULT 0,
      model TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS ai_analyses_entity_idx ON ai_analyses (entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS ai_analyses_created_at_idx ON ai_analyses (created_at);

    CREATE TABLE IF NOT EXISTS sync_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED')),
      page_id INTEGER,
      started_at TEXT,
      finished_at TEXT,
      processed_items INTEGER NOT NULL DEFAULT 0,
      failed_items INTEGER NOT NULL DEFAULT 0,
      error_code TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS sync_jobs_status_idx ON sync_jobs (status);
    CREATE INDEX IF NOT EXISTS sync_jobs_job_type_idx ON sync_jobs (job_type);

    CREATE TABLE IF NOT EXISTS lead_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES leads (id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS lead_history_lead_id_idx ON lead_history (lead_id);
    CREATE INDEX IF NOT EXISTS lead_history_created_at_idx ON lead_history (created_at);

    CREATE TABLE IF NOT EXISTS sync_checkpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facebook_page_id TEXT NOT NULL,
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
    CREATE UNIQUE INDEX IF NOT EXISTS sync_checkpoints_facebook_page_id_unique ON sync_checkpoints (facebook_page_id);
  `);

  ensureColumn(sqlite, 'leads', 'note', 'TEXT');
  ensureColumn(sqlite, 'leads', 'tags_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(sqlite, 'sync_jobs', 'page_id', 'INTEGER');
  ensureColumn(sqlite, 'sync_jobs', 'error_code', 'TEXT');

  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS leads_source_comment_unique
      ON leads (source_comment_id)
      WHERE source_comment_id IS NOT NULL;
  `);
}

function ensureColumn(
  sqlite: Database.Database,
  tableName: string,
  columnName: string,
  definition: string
): void {
  const columns = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === columnName)) return;
  sqlite.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

export function initializeDatabase(): DatabaseContext {
  if (context) {
    return context;
  }

  const userDataDir = typeof app?.getPath === 'function' ? app.getPath('userData') : '.';
  const databasePath = join(userDataDir, 'fsi.db');
  const sqlite = createSqliteDatabase(databasePath);
  runMigrations(sqlite);
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
  context = {
    sqlite,
    db: drizzle(sqlite, { schema }),
    path: databasePath
  };

  return context;
}

export function getDatabase(): DatabaseContext {
  return context ?? initializeDatabase();
}

export function checkDatabaseHealth(): boolean {
  const { sqlite } = getDatabase();
  const result = sqlite.prepare('SELECT 1 AS ok').get() as { ok: number } | undefined;
  return result?.ok === 1;
}

export function getDashboardStats() {
  const { db } = getDatabase();
  const countAll = sql<number>`count(*)`.as('value');

  const [pages] = db.select({ value: countAll }).from(schema.facebookPages).all();
  const [posts] = db.select({ value: countAll }).from(schema.facebookPosts).all();
  const [comments] = db.select({ value: countAll }).from(schema.facebookComments).all();
  const [leads] = db.select({ value: countAll }).from(schema.leads).all();

  return {
    pages: pages?.value ?? 0,
    posts: posts?.value ?? 0,
    comments: comments?.value ?? 0,
    leads: leads?.value ?? 0
  };
}
