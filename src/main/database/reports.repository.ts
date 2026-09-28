import type Database from 'better-sqlite3';
import { getDatabase } from './index';
import type { LeadStatus } from './leads.repository';

const STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST'];

export interface ReportSummary {
  totalLeads: number;
  wonLeads: number;
  conversionRate: number;
  statusCounts: Record<LeadStatus, number>;
  topPosts: Array<{
    postId: number;
    pageName: string;
    facebookPostId: string;
    message: string | null;
    permalinkUrl: string | null;
    leadCount: number;
    wonCount: number;
  }>;
}

export function getReportSummary(): ReportSummary {
  return getReportSummaryFromDatabase(getDatabase().sqlite);
}

export function getReportSummaryFromDatabase(sqlite: Database.Database): ReportSummary {
  const statusCounts = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<
    LeadStatus,
    number
  >;
  const rows = sqlite
    .prepare('SELECT status, COUNT(*) AS count FROM leads GROUP BY status')
    .all() as Array<{ status: LeadStatus; count: number }>;
  for (const row of rows) {
    if (STATUSES.includes(row.status)) statusCounts[row.status] = row.count;
  }

  const totalLeads = STATUSES.reduce((sum, status) => sum + statusCounts[status], 0);
  const wonLeads = statusCounts.WON;
  const conversionRate = totalLeads === 0 ? 0 : Math.round((wonLeads / totalLeads) * 1000) / 10;

  const topPosts = sqlite
    .prepare(
      `SELECT
        p.id AS postId,
        pg.name AS pageName,
        p.facebook_post_id AS facebookPostId,
        p.message,
        p.permalink_url AS permalinkUrl,
        COUNT(l.id) AS leadCount,
        SUM(CASE WHEN l.status = 'WON' THEN 1 ELSE 0 END) AS wonCount
       FROM leads l
       JOIN facebook_comments c ON c.id = l.source_comment_id
       JOIN facebook_posts p ON p.id = c.post_id
       JOIN facebook_pages pg ON pg.id = p.page_id
       GROUP BY p.id, pg.name, p.facebook_post_id, p.message, p.permalink_url
       ORDER BY leadCount DESC, wonCount DESC, p.id DESC
       LIMIT 5`
    )
    .all() as ReportSummary['topPosts'];

  return { totalLeads, wonLeads, conversionRate, statusCounts, topPosts };
}
