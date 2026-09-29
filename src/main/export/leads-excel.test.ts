import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { LeadListItem } from '../database/leads.repository';
import {
  generateLeadsXlsx,
  sanitizeFormulaValue,
  suggestedExportFileName
} from './leads-excel';

describe('leads-excel export', () => {
  it('formats suggestedExportFileName with non-colliding timestamp and extension', () => {
    const fixedDate = new Date(2026, 8, 29, 16, 30, 45, 123);
    const xlsxName = suggestedExportFileName(fixedDate, 'xlsx');
    expect(xlsxName).toBe('facebook-leads-2026-09-29-16-30-45-123.xlsx');

    const csvName = suggestedExportFileName(fixedDate, 'csv');
    expect(csvName).toBe('facebook-leads-2026-09-29-16-30-45-123.csv');
  });

  it('sanitizes formula injection values starting with =, +, -, @', () => {
    expect(sanitizeFormulaValue('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
    expect(sanitizeFormulaValue('+12345')).toBe("'+12345");
    expect(sanitizeFormulaValue('-cmd.exe')).toBe("'-cmd.exe");
    expect(sanitizeFormulaValue('@evil.com')).toBe("'@evil.com");
    expect(sanitizeFormulaValue('Normal text')).toBe('Normal text');
    expect(sanitizeFormulaValue(123)).toBe(123);
  });

  it('generates a valid XLSX buffer with correct headers, rows, and preserved Vietnamese characters', async () => {
    const lead: LeadListItem = {
      id: 1,
      sourceCommentId: 101,
      status: 'NEW',
      intentLevel: 'HIGH',
      intentType: 'PRICE',
      score: 95,
      summary: null,
      note: '=HYPERLINK("http://attacker.com")',
      tags: ['vip', 'hà nội'],
      createdAt: '2026-09-29T10:00:00Z',
      updatedAt: '2026-09-29T10:00:00Z',
      pageId: 1,
      pageName: 'Phân bón & Nông nghiệp',
      facebookPostId: 'post-101',
      postPermalinkUrl: 'https://facebook.com/post-101',
      authorName: 'Nguyễn Văn Ánh',
      commentMessage: 'Báo giá cho tôi 5 bao phân vi sinh nhé shop!',
      commentCreatedTime: '2026-09-29T09:30:00Z'
    };

    const buffer = await generateLeadsXlsx([lead]);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);

    // Read back using ExcelJS to verify workbook structure
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const worksheet = workbook.getWorksheet('Danh sách Lead');
    expect(worksheet).toBeDefined();

    // Verify header row
    const headerRow = worksheet!.getRow(1);
    expect(headerRow.getCell(1).value).toBe('ID');
    expect(headerRow.getCell(2).value).toBe('Trang');
    expect(headerRow.getCell(3).value).toBe('Tác giả');
    expect(headerRow.getCell(4).value).toBe('Bình luận');
    expect(headerRow.getCell(5).value).toBe('Điểm');

    // Verify data row
    const dataRow = worksheet!.getRow(2);
    expect(dataRow.getCell(1).value).toBe(1);
    expect(dataRow.getCell(2).value).toBe('Phân bón & Nông nghiệp');
    expect(dataRow.getCell(3).value).toBe('Nguyễn Văn Ánh');
    expect(dataRow.getCell(4).value).toBe('Báo giá cho tôi 5 bao phân vi sinh nhé shop!');
    expect(dataRow.getCell(5).value).toBe(95);
    expect(dataRow.getCell(9).value).toBe('\'=HYPERLINK("http://attacker.com")');
    expect(dataRow.getCell(10).value).toBe('vip, hà nội');
  });

  it('can be opened directly by Microsoft Excel with 12 distinct columns and accurate Vietnamese text', async () => {
    const { execSync } = await import('node:child_process');
    const { unlinkSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    const lead: LeadListItem = {
      id: 2,
      sourceCommentId: 102,
      status: 'NEW',
      intentLevel: 'HIGH',
      intentType: 'PRICE',
      score: 90,
      summary: null,
      note: 'Khách cần gọi lại',
      tags: ['vip'],
      createdAt: '2026-09-29T10:00:00Z',
      updatedAt: '2026-09-29T10:00:00Z',
      pageId: 1,
      pageName: 'Phanbonshop',
      facebookPostId: 'post-102',
      postPermalinkUrl: 'https://facebook.com/post-102',
      authorName: 'Nguyễn Thị Hương',
      commentMessage: 'Giá bao nhiêu shop ơi?',
      commentCreatedTime: '2026-09-29T09:30:00Z'
    };

    const buffer = await generateLeadsXlsx([lead]);
    const tempFile = join(tmpdir(), `verify-excel-${Date.now()}.xlsx`);
    writeFileSync(tempFile, buffer);

    try {
      const psCommand = `powershell -ExecutionPolicy Bypass -Command "try { $excel = New-Object -ComObject Excel.Application } catch { Write-Output ('COM_UNAVAILABLE:' + $_.Exception.Message); exit 0 }; $excel.Visible = $false; $excel.DisplayAlerts = $false; try { $wb = $excel.Workbooks.Open('${tempFile.replace(/\\/g, '/')}'); $ws = $wb.Sheets.Item(1); [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Write-Output ('COLS:' + $ws.UsedRange.Columns.Count); Write-Output ('C1:' + $ws.Range('C1').Text); Write-Output ('C2:' + $ws.Range('C2').Text); Write-Output ('D2:' + $ws.Range('D2').Text); $wb.Close($false) } finally { $excel.Quit(); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null }"`;

      const output = execSync(psCommand, { encoding: 'utf8' });
      if (output.includes('COM_UNAVAILABLE:')) {
        console.warn('Skipping live Excel COM test: Windows logon session does not allow interactive COM automation:', output.trim());
        return;
      }
      expect(output).toContain('COLS:12');
      expect(output).toContain('C1:Tác giả');
      expect(output).toContain('C2:Nguyễn Thị Hương');
      expect(output).toContain('D2:Giá bao nhiêu shop ơi?');
    } finally {
      const { existsSync } = await import('node:fs');
      if (existsSync(tempFile)) {
        unlinkSync(tempFile);
      }
    }
  });
});
