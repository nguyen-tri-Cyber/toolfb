import { ipcMain } from 'electron';
import { dashboardStatsSchema, safeResultSchema } from '@shared/schemas/ipc';
import { IPC_CHANNELS } from '@shared/constants/ipc';
import { getDashboardStatistics } from '../services/system.service';
import { toSafeError } from './errors';

export function registerDatabaseIpc(): void {
  ipcMain.handle(IPC_CHANNELS.DASHBOARD_GET_STATS, () => {
    try {
      const result = {
        success: true,
        data: dashboardStatsSchema.parse(getDashboardStatistics())
      } as const;

      return safeResultSchema(dashboardStatsSchema).parse(result);
    } catch (error) {
      console.error('Dashboard stats query failed', error);
      return {
        success: false,
        error: toSafeError('DATABASE_ERROR', 'Unable to query local database.')
      } as const;
    }
  });
}
