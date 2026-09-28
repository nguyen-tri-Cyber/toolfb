import { writeFile } from 'node:fs/promises';
import { dialog, ipcMain } from 'electron';
import {
  leadDetailsUpdateInputSchema,
  leadExportInputSchema,
  leadExportResultSchema,
  leadListQuerySchema,
  leadListResultSchema,
  leadMutationResultSchema,
  leadStatusUpdateInputSchema,
  safeResultSchema
} from '@shared/schemas/ipc';
import { IPC_CHANNELS } from '@shared/constants/ipc';
import { listLeads, updateLeadDetails, updateLeadStatus } from '../database/leads.repository';
import { serializeLeadsCsv } from '../export/leads-csv';
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

  ipcMain.handle(IPC_CHANNELS.LEADS_EXPORT_CSV, async (_event, input: unknown) => {
    try {
      const filters = leadExportInputSchema.parse(input ?? {});
      const result = listLeads({ ...filters, limit: EXPORT_LIMIT, offset: 0 });
      const save = await dialog.showSaveDialog({
        title: 'Xuất khách hàng tiềm năng',
        defaultPath: `facebook-leads-${new Date().toISOString().slice(0, 10)}.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      });
      if (save.canceled || !save.filePath) {
        const data = leadExportResultSchema.parse({ canceled: true, exported: 0, truncated: false });
        return safeResultSchema(leadExportResultSchema).parse({ success: true, data });
      }

      await writeFile(save.filePath, serializeLeadsCsv(result.items), 'utf8');
      const data = leadExportResultSchema.parse({
        canceled: false,
        exported: result.items.length,
        truncated: result.total > result.items.length,
        filePath: save.filePath
      });
      return safeResultSchema(leadExportResultSchema).parse({ success: true, data });
    } catch (error) {
      console.error('Lead CSV export failed', error);
      return { success: false, error: toSafeError('EXPORT_FAILED', 'Không thể xuất tệp CSV.') } as const;
    }
  });
}
