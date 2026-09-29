import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { dialog, ipcMain } from 'electron';
import { z } from 'zod';
import {
  leadBulkAddTagsInputSchema,
  leadBulkMutationResultSchema,
  leadBulkStatusUpdateInputSchema,
  leadDetailsUpdateInputSchema,
  leadExportInputSchema,
  leadExportResultSchema,
  leadHistoryResultSchema,
  leadListQuerySchema,
  leadListResultSchema,
  leadMutationResultSchema,
  leadStatusUpdateInputSchema,
  safeResultSchema
} from '@shared/schemas/ipc';
import { IPC_CHANNELS } from '@shared/constants/ipc';
import {
  bulkAddLeadTags,
  bulkUpdateLeadStatus,
  getLeadHistory,
  listLeads,
  updateLeadDetails,
  updateLeadStatus
} from '../database/leads.repository';
import { serializeLeadsCsv } from '../export/leads-csv';
import { generateLeadsXlsx, suggestedExportFileName } from '../export/leads-excel';
import { toSafeError } from './errors';

const EXPORT_LIMIT = 50_000;

export function registerLeadsIpc(): void {
  ipcMain.handle(IPC_CHANNELS.LEADS_LIST, (_event, input: unknown) => {
    try {
      const query = leadListQuerySchema.parse(input ?? {});
      const data = leadListResultSchema.parse(listLeads(query));
      return safeResultSchema(leadListResultSchema).parse({ success: true, data });
    } catch (error) {
      console.error('Leads query failed', error);
      return { success: false, error: toSafeError('DATABASE_ERROR', 'Không thể tải danh sách khách hàng tiềm năng.') } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.LEADS_UPDATE_STATUS, (_event, input: unknown) => {
    try {
      const { id, status } = leadStatusUpdateInputSchema.parse(input);
      updateLeadStatus(id, status);
      const data = leadMutationResultSchema.parse({ updated: true });
      return safeResultSchema(leadMutationResultSchema).parse({ success: true, data });
    } catch (error) {
      console.error('Lead status update failed', error);
      return { success: false, error: toSafeError('LEAD_UPDATE_FAILED', 'Không thể cập nhật trạng thái khách hàng.') } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.LEADS_UPDATE_DETAILS, (_event, input: unknown) => {
    try {
      const { id, note, tags } = leadDetailsUpdateInputSchema.parse(input);
      updateLeadDetails(id, note, [...new Set(tags)]);
      const data = leadMutationResultSchema.parse({ updated: true });
      return safeResultSchema(leadMutationResultSchema).parse({ success: true, data });
    } catch (error) {
      console.error('Lead details update failed', error);
      return { success: false, error: toSafeError('LEAD_UPDATE_FAILED', 'Không thể lưu ghi chú hoặc nhãn.') } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.LEADS_BULK_UPDATE_STATUS, (_event, input: unknown) => {
    try {
      const { ids, status } = leadBulkStatusUpdateInputSchema.parse(input);
      const result = bulkUpdateLeadStatus(ids, status);
      const data = leadBulkMutationResultSchema.parse(result);
      return safeResultSchema(leadBulkMutationResultSchema).parse({ success: true, data });
    } catch (error) {
      console.error('Lead bulk status update failed', error);
      return { success: false, error: toSafeError('LEAD_UPDATE_FAILED', 'Không thể cập nhật trạng thái hàng loạt.') } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.LEADS_BULK_ADD_TAGS, (_event, input: unknown) => {
    try {
      const { ids, tags } = leadBulkAddTagsInputSchema.parse(input);
      const result = bulkAddLeadTags(ids, tags);
      const data = leadBulkMutationResultSchema.parse(result);
      return safeResultSchema(leadBulkMutationResultSchema).parse({ success: true, data });
    } catch (error) {
      console.error('Lead bulk add tags failed', error);
      return { success: false, error: toSafeError('LEAD_UPDATE_FAILED', 'Không thể thêm nhãn hàng loạt.') } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.LEADS_GET_HISTORY, (_event, input: unknown) => {
    try {
      const { leadId } = z.object({ leadId: z.number().int().positive() }).parse(input);
      const items = getLeadHistory(leadId);
      const data = leadHistoryResultSchema.parse({ items });
      return safeResultSchema(leadHistoryResultSchema).parse({ success: true, data });
    } catch (error) {
      console.error('Lead get history failed', error);
      return { success: false, error: toSafeError('DATABASE_ERROR', 'Không thể tải lịch sử thay đổi.') } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.LEADS_EXPORT_CSV, async (_event, input: unknown) => {
    try {
      const filters = leadExportInputSchema.parse(input ?? {});
      const result = listLeads({ ...filters, limit: EXPORT_LIMIT, offset: 0 });
      if (result.total === 0) {
        return { success: false, error: toSafeError('EXPORT_EMPTY', 'Không có lead phù hợp để xuất. Hãy kiểm tra bộ lọc hoặc xem danh sách bình luận.') } as const;
      }
      const save = await dialog.showSaveDialog({
        title: 'Xuất danh sách khách hàng tiềm năng',
        defaultPath: suggestedExportFileName(new Date(), 'xlsx'),
        filters: [
          { name: 'Excel Workbook (*.xlsx)', extensions: ['xlsx'] },
          { name: 'CSV (Dấu phẩy, UTF-8) (*.csv)', extensions: ['csv'] }
        ]
      });
      if (save.canceled || !save.filePath) {
        const data = leadExportResultSchema.parse({ canceled: true, exported: 0, truncated: false });
        return safeResultSchema(leadExportResultSchema).parse({ success: true, data });
      }

      let targetPath = save.filePath.trim();
      const ext = extname(targetPath).toLowerCase();

      let format: 'xlsx' | 'csv';
      if (ext === '.xlsx') {
        format = 'xlsx';
      } else if (ext === '.csv') {
        format = 'csv';
      } else if (ext === '') {
        targetPath = `${targetPath}.xlsx`;
        format = 'xlsx';
      } else {
        return {
          success: false,
          error: toSafeError(
            'EXPORT_UNSUPPORTED_FORMAT',
            'Định dạng tệp không hợp lệ. Vui lòng chọn đuôi .xlsx (Excel) hoặc .csv.'
          )
        } as const;
      }

      if (existsSync(targetPath)) {
        return {
          success: false,
          error: toSafeError(
            'EXPORT_FILE_EXISTS',
            'Tệp đã tồn tại. Hãy nhập tên mới để không ghi đè hoặc làm mất dữ liệu của bạn.'
          )
        } as const;
      }

      if (format === 'xlsx') {
        const buffer = await generateLeadsXlsx(result.items);
        await writeFile(targetPath, buffer, { flag: 'wx' });
      } else {
        await writeFile(targetPath, serializeLeadsCsv(result.items, ','), { encoding: 'utf8', flag: 'wx' });
      }

      const data = leadExportResultSchema.parse({
        canceled: false,
        exported: result.items.length,
        truncated: result.total > result.items.length,
        filePath: targetPath
      });
      return safeResultSchema(leadExportResultSchema).parse({ success: true, data });
    } catch (error) {
      console.error('Lead export failed', error);
      if (error instanceof Error && 'code' in error) {
        if (error.code === 'EEXIST') {
          return {
            success: false,
            error: toSafeError(
              'EXPORT_FILE_EXISTS',
              'Tệp đã tồn tại. Hãy nhập tên mới để không ghi đè hoặc làm mất dữ liệu của bạn.'
            )
          } as const;
        }
        if (error.code === 'EBUSY' || error.code === 'EPERM') {
          return {
            success: false,
            error: toSafeError(
              'EXPORT_FILE_LOCKED',
              'Tệp đang được mở trong Excel hoặc bị khóa. Hãy đóng tệp hoặc chọn tên khác rồi xuất lại.'
            )
          } as const;
        }
      }
      return { success: false, error: toSafeError('EXPORT_FAILED', 'Không thể xuất tệp dữ liệu.') } as const;
    }
  });
}
