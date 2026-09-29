import { describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '@shared/constants/ipc';

const mockInvoke = vi.fn();
vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: (...args: unknown[]) => mockInvoke(...args)
  }
}));

import { createFsiApi } from './api';

describe('Preload createFsiApi', () => {
  it('does NOT expose setDeveloperToken in production mode (isDev: false)', () => {
    const api = createFsiApi(false);
    expect(api.meta.setDeveloperToken).toBeUndefined();
  });

  it('exposes setDeveloperToken in development mode (isDev: true) and invokes typed IPC', async () => {
    mockInvoke.mockResolvedValueOnce({
      success: true,
      data: {
        state: 'connected',
        connected: true,
        encryptionAvailable: true,
        checkedAt: '2026-09-28T00:00:00.000Z',
        accountName: 'Dev Account',
        missingPermissions: []
      }
    });

    const api = createFsiApi(true);
    expect(typeof api.meta.setDeveloperToken).toBe('function');

    const result = await api.meta.setDeveloperToken!('EAA-sample-token');
    expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.META_SET_DEVELOPER_TOKEN, {
      token: 'EAA-sample-token'
    });
    expect(result.success).toBe(true);
  });

  it('exposes bulk lead operations and history methods', async () => {
    mockInvoke.mockResolvedValue({ success: true, data: { updated: 3 } });
    const api = createFsiApi(false);

    const bulkStatusRes = await api.leads.bulkUpdateStatus([1, 2, 3], 'WON');
    expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.LEADS_BULK_UPDATE_STATUS, {
      ids: [1, 2, 3],
      status: 'WON'
    });
    expect(bulkStatusRes.success).toBe(true);

    const bulkTagsRes = await api.leads.bulkAddTags([1, 2], ['VIP']);
    expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.LEADS_BULK_ADD_TAGS, {
      ids: [1, 2],
      tags: ['VIP']
    });
    expect(bulkTagsRes.success).toBe(true);

    mockInvoke.mockResolvedValueOnce({ success: true, data: { items: [] } });
    const historyRes = await api.leads.getHistory(1);
    expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.LEADS_GET_HISTORY, { leadId: 1 });
    expect(historyRes.success).toBe(true);
  });

  it('exposes checkpoint and progress methods', async () => {
    mockInvoke.mockResolvedValueOnce({ success: true, data: null });
    const api = createFsiApi(false);

    const cp = await api.meta.getSyncCheckpoint('12345');
    expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.META_GET_SYNC_CHECKPOINT, { pageId: '12345' });
    expect(cp.success).toBe(true);

    mockInvoke.mockResolvedValueOnce({ success: true, data: { discarded: true } });
    const disc = await api.meta.discardCheckpoint('12345');
    expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.META_DISCARD_CHECKPOINT, { pageId: '12345' });
    expect(disc.success).toBe(true);
  });
});
