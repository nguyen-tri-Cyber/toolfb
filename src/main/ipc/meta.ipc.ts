import { ipcMain } from 'electron';
import {
  accessiblePagesSchema,
  developmentTokenInputSchema,
  facebookPageRecordSchema,
  metaConnectionStatusSchema,
  pageSyncResultSchema,
  pageIdInputSchema,
  safeResultSchema
} from '@shared/schemas/ipc';
import { IPC_CHANNELS } from '@shared/constants/ipc';
import { MetaError, toMetaError, toVietnameseMetaMessage } from '../meta/meta.errors';
import { metaService } from '../meta/meta.service';
import { pageSyncService } from '../sync/page-sync.service';
import { toSafeError } from './errors';

function metaSafeError(error: unknown) {
  const metaError = error instanceof MetaError ? error : toMetaError(error);
  console.error('Meta operation failed', {
    code: metaError.code,
    message: metaError.message
  });

  return toSafeError(metaError.code, toVietnameseMetaMessage(metaError.code));
}

export function registerMetaIpc(): void {
  ipcMain.handle(IPC_CHANNELS.META_GET_CONNECTION_STATUS, () => {
    try {
      const data = metaConnectionStatusSchema.parse(metaService.getConnectionStatus());
      return safeResultSchema(metaConnectionStatusSchema).parse({ success: true, data });
    } catch (error) {
      return { success: false, error: metaSafeError(error) } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.META_SAVE_DEVELOPMENT_TOKEN, (_event, input: unknown) => {
    try {
      const { token } = developmentTokenInputSchema.parse(input);
      const data = metaConnectionStatusSchema.parse(metaService.saveDevelopmentToken(token));
      return safeResultSchema(metaConnectionStatusSchema).parse({ success: true, data });
    } catch (error) {
      return { success: false, error: metaSafeError(error) } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.META_DISCONNECT, () => {
    try {
      const data = metaConnectionStatusSchema.parse(metaService.disconnect());
      return safeResultSchema(metaConnectionStatusSchema).parse({ success: true, data });
    } catch (error) {
      return { success: false, error: metaSafeError(error) } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.META_TEST_CONNECTION, async () => {
    try {
      const data = metaConnectionStatusSchema.parse(await metaService.testConnection());
      return safeResultSchema(metaConnectionStatusSchema).parse({ success: true, data });
    } catch (error) {
      return { success: false, error: metaSafeError(error) } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.META_GET_ACCESSIBLE_PAGES, async () => {
    try {
      const pages = await metaService.getAccessiblePages();
      const data = accessiblePagesSchema.parse({ pages });
      return safeResultSchema(accessiblePagesSchema).parse({ success: true, data });
    } catch (error) {
      return { success: false, error: metaSafeError(error) } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.META_IMPORT_PAGE, async (_event, input: unknown) => {
    try {
      const { pageId } = pageIdInputSchema.parse(input);
      const data = facebookPageRecordSchema.parse(await metaService.importPage(pageId));
      return safeResultSchema(facebookPageRecordSchema).parse({ success: true, data });
    } catch (error) {
      return { success: false, error: metaSafeError(error) } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.META_SYNC_PAGE, async (_event, input: unknown) => {
    try {
      const { pageId } = pageIdInputSchema.parse(input);
      const data = pageSyncResultSchema.parse(await pageSyncService.syncOwnedPage(pageId));
      return safeResultSchema(pageSyncResultSchema).parse({ success: true, data });
    } catch (error) {
      return { success: false, error: metaSafeError(error) } as const;
    }
  });
}
