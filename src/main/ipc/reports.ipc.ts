import { ipcMain } from 'electron';
import { reportSummarySchema, safeResultSchema } from '@shared/schemas/ipc';
import { IPC_CHANNELS } from '@shared/constants/ipc';
import { getReportSummary } from '../database/reports.repository';
import { toSafeError } from './errors';

export function registerReportsIpc(): void {
  ipcMain.handle(IPC_CHANNELS.REPORTS_GET_SUMMARY, () => {
    try {
      const data = reportSummarySchema.parse(getReportSummary());
      return safeResultSchema(reportSummarySchema).parse({ success: true, data });
    } catch (error) {
      console.error('Reports query failed', error);
      return { success: false, error: toSafeError('DATABASE_ERROR', 'Không thể tạo báo cáo từ dữ liệu cục bộ.') } as const;
    }
  });
}
