import { z } from 'zod';
import type { FacebookPageSummary } from '@shared/types/ipc';

const graphPictureSchema = z
  .object({
    data: z
      .object({
        url: z.string().url().optional()
      })
      .optional()
  })
  .optional();

export const graphPageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  username: z.string().optional(),
  category: z.string().optional(),
  picture: graphPictureSchema
});

export const graphAccessiblePagesResponseSchema = z.object({
  data: z.array(graphPageSchema),
  paging: z
    .object({
      next: z.string().url().optional()
    })
    .optional()
});

export const graphPageDetailsResponseSchema = graphPageSchema;

export const graphPageAccessTokensResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().min(1),
      access_token: z.string().min(1).optional()
    })
  )
});

const graphSummaryCountSchema = z
  .object({
    summary: z
      .object({
        total_count: z.number().int().nonnegative().optional()
      })
      .optional()
  })
  .optional();

export const graphPostSchema = z.object({
  id: z.string().min(1),
  message: z.string().optional(),
  status_type: z.string().optional(),
  permalink_url: z.string().optional(),
  created_time: z.string().optional(),
  reactions: graphSummaryCountSchema,
  comments: graphSummaryCountSchema,
  shares: z
    .object({
      count: z.number().int().nonnegative().optional()
    })
    .optional()
});

export const graphPostsResponseSchema = z.object({
  data: z.array(graphPostSchema),
  paging: z
    .object({
      cursors: z
        .object({
          after: z.string().min(1).optional()
        })
        .optional()
    })
    .optional()
});

export const graphCommentSchema = z.object({
  id: z.string().min(1),
  message: z.string().optional(),
  created_time: z.string().optional(),
  from: z
    .object({
      id: z.string().optional(),
      name: z.string().optional()
    })
    .optional(),
  like_count: z.number().int().nonnegative().optional(),
  parent: z
    .object({
      id: z.string().min(1)
    })
    .optional()
});

export const graphCommentsResponseSchema = z.object({
  data: z.array(graphCommentSchema),
  paging: z
    .object({
      cursors: z
        .object({
          after: z.string().min(1).optional()
        })
        .optional()
    })
    .optional()
});

export const graphErrorResponseSchema = z.object({
  error: z.object({
    message: z.string().optional(),
    type: z.string().optional(),
    code: z.number().optional(),
    error_subcode: z.number().optional(),
    fbtrace_id: z.string().optional()
  })
});

export type GraphAccessiblePagesResponse = z.infer<typeof graphAccessiblePagesResponseSchema>;
export type GraphPageDetailsResponse = z.infer<typeof graphPageDetailsResponseSchema>;
export type GraphPost = z.infer<typeof graphPostSchema>;
export type GraphComment = z.infer<typeof graphCommentSchema>;

export interface FacebookPageDetails extends FacebookPageSummary {
  username?: string;
}

export interface FacebookPostDetails {
  facebookPostId: string;
  message?: string;
  postType?: string | null;
  permalinkUrl?: string;
  createdTime?: string;
  reactionsCount: number;
  commentsCount: number;
  sharesCount: number;
  rawJson: string;
}

export interface FacebookCommentDetails {
  facebookCommentId: string;
  parentCommentId: string | null;
  authorExternalId?: string;
  authorName?: string;
  message?: string;
  createdTime?: string;
  likeCount: number;
  rawJson: string;
}

export function normalizeGraphPage(page: GraphPageDetailsResponse): FacebookPageDetails {
  return {
    facebookPageId: page.id,
    name: page.name,
    username: page.username,
    category: page.category,
    pictureUrl: page.picture?.data?.url,
    imported: false
  };
}

export function normalizeAccessiblePagesResponse(
  response: GraphAccessiblePagesResponse,
  importedPageIds: Set<string> = new Set()
): FacebookPageSummary[] {
  return response.data.map((page) => ({
    ...normalizeGraphPage(page),
    imported: importedPageIds.has(page.id)
  }));
}

export function normalizeGraphPost(post: GraphPost): FacebookPostDetails {
  return {
    facebookPostId: post.id,
    message: post.message,
    postType: post.status_type ?? null,
    permalinkUrl: post.permalink_url,
    createdTime: post.created_time,
    reactionsCount: post.reactions?.summary?.total_count ?? 0,
    commentsCount: post.comments?.summary?.total_count ?? 0,
    sharesCount: post.shares?.count ?? 0,
    rawJson: JSON.stringify(post)
  };
}

export function normalizeGraphComment(comment: GraphComment): FacebookCommentDetails {
  return {
    facebookCommentId: comment.id,
    parentCommentId: comment.parent?.id ?? null,
    authorExternalId: comment.from?.id,
    authorName: comment.from?.name,
    message: comment.message,
    createdTime: comment.created_time,
    likeCount: comment.like_count ?? 0,
    rawJson: JSON.stringify(comment)
  };
}
