import type { LeadListItem } from '../database/leads.repository';

const HEADERS = [
  'ID',
  'Trang',
  'Tác giả',
  'Bình luận',
  'Điểm',
  'Ý định',
  'Mức độ',
  'Trạng thái',
  'Ghi chú',
  'Nhãn',
  'Thời gian bình luận',
  'Liên kết bài viết'
];

function safeSpreadsheetValue(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function escapeCsv(value: unknown): string {
  const stringValue = safeSpreadsheetValue(value == null ? '' : String(value));
  return `"${stringValue.replaceAll('"', '""')}"`;
}

export function serializeLeadsCsv(items: LeadListItem[]): string {
  const rows = items.map((lead) => [
    lead.id,
    lead.pageName,
    lead.authorName,
    lead.commentMessage,
    lead.score,
    lead.intentType,
    lead.intentLevel,
    lead.status,
    lead.note,
    lead.tags.join(', '),
    lead.commentCreatedTime,
    lead.postPermalinkUrl
  ]);

  return `\uFEFF${[HEADERS, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n')}`;
}
