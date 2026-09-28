import { ipcMain } from 'electron';
import {
  commentListQuerySchema,
  commentListResultSchema,
  postListQuerySchema,
  postListResultSchema,
  safeResultSchema
} from '@shared/schemas/ipc';
import { IPC_CHANNELS } from '@shared/constants/ipc';
import { listComments, listPosts } from '../database/content-query.repository';
import { toSafeError } from './errors';

export function registerContentIpc(): void {
  ipcMain.handle(IPC_CHANNELS.POSTS_LIST, (_event, input: unknown) => {
    try {
      const query = postListQuerySchema.parse(input ?? {});
      const data = postListResultSchema.parse(listPosts(query));
      return safeResultSchema(postListResultSchema).parse({ success: true, data });
    } catch (error) {
      console.error('Posts query failed', error);
      return { success: false, error: toSafeError('DATABASE_ERROR', 'Không thể tải danh sách bài viết.') } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.COMMENTS_LIST, (_event, input: unknown) => {
    try {
      const query = commentListQuerySchema.parse(input ?? {});
      const data = commentListResultSchema.parse(listComments(query));
      return safeResultSchema(commentListResultSchema).parse({ success: true, data });
    } catch (error) {
      console.error('Comments query failed', error);
      return { success: false, error: toSafeError('DATABASE_ERROR', 'Không thể tải danh sách bình luận.') } as const;
    }
  });
}
