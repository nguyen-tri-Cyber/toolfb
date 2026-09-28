import { ipcMain, shell } from 'electron';
import {
  externalUrlInputSchema,
  healthStatusSchema,
  openExternalResultSchema,
  safeResultSchema
} from '@shared/schemas/ipc';
import { IPC_CHANNELS } from '@shared/constants/ipc';
import { getHealthStatus } from '../services/system.service';
import { toSafeError } from './errors';

export function registerSystemIpc(): void {
  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_HEALTH, () => {
    try {
      const result = {
        success: true,
        data: healthStatusSchema.parse(getHealthStatus())
      } as const;

      return safeResultSchema(healthStatusSchema).parse(result);
    } catch (error) {
      console.error('System health check failed', error);
      return {
        success: false,
        error: toSafeError('SYSTEM_ERROR', 'Unable to read system health.')
      } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_OPEN_EXTERNAL, async (_event, input: unknown) => {
    try {
      const { url } = externalUrlInputSchema.parse(input);
      await shell.openExternal(url);
      const data = openExternalResultSchema.parse({ opened: true });
      return safeResultSchema(openExternalResultSchema).parse({ success: true, data });
    } catch (error) {
      console.error('Open external URL failed', error);
      return {
        success: false,
        error: toSafeError('INVALID_EXTERNAL_URL', 'Không thể mở liên kết bên ngoài này.')
      } as const;
    }
  });
}
