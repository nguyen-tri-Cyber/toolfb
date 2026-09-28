import type { FacebookPageRecord } from '@shared/types/ipc';
import type { FacebookPageDetails } from '../meta/meta.types';
import type Database from 'better-sqlite3';
import { getDatabase } from './index';

type PageRow = {
  id: number;
  facebook_page_id: string;
  name: string;
  username: string | null;
  category: string | null;
  picture_url: string | null;
  is_owned: 0 | 1;
  sync_enabled: 0 | 1;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapPageRow(row: PageRow): FacebookPageRecord {
  return {
    id: row.id,
    facebookPageId: row.facebook_page_id,
    name: row.name,
    username: row.username,
    category: row.category ?? undefined,
    pictureUrl: row.picture_url ?? undefined,
    isOwned: row.is_owned === 1,
    syncEnabled: row.sync_enabled === 1,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    imported: true
  };
}

export function listFacebookPages(): FacebookPageRecord[] {
  const { sqlite } = getDatabase();
  return listFacebookPagesFromDatabase(sqlite);
}

export function listFacebookPagesFromDatabase(sqlite: Database.Database): FacebookPageRecord[] {
  const rows = sqlite
    .prepare(
      `SELECT id, facebook_page_id, name, username, category, picture_url, is_owned,
        sync_enabled, last_synced_at, created_at, updated_at
       FROM facebook_pages
       ORDER BY name COLLATE NOCASE ASC`
    )
    .all() as PageRow[];

  return rows.map(mapPageRow);
}

export function listImportedFacebookPageIds(): Set<string> {
  const { sqlite } = getDatabase();
  const rows = sqlite.prepare('SELECT facebook_page_id FROM facebook_pages').all() as {
    facebook_page_id: string;
  }[];

  return new Set(rows.map((row) => row.facebook_page_id));
}

export function findFacebookPageByFacebookId(facebookPageId: string): FacebookPageRecord | null {
  const { sqlite } = getDatabase();
  const row = sqlite
    .prepare(
      `SELECT id, facebook_page_id, name, username, category, picture_url, is_owned,
        sync_enabled, last_synced_at, created_at, updated_at
       FROM facebook_pages
       WHERE facebook_page_id = ?`
    )
    .get(facebookPageId) as PageRow | undefined;

  return row ? mapPageRow(row) : null;
}

export function markFacebookPageSynced(facebookPageId: string, syncedAt: string): void {
  const { sqlite } = getDatabase();
  sqlite
    .prepare(
      `UPDATE facebook_pages
       SET last_synced_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE facebook_page_id = ?`
    )
    .run(syncedAt, facebookPageId);
}

export function upsertFacebookPage(page: FacebookPageDetails): FacebookPageRecord {
  const { sqlite } = getDatabase();
  return upsertFacebookPageInDatabase(sqlite, page);
}

export function upsertFacebookPageInDatabase(
  sqlite: Database.Database,
  page: FacebookPageDetails
): FacebookPageRecord {
  sqlite
    .prepare(
      `INSERT INTO facebook_pages (
        facebook_page_id, name, username, category, picture_url, is_owned, sync_enabled
      ) VALUES (
        @facebookPageId, @name, @username, @category, @pictureUrl, 1, 0
      )
      ON CONFLICT(facebook_page_id) DO UPDATE SET
        name = excluded.name,
        username = excluded.username,
        category = excluded.category,
        picture_url = excluded.picture_url,
        is_owned = 1,
        updated_at = CURRENT_TIMESTAMP`
    )
    .run({
      facebookPageId: page.facebookPageId,
      name: page.name,
      username: page.username ?? null,
      category: page.category ?? null,
      pictureUrl: page.pictureUrl ?? null
    });

  const row = sqlite
    .prepare(
      `SELECT id, facebook_page_id, name, username, category, picture_url, is_owned,
        sync_enabled, last_synced_at, created_at, updated_at
       FROM facebook_pages
       WHERE facebook_page_id = ?`
    )
    .get(page.facebookPageId) as PageRow;

  return mapPageRow(row);
}
