import { relations, sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const timestamps = {
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
};

export const appSettings = sqliteTable(
  'app_settings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    key: text('key').notNull(),
    value: text('value').notNull(),
    ...timestamps
  },
  (table) => ({
    keyUnique: uniqueIndex('app_settings_key_unique').on(table.key)
  })
);

export const facebookPages = sqliteTable(
  'facebook_pages',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    facebookPageId: text('facebook_page_id').notNull(),
    name: text('name').notNull(),
    username: text('username'),
    category: text('category'),
    pictureUrl: text('picture_url'),
    isOwned: integer('is_owned', { mode: 'boolean' }).notNull().default(false),
    syncEnabled: integer('sync_enabled', { mode: 'boolean' }).notNull().default(false),
    lastSyncedAt: text('last_synced_at'),
    ...timestamps
  },
  (table) => ({
    facebookPageIdUnique: uniqueIndex('facebook_pages_facebook_page_id_unique').on(
      table.facebookPageId
    ),
    nameIndex: index('facebook_pages_name_idx').on(table.name)
  })
);

export const facebookPosts = sqliteTable(
  'facebook_posts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    pageId: integer('page_id')
      .notNull()
      .references(() => facebookPages.id, { onDelete: 'cascade' }),
    facebookPostId: text('facebook_post_id').notNull(),
    message: text('message'),
    postType: text('post_type'),
    permalinkUrl: text('permalink_url'),
    createdTime: text('created_time'),
    reactionsCount: integer('reactions_count').notNull().default(0),
    commentsCount: integer('comments_count').notNull().default(0),
    sharesCount: integer('shares_count').notNull().default(0),
    rawJson: text('raw_json'),
    ...timestamps
  },
  (table) => ({
    facebookPostIdUnique: uniqueIndex('facebook_posts_facebook_post_id_unique').on(
      table.facebookPostId
    ),
    pageIdIndex: index('facebook_posts_page_id_idx').on(table.pageId),
    createdTimeIndex: index('facebook_posts_created_time_idx').on(table.createdTime)
  })
);

export const facebookComments = sqliteTable(
  'facebook_comments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    postId: integer('post_id')
      .notNull()
      .references(() => facebookPosts.id, { onDelete: 'cascade' }),
    facebookCommentId: text('facebook_comment_id').notNull(),
    parentCommentId: text('parent_comment_id'),
    authorExternalId: text('author_external_id'),
    authorName: text('author_name'),
    message: text('message'),
    createdTime: text('created_time'),
    likeCount: integer('like_count').notNull().default(0),
    rawJson: text('raw_json'),
    ...timestamps
  },
  (table) => ({
    facebookCommentIdUnique: uniqueIndex('facebook_comments_facebook_comment_id_unique').on(
      table.facebookCommentId
    ),
    postIdIndex: index('facebook_comments_post_id_idx').on(table.postId),
    parentCommentIndex: index('facebook_comments_parent_comment_id_idx').on(
      table.parentCommentId
    ),
    createdTimeIndex: index('facebook_comments_created_time_idx').on(table.createdTime)
  })
);

export const leadStatuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST'] as const;

export const leads = sqliteTable(
  'leads',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sourceType: text('source_type').notNull(),
    sourceCommentId: integer('source_comment_id').references(() => facebookComments.id, {
      onDelete: 'set null'
    }),
    status: text('status', { enum: leadStatuses }).notNull().default('NEW'),
    intentLevel: text('intent_level'),
    intentType: text('intent_type'),
    score: integer('score').notNull().default(0),
    sentiment: text('sentiment'),
    summary: text('summary'),
    note: text('note'),
    tagsJson: text('tags_json').notNull().default('[]'),
    ...timestamps
  },
  (table) => ({
    sourceCommentIndex: index('leads_source_comment_id_idx').on(table.sourceCommentId),
    statusIndex: index('leads_status_idx').on(table.status)
  })
);

export const aiAnalyses = sqliteTable(
  'ai_analyses',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    entityType: text('entity_type').notNull(),
    entityId: integer('entity_id').notNull(),
    buyerIntent: text('buyer_intent'),
    intentType: text('intent_type'),
    painPointsJson: text('pain_points_json'),
    productInterestsJson: text('product_interests_json'),
    sentiment: text('sentiment'),
    questionsJson: text('questions_json'),
    confidence: integer('confidence').notNull().default(0),
    model: text('model'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    entityIndex: index('ai_analyses_entity_idx').on(table.entityType, table.entityId),
    createdAtIndex: index('ai_analyses_created_at_idx').on(table.createdAt)
  })
);

export const syncJobStatuses = ['PENDING', 'RUNNING', 'SUCCESS', 'FAILED'] as const;

export const syncJobs = sqliteTable(
  'sync_jobs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    jobType: text('job_type').notNull(),
    status: text('status', { enum: syncJobStatuses }).notNull().default('PENDING'),
    pageId: integer('page_id'),
    startedAt: text('started_at'),
    finishedAt: text('finished_at'),
    processedItems: integer('processed_items').notNull().default(0),
    failedItems: integer('failed_items').notNull().default(0),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    statusIndex: index('sync_jobs_status_idx').on(table.status),
    jobTypeIndex: index('sync_jobs_job_type_idx').on(table.jobType)
  })
);

export const facebookPagesRelations = relations(facebookPages, ({ many }) => ({
  posts: many(facebookPosts)
}));

export const facebookPostsRelations = relations(facebookPosts, ({ one, many }) => ({
  page: one(facebookPages, {
    fields: [facebookPosts.pageId],
    references: [facebookPages.id]
  }),
  comments: many(facebookComments)
}));

export const facebookCommentsRelations = relations(facebookComments, ({ one, many }) => ({
  post: one(facebookPosts, {
    fields: [facebookComments.postId],
    references: [facebookPosts.id]
  }),
  leads: many(leads)
}));

export const leadsRelations = relations(leads, ({ one }) => ({
  sourceComment: one(facebookComments, {
    fields: [leads.sourceCommentId],
    references: [facebookComments.id]
  })
}));
