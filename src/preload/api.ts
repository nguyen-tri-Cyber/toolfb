import { ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '@shared/constants/ipc';
import type {
  AccessiblePagesResult,
  DashboardStats,
  FacebookPageRecord,
  FsiApi,
  HealthStatus,
  CommentListResult,
  LeadExportResult,
  LeadHistoryItem,
  LeadListResult,
  OpenExternalResult,
  MetaConnectionStatus,
  PageSyncResult,
  PagesListResult,
  PostListResult,
  ReportSummary,
  SafeResult,
  SyncCheckpoint,
  SyncProgressEvent
} from '@shared/types/ipc';

async function invokeSafe<T>(channel: string, input?: unknown): Promise<SafeResult<T>> {
  return ipcRenderer.invoke(channel, input) as Promise<SafeResult<T>>;
}

export function createFsiApi(isDev: boolean): FsiApi {
  const api: FsiApi = {
    system: {
      getHealth: () => invokeSafe<HealthStatus>(IPC_CHANNELS.SYSTEM_GET_HEALTH),
      openExternal: (url: string) =>
        invokeSafe<OpenExternalResult>(IPC_CHANNELS.SYSTEM_OPEN_EXTERNAL, { url })
    },
    dashboard: {
      getStats: () => invokeSafe<DashboardStats>(IPC_CHANNELS.DASHBOARD_GET_STATS)
    },
    meta: {
      getConnectionStatus: () =>
        invokeSafe<MetaConnectionStatus>(IPC_CHANNELS.META_GET_CONNECTION_STATUS),
      connect: () => invokeSafe<MetaConnectionStatus>(IPC_CHANNELS.META_CONNECT),
      reconnect: () => invokeSafe<MetaConnectionStatus>(IPC_CHANNELS.META_RECONNECT),
      disconnect: () => invokeSafe<MetaConnectionStatus>(IPC_CHANNELS.META_DISCONNECT),
      testConnection: () => invokeSafe<MetaConnectionStatus>(IPC_CHANNELS.META_TEST_CONNECTION),
      getAccessiblePages: () =>
        invokeSafe<AccessiblePagesResult>(IPC_CHANNELS.META_GET_ACCESSIBLE_PAGES),
      importPage: (pageId: string) =>
        invokeSafe<FacebookPageRecord>(IPC_CHANNELS.META_IMPORT_PAGE, { pageId }),
      syncPage: (pageId: string, options?: { resume?: boolean }) =>
        invokeSafe<PageSyncResult>(IPC_CHANNELS.META_SYNC_PAGE, { pageId, resume: options?.resume }),
      cancelSync: (pageId: string) =>
        invokeSafe<{ cancelled: boolean }>(IPC_CHANNELS.META_CANCEL_SYNC, { pageId }),
      getSyncCheckpoint: (pageId: string) =>
        invokeSafe<SyncCheckpoint | null>(IPC_CHANNELS.META_GET_SYNC_CHECKPOINT, { pageId }),
      discardCheckpoint: (pageId: string) =>
        invokeSafe<{ discarded: true }>(IPC_CHANNELS.META_DISCARD_CHECKPOINT, { pageId }),
      onSyncProgress: (callback: (progress: SyncProgressEvent) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, progress: SyncProgressEvent) => {
          callback(progress);
        };
        ipcRenderer.on(IPC_CHANNELS.META_SYNC_PROGRESS, handler);
        return () => {
          ipcRenderer.removeListener(IPC_CHANNELS.META_SYNC_PROGRESS, handler);
        };
      }
    },
    pages: {
      list: () => invokeSafe<PagesListResult>(IPC_CHANNELS.PAGES_LIST)
    },
    posts: {
      list: (query = {}) => invokeSafe<PostListResult>(IPC_CHANNELS.POSTS_LIST, query)
    },
    comments: {
      list: (query = {}) => invokeSafe<CommentListResult>(IPC_CHANNELS.COMMENTS_LIST, query)
    },
    leads: {
      list: (query = {}) => invokeSafe<LeadListResult>(IPC_CHANNELS.LEADS_LIST, query),
      updateStatus: (id, status) =>
        invokeSafe<{ updated: true }>(IPC_CHANNELS.LEADS_UPDATE_STATUS, { id, status }),
      updateDetails: (id, note, tags) =>
        invokeSafe<{ updated: true }>(IPC_CHANNELS.LEADS_UPDATE_DETAILS, { id, note, tags }),
      bulkUpdateStatus: (ids, status) =>
        invokeSafe<{ updated: number }>(IPC_CHANNELS.LEADS_BULK_UPDATE_STATUS, { ids, status }),
      bulkAddTags: (ids, tags) =>
        invokeSafe<{ updated: number }>(IPC_CHANNELS.LEADS_BULK_ADD_TAGS, { ids, tags }),
      getHistory: (leadId) =>
        invokeSafe<{ items: LeadHistoryItem[] }>(IPC_CHANNELS.LEADS_GET_HISTORY, { leadId }),
      exportCsv: (query = {}) =>
        invokeSafe<LeadExportResult>(IPC_CHANNELS.LEADS_EXPORT_CSV, query)
    },
    reports: {
      getSummary: () => invokeSafe<ReportSummary>(IPC_CHANNELS.REPORTS_GET_SUMMARY)
    }
  };

  if (isDev) {
    api.meta.setDeveloperToken = (token: string) =>
      invokeSafe<MetaConnectionStatus>(IPC_CHANNELS.META_SET_DEVELOPER_TOKEN, { token });
  }

  return api;
}

export const fsiApi: FsiApi = createFsiApi(process.env.NODE_ENV !== 'production');
