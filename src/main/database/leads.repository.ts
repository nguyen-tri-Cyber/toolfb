import type Database from 'better-sqlite3';
import { getDatabase } from './index';

export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'WON' | 'LOST';

export interface LeadClassificationInput {
  intentLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  intentType: string;
  score: number;
  summary: string;
}

export interface LeadListQuery {
  status?: LeadStatus;
  pageId?: number;
  search?: string;
  minScore?: number;
  limit: number;
  offset: number;
}

export interface LeadListItem {
  id: number;
  sourceCommentId: number | null;
  status: LeadStatus;
  intentLevel: string | null;
  intentType: string | null;
  score: number;
  summary: string | null;
  note: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  pageId: number;
  pageName: string;
  facebookPostId: string;
  postPermalinkUrl: string | null;
  authorName: string | null;
  commentMessage: string | null;
  commentCreatedTime: string | null;
}

export interface LeadListResult {
  items: LeadListItem[];
  total: number;
}

type LeadRow = {
  id: number;
  source_comment_id: number | null;
  status: LeadStatus;
  intent_level: string | null;
  intent_type: string | null;
  score: number;
  summary: string | null;
  note: string | null;
  tags_json: string | null;
  created_at: string;
  updated_at: string;
  page_id: number;
  page_name: string;
  facebook_post_id: string;
  post_permalink_url: string | null;
  author_name: string | null;
  comment_message: string | null;
  comment_created_time: string | null;
};

function parseTags(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function mapLeadRow(row: LeadRow): LeadListItem {
  return {
    id: row.id,
    sourceCommentId: row.source_comment_id,
    status: row.status,
    intentLevel: row.intent_level,
    intentType: row.intent_type,
    score: row.score,
    summary: row.summary,
    note: row.note,
    tags: parseTags(row.tags_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pageId: row.page_id,
    pageName: row.page_name,
    facebookPostId: row.facebook_post_id,
    postPermalinkUrl: row.post_permalink_url,
    authorName: row.author_name,
    commentMessage: row.comment_message,
    commentCreatedTime: row.comment_created_time
  };
}

export function upsertLeadFromComment(
  sourceCommentId: number,
  classification: LeadClassificationInput
): number {
  return upsertLeadFromCommentInDatabase(getDatabase().sqlite, sourceCommentId, classification);
}

export function upsertLeadFromCommentInDatabase(
  sqlite: Database.Database,
  sourceCommentId: number,
  classification: LeadClassificationInput
): number {
  const existing = sqlite
    .prepare('SELECT id FROM leads WHERE source_comment_id = ?')
    .get(sourceCommentId) as { id: number } | undefined;

  if (existing) {
    sqlite
      .prepare(
        `UPDATE leads
         SET intent_level = @intentLevel,
             intent_type = @intentType,
             score = @score,
             summary = @summary,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = @id`
      )
      .run({ id: existing.id, ...classification });
    return existing.id;
  }

  const result = sqlite
    .prepare(
      `INSERT INTO leads (
        source_type, source_comment_id, intent_level, intent_type, score, summary
      ) VALUES (
        'FACEBOOK_COMMENT', @sourceCommentId, @intentLevel, @intentType, @score, @summary
      )`
    )
    .run({ sourceCommentId, ...classification });

  return Number(result.lastInsertRowid);
}

export interface LeadHistoryItem {
  id: number;
  leadId: number;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

export function recordLeadHistoryInDatabase(
  sqlite: Database.Database,
  leadId: number,
  action: string,
  oldValue: string | null,
  newValue: string | null
): void {
  sqlite
    .prepare(
      `INSERT INTO lead_history (lead_id, action, old_value, new_value)
       VALUES (?, ?, ?, ?)`
    )
    .run(leadId, action, oldValue, newValue);
}

export function getLeadHistory(leadId: number): LeadHistoryItem[] {
  return getLeadHistoryFromDatabase(getDatabase().sqlite, leadId);
}

export function getLeadHistoryFromDatabase(
  sqlite: Database.Database,
  leadId: number
): LeadHistoryItem[] {
  return sqlite
    .prepare(
      `SELECT id, lead_id AS leadId, action, old_value AS oldValue, new_value AS newValue, created_at AS createdAt
       FROM lead_history
       WHERE lead_id = ?
       ORDER BY id DESC`
    )
    .all(leadId) as LeadHistoryItem[];
}

export function updateLeadStatus(id: number, status: LeadStatus): void {
  updateLeadStatusInDatabase(getDatabase().sqlite, id, status);
}

export function updateLeadStatusInDatabase(
  sqlite: Database.Database,
  id: number,
  status: LeadStatus
): void {
  sqlite.transaction(() => {
    const current = sqlite.prepare('SELECT status FROM leads WHERE id = ?').get(id) as
      | { status: LeadStatus }
      | undefined;
    if (!current) throw new Error('Lead not found.');

    if (current.status !== status) {
      sqlite.prepare('UPDATE leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
      recordLeadHistoryInDatabase(sqlite, id, 'STATUS_CHANGED', current.status, status);
    }
  })();
}

export function updateLeadDetails(id: number, note: string | null, tags: string[]): void {
  updateLeadDetailsInDatabase(getDatabase().sqlite, id, note, tags);
}

export function updateLeadDetailsInDatabase(
  sqlite: Database.Database,
  id: number,
  note: string | null,
  tags: string[]
): void {
  sqlite.transaction(() => {
    const current = sqlite.prepare('SELECT note, tags_json FROM leads WHERE id = ?').get(id) as
      | { note: string | null; tags_json: string }
      | undefined;
    if (!current) throw new Error('Lead not found.');

    const newTagsJson = JSON.stringify(tags);
    if (current.note === note && current.tags_json === newTagsJson) return;

    sqlite.prepare('UPDATE leads SET note = ?, tags_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(note, newTagsJson, id);

    if (current.note !== note) {
      recordLeadHistoryInDatabase(sqlite, id, 'NOTE_UPDATED', current.note, note);
    }
    if (current.tags_json !== newTagsJson) {
      recordLeadHistoryInDatabase(sqlite, id, 'TAGS_UPDATED', current.tags_json, newTagsJson);
    }
  })();
}

export function bulkUpdateLeadStatus(ids: number[], status: LeadStatus): { updated: number } {
  return bulkUpdateLeadStatusInDatabase(getDatabase().sqlite, ids, status);
}

export function bulkUpdateLeadStatusInDatabase(
  sqlite: Database.Database,
  ids: number[],
  status: LeadStatus
): { updated: number } {
  if (ids.length === 0) return { updated: 0 };

  const getStmt = sqlite.prepare('SELECT id, status FROM leads WHERE id = ?');
  const updateStmt = sqlite.prepare('UPDATE leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  const historyStmt = sqlite.prepare(
    'INSERT INTO lead_history (lead_id, action, old_value, new_value) VALUES (?, ?, ?, ?)'
  );

  let updated = 0;
  const runTransaction = sqlite.transaction(() => {
    for (const id of ids) {
      const current = getStmt.get(id) as { id: number; status: LeadStatus } | undefined;
      if (current && current.status !== status) {
        updateStmt.run(status, id);
        historyStmt.run(id, 'BULK_STATUS_CHANGED', current.status, status);
        updated += 1;
      }
    }
  });

  runTransaction();
  return { updated };
}

export function bulkAddLeadTags(ids: number[], newTags: string[]): { updated: number } {
  return bulkAddLeadTagsInDatabase(getDatabase().sqlite, ids, newTags);
}

export function bulkAddLeadTagsInDatabase(
  sqlite: Database.Database,
  ids: number[],
  newTags: string[]
): { updated: number } {
  if (ids.length === 0 || newTags.length === 0) return { updated: 0 };

  const cleanNewTags = newTags.map((t) => t.trim()).filter(Boolean);
  if (cleanNewTags.length === 0) return { updated: 0 };

  const getStmt = sqlite.prepare('SELECT id, tags_json FROM leads WHERE id = ?');
  const updateStmt = sqlite.prepare('UPDATE leads SET tags_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  const historyStmt = sqlite.prepare(
    'INSERT INTO lead_history (lead_id, action, old_value, new_value) VALUES (?, ?, ?, ?)'
  );

  let updated = 0;
  const runTransaction = sqlite.transaction(() => {
    for (const id of ids) {
      const current = getStmt.get(id) as { id: number; tags_json: string } | undefined;
      if (!current) continue;

      const existingTags = parseTags(current.tags_json);
      const tagSet = new Set(existingTags);
      let changed = false;

      for (const tag of cleanNewTags) {
        if (!tagSet.has(tag)) {
          tagSet.add(tag);
          changed = true;
        }
      }

      if (changed) {
        const merged = Array.from(tagSet);
        const mergedJson = JSON.stringify(merged);
        updateStmt.run(mergedJson, id);
        historyStmt.run(id, 'BULK_TAGS_ADDED', current.tags_json, mergedJson);
        updated += 1;
      }
    }
  });

  runTransaction();
  return { updated };
}

export function listLeads(query: LeadListQuery): LeadListResult {
  return listLeadsFromDatabase(getDatabase().sqlite, query);
}

export function listLeadsFromDatabase(
  sqlite: Database.Database,
  query: LeadListQuery
): LeadListResult {
  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (query.status) {
    clauses.push('l.status = ?');
    params.push(query.status);
  }
  if (query.pageId) {
    clauses.push('p.page_id = ?');
    params.push(query.pageId);
  }
  if (typeof query.minScore === 'number') {
    clauses.push('l.score >= ?');
    params.push(query.minScore);
  }
  if (query.search?.trim()) {
    clauses.push(
      '(COALESCE(c.author_name, \'\') LIKE ? OR COALESCE(c.message, \'\') LIKE ? OR COALESCE(pg.name, \'\') LIKE ?)'
    );
    const search = `%${query.search.trim()}%`;
    params.push(search, search, search);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const from = `
    FROM leads l
    JOIN facebook_comments c ON c.id = l.source_comment_id
    JOIN facebook_posts p ON p.id = c.post_id
    JOIN facebook_pages pg ON pg.id = p.page_id
  `;

  const totalRow = sqlite
    .prepare(`SELECT COUNT(*) AS total ${from} ${where}`)
    .get(...params) as { total: number };

  const rows = sqlite
    .prepare(
      `SELECT
        l.id, l.source_comment_id, l.status, l.intent_level, l.intent_type, l.score,
        l.summary, l.note, l.tags_json, l.created_at, l.updated_at,
        pg.id AS page_id, pg.name AS page_name,
        p.facebook_post_id, p.permalink_url AS post_permalink_url,
        c.author_name, c.message AS comment_message, c.created_time AS comment_created_time
       ${from}
       ${where}
       ORDER BY COALESCE(c.created_time, l.created_at) DESC, l.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, query.limit, query.offset) as LeadRow[];

  return {
    items: rows.map(mapLeadRow),
    total: totalRow.total
  };
}
