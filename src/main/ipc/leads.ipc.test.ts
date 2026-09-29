import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '@shared/constants/ipc';
import { dialog } from 'electron';
import { writeFile } from 'node:fs/promises';

const handlers = new Map<string, (...args: unknown[]) => unknown>();
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler);
    })
  },
  dialog: {
    showSaveDialog: vi.fn()
  }
}));
vi.mock('node:fs', () => ({ existsSync: vi.fn(() => false) }));
vi.mock('node:fs/promises', () => ({ writeFile: vi.fn() }));

const mockListLeads = vi.fn();
const mockUpdateLeadStatus = vi.fn();
const mockUpdateLeadDetails = vi.fn();
const mockBulkUpdateLeadStatus = vi.fn();
const mockBulkAddLeadTags = vi.fn();
const mockGetLeadHistory = vi.fn();

vi.mock('../database/leads.repository', () => ({
  listLeads: (...args: unknown[]) => mockListLeads(...args),
  updateLeadStatus: (...args: unknown[]) => mockUpdateLeadStatus(...args),
  updateLeadDetails: (...args: unknown[]) => mockUpdateLeadDetails(...args),
  bulkUpdateLeadStatus: (...args: unknown[]) => mockBulkUpdateLeadStatus(...args),
  bulkAddLeadTags: (...args: unknown[]) => mockBulkAddLeadTags(...args),
  getLeadHistory: (...args: unknown[]) => mockGetLeadHistory(...args)
}));

import { registerLeadsIpc } from './leads.ipc';

beforeEach(() => {
  handlers.clear();
  vi.clearAllMocks();
  registerLeadsIpc();
});

describe('Leads IPC Registration and Handlers', () => {
  it('explains when Excel has locked the selected export file', async () => {
    mockListLeads.mockReturnValueOnce({ items: [{ tags: [] }], total: 1 });
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ canceled: false, filePath: 'C:\\Downloads\\leads.csv' });
    vi.mocked(writeFile).mockRejectedValueOnce(Object.assign(new Error('locked'), { code: 'EBUSY' }));

    const result = (await handlers.get(IPC_CHANNELS.LEADS_EXPORT_CSV)!(null, {})) as {
      success: boolean;
      error?: { message: string };
    };

    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/Excel|đang mở/);
  });
  it('suggests a distinct, editable filename for each export', async () => {
    mockListLeads.mockReturnValue({ items: [{}], total: 1 });
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: true, filePath: '' });
    const handler = handlers.get(IPC_CHANNELS.LEADS_EXPORT_CSV);

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-09-29T12:30:05.123Z'));
      await handler!(null, {});
      vi.setSystemTime(new Date('2026-09-29T12:30:05.124Z'));
      await handler!(null, {});
    } finally {
      vi.useRealTimers();
    }

    const first = vi.mocked(dialog.showSaveDialog).mock.calls[0][0];
    const second = vi.mocked(dialog.showSaveDialog).mock.calls[1][0];
    expect(first.defaultPath).toMatch(/^facebook-leads-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-\d{3}\.xlsx$/);
    expect(second.defaultPath).not.toBe(first.defaultPath);
  });

  it('exports to XLSX when .xlsx path is selected', async () => {
    mockListLeads.mockReturnValueOnce({
      items: [{ id: 1, pageName: 'P', authorName: 'A', commentMessage: 'C', score: 80, intentType: 'BUY', intentLevel: 'HIGH', status: 'NEW', note: null, tags: [], commentCreatedTime: '2026-09-29', postPermalinkUrl: 'url' }],
      total: 1
    });
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ canceled: false, filePath: 'C:\\Downloads\\leads.xlsx' });

    const handler = handlers.get(IPC_CHANNELS.LEADS_EXPORT_CSV);
    const result = (await handler!(null, {})) as {
      success: boolean;
      data?: { exported: number; filePath: string };
    };

    expect(result.success).toBe(true);
    expect(result.data?.exported).toBe(1);
    expect(result.data?.filePath).toBe('C:\\Downloads\\leads.xlsx');
    expect(writeFile).toHaveBeenCalledWith('C:\\Downloads\\leads.xlsx', expect.any(Buffer), { flag: 'wx' });
  });

  it('exports to CSV when .csv path is selected', async () => {
    mockListLeads.mockReturnValueOnce({
      items: [{ id: 1, pageName: 'P', authorName: 'A', commentMessage: 'C', score: 80, intentType: 'BUY', intentLevel: 'HIGH', status: 'NEW', note: null, tags: [], commentCreatedTime: '2026-09-29', postPermalinkUrl: 'url' }],
      total: 1
    });
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ canceled: false, filePath: 'C:\\Downloads\\leads.csv' });

    const handler = handlers.get(IPC_CHANNELS.LEADS_EXPORT_CSV);
    const result = (await handler!(null, {})) as {
      success: boolean;
      data?: { exported: number; filePath: string };
    };

    expect(result.success).toBe(true);
    expect(result.data?.exported).toBe(1);
    expect(result.data?.filePath).toBe('C:\\Downloads\\leads.csv');
    expect(writeFile).toHaveBeenCalledWith('C:\\Downloads\\leads.csv', expect.stringContaining('\uFEFF'), { encoding: 'utf8', flag: 'wx' });
  });

  it('defaults extension to .xlsx when user enters path without extension', async () => {
    mockListLeads.mockReturnValueOnce({
      items: [{ id: 1, pageName: 'P', authorName: 'A', commentMessage: 'C', score: 80, intentType: 'BUY', intentLevel: 'HIGH', status: 'NEW', note: null, tags: [], commentCreatedTime: '2026-09-29', postPermalinkUrl: 'url' }],
      total: 1
    });
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ canceled: false, filePath: 'C:\\Downloads\\my_leads' });

    const handler = handlers.get(IPC_CHANNELS.LEADS_EXPORT_CSV);
    const result = (await handler!(null, {})) as {
      success: boolean;
      data?: { exported: number; filePath: string };
    };

    expect(result.success).toBe(true);
    expect(result.data?.filePath).toBe('C:\\Downloads\\my_leads.xlsx');
    expect(writeFile).toHaveBeenCalledWith('C:\\Downloads\\my_leads.xlsx', expect.any(Buffer), { flag: 'wx' });
  });

  it('rejects unsupported file extension with EXPORT_UNSUPPORTED_FORMAT', async () => {
    mockListLeads.mockReturnValueOnce({
      items: [{ id: 1 }],
      total: 1
    });
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ canceled: false, filePath: 'C:\\Downloads\\leads.txt' });

    const handler = handlers.get(IPC_CHANNELS.LEADS_EXPORT_CSV);
    const result = (await handler!(null, {})) as {
      success: boolean;
      error?: { code: string; message: string };
    };

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('EXPORT_UNSUPPORTED_FORMAT');
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('refuses to overwrite when the target file already exists', async () => {
    const { existsSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValueOnce(true);

    mockListLeads.mockReturnValueOnce({
      items: [{ id: 1 }],
      total: 1
    });
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ canceled: false, filePath: 'C:\\Downloads\\leads.xlsx' });

    const handler = handlers.get(IPC_CHANNELS.LEADS_EXPORT_CSV);
    const result = (await handler!(null, {})) as {
      success: boolean;
      error?: { code: string; message: string };
    };

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('EXPORT_FILE_EXISTS');
    expect(writeFile).not.toHaveBeenCalled();
  });
  it('does not create a header-only CSV when no leads match the filters', async () => {
    mockListLeads.mockReturnValueOnce({ items: [], total: 0 });
    const handler = handlers.get(IPC_CHANNELS.LEADS_EXPORT_CSV);

    const result = (await handler!(null, {})) as {
      success: boolean;
      error?: { code: string; message: string };
    };

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('EXPORT_EMPTY');
    expect(dialog.showSaveDialog).not.toHaveBeenCalled();
  });
  it('registers all required lead channels', () => {
    expect(handlers.has(IPC_CHANNELS.LEADS_LIST)).toBe(true);
    expect(handlers.has(IPC_CHANNELS.LEADS_UPDATE_STATUS)).toBe(true);
    expect(handlers.has(IPC_CHANNELS.LEADS_UPDATE_DETAILS)).toBe(true);
    expect(handlers.has(IPC_CHANNELS.LEADS_BULK_UPDATE_STATUS)).toBe(true);
    expect(handlers.has(IPC_CHANNELS.LEADS_BULK_ADD_TAGS)).toBe(true);
    expect(handlers.has(IPC_CHANNELS.LEADS_GET_HISTORY)).toBe(true);
    expect(handlers.has(IPC_CHANNELS.LEADS_EXPORT_CSV)).toBe(true);
  });

  it('handles bulk status updates correctly', async () => {
    const handler = handlers.get(IPC_CHANNELS.LEADS_BULK_UPDATE_STATUS);
    expect(handler).toBeDefined();

    mockBulkUpdateLeadStatus.mockReturnValueOnce({ updated: 2 });

    const result = (await handler!(null, { ids: [1, 2], status: 'CONTACTED' })) as {
      success: boolean;
      data?: { updated: number };
    };

    expect(result.success).toBe(true);
    expect(result.data?.updated).toBe(2);
    expect(mockBulkUpdateLeadStatus).toHaveBeenCalledWith([1, 2], 'CONTACTED');
  });

  it('handles bulk tag addition correctly', async () => {
    const handler = handlers.get(IPC_CHANNELS.LEADS_BULK_ADD_TAGS);
    expect(handler).toBeDefined();

    mockBulkAddLeadTags.mockReturnValueOnce({ updated: 3 });

    const result = (await handler!(null, { ids: [1, 2, 3], tags: ['VIP', 'Hot'] })) as {
      success: boolean;
      data?: { updated: number };
    };

    expect(result.success).toBe(true);
    expect(result.data?.updated).toBe(3);
    expect(mockBulkAddLeadTags).toHaveBeenCalledWith([1, 2, 3], ['VIP', 'Hot']);
  });

  it('retrieves lead change history correctly', async () => {
    const handler = handlers.get(IPC_CHANNELS.LEADS_GET_HISTORY);
    expect(handler).toBeDefined();

    mockGetLeadHistory.mockReturnValueOnce([
      {
        id: 1,
        leadId: 10,
        action: 'STATUS_CHANGED',
        field: 'status',
        oldValue: 'NEW',
        newValue: 'QUALIFIED',
        createdAt: '2026-09-29T12:00:00.000Z'
      }
    ]);

    const result = (await handler!(null, { leadId: 10 })) as {
      success: boolean;
      data?: { items: Array<{ id: number; action: string; newValue: string | null }> };
    };

    expect(result.success).toBe(true);
    expect(result.data?.items).toHaveLength(1);
    expect(result.data?.items[0].action).toBe('STATUS_CHANGED');
    expect(mockGetLeadHistory).toHaveBeenCalledWith(10);
  });

  it('validates invalid input safely', async () => {
    const handler = handlers.get(IPC_CHANNELS.LEADS_BULK_UPDATE_STATUS);
    expect(handler).toBeDefined();

    const result = (await handler!(null, { ids: [], status: 'INVALID_STATUS' })) as {
      success: boolean;
      error?: { code: string; message: string };
    };

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('LEAD_UPDATE_FAILED');
  });
});
