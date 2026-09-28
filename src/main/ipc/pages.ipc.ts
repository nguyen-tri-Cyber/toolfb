import { ipcMain } from 'electron';
import { pagesListSchema, safeResultSchema } from '@shared/schemas/ipc';
import { IPC_CHANNELS } from '@shared/constants/ipc';
import { metaService } from '../meta/meta.service';
import { toSafeError } from './errors';

export function registerPagesIpc(): void {
  ipcMain.handle(IPC_CHANNELS.PAGES_LIST, () => {
    try {
      const data = pagesListSchema.parse({ pages: metaService.listImportedPages() });
      return safeResultSchema(pagesListSchema).parse({ success: true, data });
    } catch (error) {
      console.error('Local Facebook Pages query failed', error);
      return {
        success: false,
        error: toSafeError('DATABASE_ERROR', 'Không thể tải danh sách Trang Facebook đã lưu.')
      } as const;
    }
  });
}
