import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '@shared/constants/ipc';

const handlers = new Map<string, (...args: unknown[]) => unknown>();
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler);
    })
  }
}));

const mockSetDeveloperToken = vi.fn();
vi.mock('../meta/meta.service', () => ({
  metaService: {
    getConnectionStatus: vi.fn(() => ({
      state: 'disconnected',
      connected: false,
      encryptionAvailable: true,
      checkedAt: '2026-09-28T00:00:00.000Z',
      missingPermissions: []
    })),
    setDeveloperToken: (...args: unknown[]) => mockSetDeveloperToken(...args)
  }
}));

import { registerMetaIpc } from './meta.ipc';
import { MetaError } from '../meta/meta.errors';

beforeEach(() => {
  handlers.clear();
  vi.clearAllMocks();
});

describe('Meta IPC Registration and Security Boundary', () => {
  it('does NOT register META_SET_DEVELOPER_TOKEN in production mode (isDev: false)', () => {
    registerMetaIpc({ isDev: false });
    expect(handlers.has(IPC_CHANNELS.META_SET_DEVELOPER_TOKEN)).toBe(false);
    expect(handlers.has(IPC_CHANNELS.META_GET_CONNECTION_STATUS)).toBe(true);
  });

  it('registers META_SET_DEVELOPER_TOKEN in development mode (isDev: true)', () => {
    registerMetaIpc({ isDev: true });
    expect(handlers.has(IPC_CHANNELS.META_SET_DEVELOPER_TOKEN)).toBe(true);
  });

  it('handles valid token via developer token IPC and returns safe result', async () => {
    registerMetaIpc({ isDev: true });
    const handler = handlers.get(IPC_CHANNELS.META_SET_DEVELOPER_TOKEN);
    expect(handler).toBeDefined();

    mockSetDeveloperToken.mockResolvedValueOnce({
      state: 'connected',
      connected: true,
      encryptionAvailable: true,
      checkedAt: '2026-09-28T00:00:00.000Z',
      accountName: 'Test Developer',
      missingPermissions: []
    });

    const result = (await handler!(null, { token: 'EAA-sample-token-123' })) as {
      success: boolean;
      data?: { state: string; connected: boolean; accountName?: string };
    };

    expect(result.success).toBe(true);
    expect(result.data?.connected).toBe(true);
    expect(result.data?.accountName).toBe('Test Developer');
    expect(mockSetDeveloperToken).toHaveBeenCalledWith('EAA-sample-token-123');
  });

  it('returns safe Vietnamese error for empty or invalid token format', async () => {
    registerMetaIpc({ isDev: true });
    const handler = handlers.get(IPC_CHANNELS.META_SET_DEVELOPER_TOKEN);
    expect(handler).toBeDefined();

    const result = (await handler!(null, { token: '' })) as {
      success: boolean;
      error: { code: string; message: string };
    };

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockSetDeveloperToken).not.toHaveBeenCalled();
  });

  it('maps MetaError into Vietnamese error message when service rejects', async () => {
    registerMetaIpc({ isDev: true });
    const handler = handlers.get(IPC_CHANNELS.META_SET_DEVELOPER_TOKEN);
    expect(handler).toBeDefined();

    mockSetDeveloperToken.mockRejectedValueOnce(
      new MetaError('META_TOKEN_EXPIRED', 'Token expired')
    );

    const result = (await handler!(null, { token: 'EAA-expired-token' })) as {
      success: boolean;
      error: { code: string; message: string };
    };

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('META_TOKEN_EXPIRED');
    expect(result.error.message).toContain('Phiên Meta đã hết hạn');
  });
});
