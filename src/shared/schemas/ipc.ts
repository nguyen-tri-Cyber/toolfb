import { z } from 'zod';

export const safeErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1)
});

export const safeResultSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.discriminatedUnion('success', [
    z.object({
      success: z.literal(true),
      data: dataSchema
    }),
    z.object({
      success: z.literal(false),
      error: safeErrorSchema
    })
  ]);

export const healthStatusSchema = z.object({
  desktop: z.boolean(),
  database: z.boolean(),
  facebook: z.boolean(),
  meta: z.enum(['CONNECTED', 'DISCONNECTED', 'ERROR'])
});

export const dashboardStatsSchema = z.object({
  pages: z.number().int().nonnegative(),
  posts: z.number().int().nonnegative(),
  comments: z.number().int().nonnegative(),
  leads: z.number().int().nonnegative()
});

export const facebookPageSummarySchema = z.object({
  facebookPageId: z.string().min(1),
  name: z.string().min(1),
  category: z.string().optional(),
  pictureUrl: z.string().url().optional(),
  imported: z.boolean().default(false)
});

export const facebookPageRecordSchema = facebookPageSummarySchema.extend({
  id: z.number().int().positive(),
  username: z.string().nullable(),
  isOwned: z.boolean(),
  syncEnabled: z.boolean(),
  lastSyncedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const metaConnectionStatusSchema = z.object({
  state: z.enum(['disconnected', 'connecting', 'connected', 'expired', 'revoked', 'permission_missing', 'error']),
  connected: z.boolean(),
  encryptionAvailable: z.boolean(),
  checkedAt: z.string(),
  accountName: z.string().optional(),
  missingPermissions: z.array(z.string()).default([])
});

export const pageIdInputSchema = z.object({
  pageId: z.string().trim().regex(/^\d+$/, 'Facebook Page ID must be a numeric string.')
});

export const developerTokenInputSchema = z.object({
  token: z.string().trim().min(1, 'Access Token không được để trống.')
});

export const accessiblePagesSchema = z.object({
  pages: z.array(facebookPageSummarySchema)
});

export const pagesListSchema = z.object({
  pages: z.array(facebookPageRecordSchema)
});

export const pageSyncResultSchema = z.object({
  facebookPageId: z.string().min(1),
  postsProcessed: z.number().int().nonnegative(),
  commentsProcessed: z.number().int().nonnegative(),
  leadsDetected: z.number().int().nonnegative(),
  jobId: z.number().int().positive(),
  syncedAt: z.string().min(1)
});

const paginationSchema = z.object({
  pageId: z.number().int().positive().optional(),
  search: z.string().trim().max(200).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().nonnegative().default(0)
});

export const postListQuerySchema = paginationSchema;

export const postListItemSchema = z.object({
  id: z.number().int().positive(),
  pageId: z.number().int().positive(),
  pageName: z.string(),
  facebookPostId: z.string(),
  message: z.string().nullable(),
  permalinkUrl: z.string().url().nullable(),
  createdTime: z.string().nullable(),
  reactionsCount: z.number().int().nonnegative(),
  commentsCount: z.number().int().nonnegative(),
  sharesCount: z.number().int().nonnegative()
});

export const postListResultSchema = z.object({
  items: z.array(postListItemSchema),
  total: z.number().int().nonnegative()
});

export const commentListQuerySchema = paginationSchema.extend({
  onlyLeads: z.boolean().optional()
});

export const leadStatusSchema = z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST']);

export const commentListItemSchema = z.object({
  id: z.number().int().positive(),
  pageId: z.number().int().positive(),
  pageName: z.string(),
  postId: z.number().int().positive(),
  facebookPostId: z.string(),
  postPermalinkUrl: z.string().url().nullable(),
  facebookCommentId: z.string(),
  authorName: z.string().nullable(),
  message: z.string().nullable(),
  createdTime: z.string().nullable(),
  likeCount: z.number().int().nonnegative(),
  leadId: z.number().int().positive().nullable(),
  leadStatus: leadStatusSchema.nullable(),
  leadScore: z.number().int().min(0).max(100).nullable()
});

export const commentListResultSchema = z.object({
  items: z.array(commentListItemSchema),
  total: z.number().int().nonnegative()
});

export const leadListQuerySchema = paginationSchema.extend({
  status: leadStatusSchema.optional(),
  minScore: z.number().int().min(0).max(100).optional()
});

export const leadListItemSchema = z.object({
  id: z.number().int().positive(),
  sourceCommentId: z.number().int().positive().nullable(),
  status: leadStatusSchema,
  intentLevel: z.string().nullable(),
  intentType: z.string().nullable(),
  score: z.number().int().min(0).max(100),
  summary: z.string().nullable(),
  note: z.string().nullable(),
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  pageId: z.number().int().positive(),
  pageName: z.string(),
  facebookPostId: z.string(),
  postPermalinkUrl: z.string().url().nullable(),
  authorName: z.string().nullable(),
  commentMessage: z.string().nullable(),
  commentCreatedTime: z.string().nullable()
});

export const leadListResultSchema = z.object({
  items: z.array(leadListItemSchema),
  total: z.number().int().nonnegative()
});

export const leadStatusUpdateInputSchema = z.object({
  id: z.number().int().positive(),
  status: leadStatusSchema
});

export const leadDetailsUpdateInputSchema = z.object({
  id: z.number().int().positive(),
  note: z.string().trim().max(2000).nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10)
});

export const leadMutationResultSchema = z.object({ updated: z.literal(true) });

export const leadBulkStatusUpdateInputSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
  status: leadStatusSchema
});

export const leadBulkAddTagsInputSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
  tags: z.array(z.string().trim().min(1).max(40)).min(1).max(10)
});

export const leadBulkMutationResultSchema = z.object({
  updated: z.number().int().nonnegative()
});

export const leadHistoryItemSchema = z.object({
  id: z.number().int().positive(),
  leadId: z.number().int().positive(),
  action: z.string(),
  oldValue: z.string().nullable(),
  newValue: z.string().nullable(),
  createdAt: z.string()
});

export const leadHistoryResultSchema = z.object({
  items: z.array(leadHistoryItemSchema)
});

export const syncProgressEventSchema = z.object({
  facebookPageId: z.string().min(1),
  stage: z.enum([
    'STARTING',
    'FETCHING_PAGE_TOKEN',
    'FETCHING_POSTS',
    'PROCESSING_POSTS',
    'CHECKING_STORED_POSTS',
    'COMPLETED',
    'CANCELLED',
    'FAILED'
  ]),
  message: z.string(),
  postsProcessed: z.number().int().nonnegative(),
  commentsProcessed: z.number().int().nonnegative(),
  leadsDetected: z.number().int().nonnegative(),
  currentPostIndex: z.number().int().positive().optional(),
  totalPosts: z.number().int().nonnegative().optional()
});

export const syncCheckpointSchema = z.object({
  facebookPageId: z.string().min(1),
  stage: z.string(),
  postsProcessed: z.number().int().nonnegative(),
  commentsProcessed: z.number().int().nonnegative(),
  leadsDetected: z.number().int().nonnegative(),
  completedPostIds: z.array(z.string()),
  cursor: z.string().nullable().optional(),
  since: z.string().nullable().optional(),
  lastError: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

export const leadExportInputSchema = z.object({
  pageId: z.number().int().positive().optional(),
  search: z.string().trim().max(200).optional(),
  status: leadStatusSchema.optional(),
  minScore: z.number().int().min(0).max(100).optional()
});

export const leadExportResultSchema = z.object({
  canceled: z.boolean(),
  exported: z.number().int().nonnegative(),
  truncated: z.boolean(),
  filePath: z.string().optional()
});

export const reportSummarySchema = z.object({
  totalLeads: z.number().int().nonnegative(),
  wonLeads: z.number().int().nonnegative(),
  conversionRate: z.number().min(0).max(100),
  statusCounts: z.object({
    NEW: z.number().int().nonnegative(),
    CONTACTED: z.number().int().nonnegative(),
    QUALIFIED: z.number().int().nonnegative(),
    WON: z.number().int().nonnegative(),
    LOST: z.number().int().nonnegative()
  }),
  topPosts: z.array(
    z.object({
      postId: z.number().int().positive(),
      pageName: z.string(),
      facebookPostId: z.string(),
      message: z.string().nullable(),
      permalinkUrl: z.string().url().nullable(),
      leadCount: z.number().int().nonnegative(),
      wonCount: z.number().int().nonnegative()
    })
  )
});

export const externalUrlInputSchema = z.object({
  url: z
    .string()
    .url()
    .max(2048)
    .refine((value) => {
      const protocol = new URL(value).protocol;
      return protocol === 'http:' || protocol === 'https:';
    }, 'Only http and https URLs are allowed.')
});

export const openExternalResultSchema = z.object({ opened: z.literal(true) });
