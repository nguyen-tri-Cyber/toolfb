import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const storage = vi.hoisted(() => ({ directory: '', available: true }));
vi.mock('electron', () => ({
  app: { getPath: () => storage.directory },
  safeStorage: {
    isEncryptionAvailable: () => storage.available,
    encryptString: (value: string) => Buffer.from(Buffer.from(value).toString('base64'), 'utf8'),
    decryptString: (value: Buffer) => Buffer.from(value.toString('utf8'), 'base64').toString('utf8')
  }
}));

import { getDatabase, initializeDatabase } from '../database';
import { listFacebookPages } from '../database/pages.repository';
import { listComments } from '../database/content-query.repository';
import { listLeads } from '../database/leads.repository';
import { MetaService } from './meta.service';
import { PageSyncService } from '../sync/page-sync.service';

describe('Meta Developer Mode Local E2E Flow', () => {
  beforeEach(() => {
    storage.directory = mkdtempSync(join(tmpdir(), 'fsi-dev-e2e-cred-'));
    storage.available = true;
    initializeDatabase();
  });

  afterEach(() => {
    try {
      getDatabase().sqlite.close();
    } catch {
      // ignore
    }
    rmSync(storage.directory, { recursive: true, force: true });
  });

  it('runs complete local flow: Token -> Connect -> Select Page -> Import -> Sync -> Comments -> Lead Detection -> Lead Inbox', async () => {
    // 1. Mock Meta Graph API client with realistic data
    const mockClient = {
      getIdentity: vi.fn(async () => ({
        id: 'user-1001',
        name: 'Nguyen Van Dev'
      })),
      getGrantedPermissions: vi.fn(async () => [
        'pages_show_list',
        'pages_read_engagement',
        'pages_read_user_content'
      ]),
      getAccessiblePages: vi.fn(async (_token: string, importedIds: Set<string>) => [
        {
          facebookPageId: 'page-2001',
          name: 'Shop Thoi Trang Local',
          category: 'Retail Company',
          imported: importedIds.has('page-2001')
        }
      ]),
      getPageDetails: vi.fn(async (_token: string, pageId: string) => ({
        facebookPageId: pageId,
        name: 'Shop Thoi Trang Local',
        username: 'shopthoitranglocal',
        category: 'Retail Company',
        pictureUrl: 'https://example.com/logo.jpg',
        imported: false
      })),
      getPageAccessToken: vi.fn(async () => 'page-token-2001'),
      getPagePosts: vi.fn(async (_pageToken: string, pageId: string) => [
        {
          facebookPostId: `${pageId}_post-3001`,
          message: 'Bo suu tap mua he moi ve, inbox de nhan uu dai 20%!',
          postType: 'status',
          permalinkUrl: 'https://facebook.com/shop/posts/3001',
          createdTime: '2026-09-28T10:00:00.000Z',
          reactionsCount: 45,
          commentsCount: 2,
          sharesCount: 3,
          rawJson: '{}'
        }
      ]),
      getPostComments: vi.fn(async (_pageToken: string, postId: string) => [
        {
          facebookCommentId: `${postId}_comment-4001`,
          message: 'Shop oi, mau xanh con size L khong? Cho minh xin gia va dia chi voi!',
          createdTime: '2026-09-28T10:30:00.000Z',
          authorName: 'Le Thi Khach Hang',
          authorExternalId: '5001',
          likeCount: 1,
          parentCommentId: null,
          rawJson: '{}'
        },
        {
          facebookCommentId: `${postId}_comment-4002`,
          message: 'San pham nhin dep qua!',
          createdTime: '2026-09-28T11:00:00.000Z',
          authorName: 'Tran Van Xem',
          authorExternalId: '5002',
          likeCount: 0,
          parentCommentId: null,
          rawJson: '{}'
        }
      ])
    };

    const metaService = new MetaService({
      isDev: true,
      client: mockClient
    });

    const syncService = new PageSyncService({
      client: mockClient
    });

    // Step A: Token entry & validation
    const connectionStatus = await metaService.setDeveloperToken('EAA-local-test-token-xyz');
    expect(connectionStatus.state).toBe('connected');
    expect(connectionStatus.connected).toBe(true);
    expect(connectionStatus.accountName).toBe('Nguyen Van Dev');
    expect(connectionStatus.missingPermissions).toEqual([]);

    // Step B: Get accessible pages
    const accessiblePages = await metaService.getAccessiblePages();
    expect(accessiblePages).toHaveLength(1);
    expect(accessiblePages[0].facebookPageId).toBe('page-2001');
    expect(accessiblePages[0].imported).toBe(false);

    // Step C: Import page
    const importedPage = await metaService.importPage('page-2001');
    expect(importedPage.facebookPageId).toBe('page-2001');
    expect(importedPage.name).toBe('Shop Thoi Trang Local');

    const pagesInDb = listFacebookPages();
    expect(pagesInDb).toHaveLength(1);
    expect(pagesInDb[0].facebookPageId).toBe('page-2001');

    // Step D: Sync posts & comments
    const syncResult = await syncService.syncOwnedPage('page-2001');
    expect(syncResult.postsProcessed).toBe(1);
    expect(syncResult.commentsProcessed).toBe(2);
    expect(syncResult.leadsDetected).toBe(1); // "Shop oi, mau xanh con size L khong? Cho minh xin gia va dia chi voi!" is detected

    // Step E: Verify Comments in database
    const commentsView = listComments({ pageId: importedPage.id, limit: 10, offset: 0 });
    expect(commentsView.total).toBe(2);
    const buyingComment = commentsView.items.find(
      (c) => c.authorName === 'Le Thi Khach Hang'
    );
    expect(buyingComment).toBeDefined();
    expect(buyingComment?.leadId).not.toBeNull();
    expect(buyingComment?.leadScore).toBeGreaterThanOrEqual(40);

    // Step F: Verify Lead Inbox
    const leadsView = listLeads({ pageId: importedPage.id, limit: 10, offset: 0 });
    expect(leadsView.total).toBe(1);
    const lead = leadsView.items[0];
    expect(lead.authorName).toBe('Le Thi Khach Hang');
    expect(lead.commentMessage).toContain('Cho minh xin gia va dia chi voi');
    expect(lead.status).toBe('NEW');
    expect(lead.score).toBeGreaterThanOrEqual(40);
  });
});
