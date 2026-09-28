import { describe, expect, it } from 'vitest';
import type { LeadListItem } from '../database/leads.repository';
import { serializeLeadsCsv } from './leads-csv';

describe('serializeLeadsCsv', () => {
  it('escapes CSV content, writes BOM and neutralizes spreadsheet formulas', () => {
    const lead: LeadListItem = {
      id: 1,
      sourceCommentId: 2,
      status: 'NEW',
      intentLevel: 'HIGH',
      intentType: 'BUY',
      score: 90,
      summary: null,
      note: '=HYPERLINK("bad")',
      tags: ['vip', 'mới'],
      createdAt: '2026-09-28',
      updatedAt: '2026-09-28',
      pageId: 1,
      pageName: 'Shop, A',
      facebookPostId: 'post-1',
      postPermalinkUrl: 'https://facebook.com/post-1',
      authorName: 'Khách "A"',
      commentMessage: 'Mua 2 bao\nship giúp',
      commentCreatedTime: '2026-09-28T02:00:00Z'
    };

    const csv = serializeLeadsCsv([lead]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Shop, A"');
    expect(csv).toContain('"Khách ""A"""');
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('"Mua 2 bao\nship giúp"');
  });
});
