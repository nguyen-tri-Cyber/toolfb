import { ipcMain } from 'electron';
import { z } from 'zod';
import {
  accessiblePagesSchema,
  developerTokenInputSchema,
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

declare const __IS_DEV__: boolean | undefined;

function isDevelopmentMode(): boolean {
  if (typeof __IS_DEV__ !== 'undefined') return __IS_DEV__;
  return process.env.NODE_ENV !== 'production';
}

function metaSafeError(error: unknown) {
  const metaError = error instanceof MetaError ? error : toMetaError(error);
  console.error('Meta operation failed', {
    code: metaError.code,
    message: metaError.message
  });

  return toSafeError(metaError.code, toVietnameseMetaMessage(metaError.code));
}

export interface RegisterMetaIpcOptions {
  isDev?: boolean;
}

export function registerMetaIpc(options: RegisterMetaIpcOptions = {}): void {
  const isDev = options.isDev ?? isDevelopmentMode();

  if (isDev) {
    ipcMain.handle(IPC_CHANNELS.META_SET_DEVELOPER_TOKEN, async (_event, input: unknown) => {
      try {
        const { token } = developerTokenInputSchema.parse(input);
        const data = metaConnectionStatusSchema.parse(await metaService.setDeveloperToken(token));
        return safeResultSchema(metaConnectionStatusSchema).parse({ success: true, data });
      } catch (error) {
        return { success: false, error: metaSafeError(error) } as const;
      }
    });
  }
  ipcMain.handle(IPC_CHANNELS.META_GET_CONNECTION_STATUS, () => {
    try {
      const data = metaConnectionStatusSchema.parse(metaService.getConnectionStatus());
      return safeResultSchema(metaConnectionStatusSchema).parse({ success: true, data });
    } catch (error) {
      return { success: false, error: metaSafeError(error) } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.META_CONNECT, async () => {
    try {
      const data = metaConnectionStatusSchema.parse(await metaService.connect());
      return safeResultSchema(metaConnectionStatusSchema).parse({ success: true, data });
    } catch (error) {
      return { success: false, error: metaSafeError(error) } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.META_RECONNECT, async () => {
    try {
      const data = metaConnectionStatusSchema.parse(await metaService.reconnect());
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
      const parsed = z
        .object({
          pageId: z.string().trim().regex(/^\d+$/, 'Facebook Page ID must be a numeric string.'),
          resume: z.boolean().optional()
        })
        .parse(input);

      const data = pageSyncResultSchema.parse(
        await pageSyncService.syncOwnedPage(parsed.pageId, {
          resume: parsed.resume,
          onProgress: (progress) => {
            try {
              _event.sender.send(IPC_CHANNELS.META_SYNC_PROGRESS, progress);
            } catch {
              // sender window might be closed
            }
          }
        })
      );
      return safeResultSchema(pageSyncResultSchema).parse({ success: true, data });
    } catch (error) {
      return { success: false, error: metaSafeError(error) } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.META_CANCEL_SYNC, (_event, input: unknown) => {
    try {
      const { pageId } = pageIdInputSchema.parse(input);
      return { success: true, data: { cancelled: pageSyncService.cancelSync(pageId) } } as const;
    } catch (error) {
      return { success: false, error: metaSafeError(error) } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.META_GET_SYNC_CHECKPOINT, (_event, input: unknown) => {
    try {
      const { pageId } = pageIdInputSchema.parse(input);
      const checkpoint = pageSyncService.getSavedCheckpoint(pageId);
      return { success: true, data: checkpoint } as const;
    } catch (error) {
      return { success: false, error: metaSafeError(error) } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.META_DISCARD_CHECKPOINT, (_event, input: unknown) => {
    try {
      const { pageId } = pageIdInputSchema.parse(input);
      pageSyncService.discardCheckpoint(pageId);
      return { success: true, data: { discarded: true } } as const;
    } catch (error) {
      return { success: false, error: metaSafeError(error) } as const;
    }
  });
}
