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
  LeadListResult,
  OpenExternalResult,
  MetaConnectionStatus,
  PageSyncResult,
  PagesListResult,
  PostListResult,
  ReportSummary,
  SafeResult
} from '@shared/types/ipc';

async function invokeSafe<T>(channel: string, input?: unknown): Promise<SafeResult<T>> {
  return ipcRenderer.invoke(channel, input) as Promise<SafeResult<T>>;
}

export const fsiApi: FsiApi = {
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
    saveDevelopmentToken: (token: string) =>
      invokeSafe<MetaConnectionStatus>(IPC_CHANNELS.META_SAVE_DEVELOPMENT_TOKEN, { token }),
    disconnect: () => invokeSafe<MetaConnectionStatus>(IPC_CHANNELS.META_DISCONNECT),
    testConnection: () => invokeSafe<MetaConnectionStatus>(IPC_CHANNELS.META_TEST_CONNECTION),
    getAccessiblePages: () =>
      invokeSafe<AccessiblePagesResult>(IPC_CHANNELS.META_GET_ACCESSIBLE_PAGES),
    importPage: (pageId: string) =>
      invokeSafe<FacebookPageRecord>(IPC_CHANNELS.META_IMPORT_PAGE, { pageId }),
    syncPage: (pageId: string) =>
      invokeSafe<PageSyncResult>(IPC_CHANNELS.META_SYNC_PAGE, { pageId })
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
    exportCsv: (query = {}) =>
      invokeSafe<LeadExportResult>(IPC_CHANNELS.LEADS_EXPORT_CSV, query)
  },
  reports: {
    getSummary: () => invokeSafe<ReportSummary>(IPC_CHANNELS.REPORTS_GET_SUMMARY)
  }
};
