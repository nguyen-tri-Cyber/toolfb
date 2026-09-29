import ExcelJS from 'exceljs';
import type { LeadListItem } from '../database/leads.repository';

export const EXPORT_HEADERS = [
  { header: 'ID', key: 'id', width: 10 },
  { header: 'Trang', key: 'pageName', width: 22 },
  { header: 'Tác giả', key: 'authorName', width: 22 },
  { header: 'Bình luận', key: 'commentMessage', width: 40 },
  { header: 'Điểm', key: 'score', width: 10 },
  { header: 'Ý định', key: 'intentType', width: 14 },
  { header: 'Mức độ', key: 'intentLevel', width: 14 },
  { header: 'Trạng thái', key: 'status', width: 16 },
  { header: 'Ghi chú', key: 'note', width: 30 },
  { header: 'Nhãn', key: 'tags', width: 25 },
  { header: 'Thời gian bình luận', key: 'commentCreatedTime', width: 24 },
  { header: 'Liên kết bài viết', key: 'postPermalinkUrl', width: 36 }
];

export function sanitizeFormulaValue(value: unknown): unknown {
  if (typeof value === 'string' && /^[=+\-@]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

export function suggestedExportFileName(now: Date, ext: 'xlsx' | 'csv' = 'xlsx'): string {
  const pad = (value: number, width = 2): string => String(value).padStart(width, '0');
  const timestamp = [
    pad(now.getFullYear(), 4),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
    pad(now.getMilliseconds(), 3)
  ].join('-');
  return `facebook-leads-${timestamp}.${ext}`;
}

export async function generateLeadsXlsx(items: LeadListItem[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Facebook Sales Intelligence';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Danh sách Lead', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  worksheet.columns = EXPORT_HEADERS;

  const headerRow = worksheet.getRow(1);
  headerRow.height = 24;
  headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' } // Tailwind blue-900
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  for (const lead of items) {
    const row = worksheet.addRow({
      id: lead.id,
      pageName: sanitizeFormulaValue(lead.pageName),
      authorName: sanitizeFormulaValue(lead.authorName),
      commentMessage: sanitizeFormulaValue(lead.commentMessage),
      score: lead.score,
      intentType: sanitizeFormulaValue(lead.intentType),
      intentLevel: sanitizeFormulaValue(lead.intentLevel),
      status: sanitizeFormulaValue(lead.status),
      note: sanitizeFormulaValue(lead.note ?? ''),
      tags: sanitizeFormulaValue(lead.tags.join(', ')),
      commentCreatedTime: lead.commentCreatedTime,
      postPermalinkUrl: sanitizeFormulaValue(lead.postPermalinkUrl)
    });
    row.height = 20;
    row.alignment = { vertical: 'middle' };
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
