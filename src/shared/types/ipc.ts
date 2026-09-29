import type { z } from 'zod';
import type {
  dashboardStatsSchema,
  accessiblePagesSchema,
  facebookPageRecordSchema,
  facebookPageSummarySchema,
  healthStatusSchema,
  commentListResultSchema,
  leadExportResultSchema,
  leadListItemSchema,
  leadListResultSchema,
  leadStatusSchema,
  metaConnectionStatusSchema,
  openExternalResultSchema,
  pageSyncResultSchema,
  pagesListSchema,
  postListResultSchema,
  reportSummarySchema,
  leadHistoryItemSchema,
  syncCheckpointSchema,
  syncProgressEventSchema,
  safeErrorSchema,
  safeResultSchema
} from '../schemas/ipc';

export type SafeError = z.infer<typeof safeErrorSchema>;
export type SafeResult<T> = z.infer<ReturnType<typeof safeResultSchema<z.ZodType<T>>>>;
export type HealthStatus = z.infer<typeof healthStatusSchema>;
export type DashboardStats = z.infer<typeof dashboardStatsSchema>;
export type MetaConnectionStatus = z.infer<typeof metaConnectionStatusSchema>;
export type FacebookPageSummary = z.infer<typeof facebookPageSummarySchema>;
export type FacebookPageRecord = z.infer<typeof facebookPageRecordSchema>;
export type AccessiblePagesResult = z.infer<typeof accessiblePagesSchema>;
export type PagesListResult = z.infer<typeof pagesListSchema>;
export type PageSyncResult = z.infer<typeof pageSyncResultSchema>;
export type PostListResult = z.infer<typeof postListResultSchema>;
export type CommentListResult = z.infer<typeof commentListResultSchema>;
export type LeadStatus = z.infer<typeof leadStatusSchema>;
export type LeadListItem = z.infer<typeof leadListItemSchema>;
export type LeadListResult = z.infer<typeof leadListResultSchema>;
export type LeadExportResult = z.infer<typeof leadExportResultSchema>;
export type ReportSummary = z.infer<typeof reportSummarySchema>;
export type OpenExternalResult = z.infer<typeof openExternalResultSchema>;
export type LeadHistoryItem = z.infer<typeof leadHistoryItemSchema>;
export type SyncProgressEvent = z.infer<typeof syncProgressEventSchema>;
export type SyncCheckpoint = z.infer<typeof syncCheckpointSchema>;

export interface ListQuery {
  pageId?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CommentListQuery extends ListQuery {
  onlyLeads?: boolean;
}

export interface LeadListQuery extends ListQuery {
  status?: LeadStatus;
  minScore?: number;
}

export type LeadExportQuery = Omit<LeadListQuery, 'limit' | 'offset'>;

export interface FsiApi {
  system: {
    getHealth: () => Promise<SafeResult<HealthStatus>>;
    openExternal: (url: string) => Promise<SafeResult<OpenExternalResult>>;
  };
  dashboard: {
    getStats: () => Promise<SafeResult<DashboardStats>>;
  };
  meta: {
    getConnectionStatus: () => Promise<SafeResult<MetaConnectionStatus>>;
    connect: () => Promise<SafeResult<MetaConnectionStatus>>;
    reconnect: () => Promise<SafeResult<MetaConnectionStatus>>;
    disconnect: () => Promise<SafeResult<MetaConnectionStatus>>;
    testConnection: () => Promise<SafeResult<MetaConnectionStatus>>;
    getAccessiblePages: () => Promise<SafeResult<AccessiblePagesResult>>;
    importPage: (pageId: string) => Promise<SafeResult<FacebookPageRecord>>;
    syncPage: (pageId: string, options?: { resume?: boolean }) => Promise<SafeResult<PageSyncResult>>;
    cancelSync: (pageId: string) => Promise<SafeResult<{ cancelled: boolean }>>;
    getSyncCheckpoint: (pageId: string) => Promise<SafeResult<SyncCheckpoint | null>>;
    discardCheckpoint: (pageId: string) => Promise<SafeResult<{ discarded: true }>>;
    onSyncProgress: (callback: (progress: SyncProgressEvent) => void) => () => void;
    setDeveloperToken?: (token: string) => Promise<SafeResult<MetaConnectionStatus>>;
  };
  pages: {
    list: () => Promise<SafeResult<PagesListResult>>;
  };
  posts: {
    list: (query?: ListQuery) => Promise<SafeResult<PostListResult>>;
  };
  comments: {
    list: (query?: CommentListQuery) => Promise<SafeResult<CommentListResult>>;
  };
  leads: {
    list: (query?: LeadListQuery) => Promise<SafeResult<LeadListResult>>;
    updateStatus: (id: number, status: LeadStatus) => Promise<SafeResult<{ updated: true }>>;
    updateDetails: (id: number, note: string | null, tags: string[]) => Promise<SafeResult<{ updated: true }>>;
    bulkUpdateStatus: (ids: number[], status: LeadStatus) => Promise<SafeResult<{ updated: number }>>;
    bulkAddTags: (ids: number[], tags: string[]) => Promise<SafeResult<{ updated: number }>>;
    getHistory: (leadId: number) => Promise<SafeResult<{ items: LeadHistoryItem[] }>>;
    exportCsv: (query?: LeadExportQuery) => Promise<SafeResult<LeadExportResult>>;
  };
  reports: {
    getSummary: () => Promise<SafeResult<ReportSummary>>;
  };
}
