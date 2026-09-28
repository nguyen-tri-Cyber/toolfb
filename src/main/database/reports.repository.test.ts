import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { getReportSummaryFromDatabase } from './reports.repository';

describe('reports.repository', () => {
  it('summarizes lead workflow and top posts', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
      CREATE TABLE facebook_pages (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE facebook_posts (
        id INTEGER PRIMARY KEY, page_id INTEGER NOT NULL, facebook_post_id TEXT NOT NULL,
        message TEXT, permalink_url TEXT
      );
      CREATE TABLE facebook_comments (id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL);
      CREATE TABLE leads (id INTEGER PRIMARY KEY, source_comment_id INTEGER, status TEXT NOT NULL);
      INSERT INTO facebook_pages VALUES (1, 'Shop A');
      INSERT INTO facebook_posts VALUES (1, 1, 'post-1', 'Bài A', 'https://facebook.com/post-1');
      INSERT INTO facebook_posts VALUES (2, 1, 'post-2', 'Bài B', 'https://facebook.com/post-2');
      INSERT INTO facebook_comments VALUES (1, 1), (2, 1), (3, 2);
      INSERT INTO leads VALUES (1, 1, 'WON'), (2, 2, 'QUALIFIED'), (3, 3, 'NEW');
    `);

    const result = getReportSummaryFromDatabase(sqlite);
    expect(result.totalLeads).toBe(3);
    expect(result.wonLeads).toBe(1);
    expect(result.conversionRate).toBe(33.3);
    expect(result.statusCounts).toMatchObject({ NEW: 1, QUALIFIED: 1, WON: 1 });
    expect(result.topPosts[0]).toMatchObject({ facebookPostId: 'post-1', leadCount: 2, wonCount: 1 });
  });
});
