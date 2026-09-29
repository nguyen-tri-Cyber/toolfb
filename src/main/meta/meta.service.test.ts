import { describe, expect, it } from 'vitest';
import { MetaError } from './meta.errors';
import { MetaService } from './meta.service';
import type { MetaCredential } from './token.service';

function baseStatus() {
  return { state: 'disconnected' as const, connected: false, encryptionAvailable: true,
    checkedAt: '2026-09-28T00:00:00.000Z', missingPermissions: [] };
}

describe('MetaService', () => {
  it('rejects importing a Page that is not accessible to the connected account', async () => {
    let saved = false;
    const service = new MetaService({
      readToken: () => 'user-token',
      listImportedIds: () => new Set(),
      upsertPage: () => { saved = true; throw new Error('should not save'); },
      client: {
        getAccessiblePages: async () => [{ facebookPageId: 'owned-1', name: 'Owned', imported: false }],
        getPageDetails: async () => ({ facebookPageId: 'other-2', name: 'Other', imported: false }),
        getIdentity: async () => ({ id: '1', name: 'Owner' }),
        getGrantedPermissions: async () => []
      }
    });

    await expect(service.importPage('other-2')).rejects.toMatchObject({ code: 'META_PERMISSION_DENIED' });
    expect(saved).toBe(false);
  });

  it('throws META_TOKEN_MISSING before calling Meta when no token is stored', async () => {
    const service = new MetaService({
      readToken: () => null,
      client: {
        getAccessiblePages: async () => {
          throw new Error('client should not be called');
        },
        getPageDetails: async () => {
          throw new Error('client should not be called');
        },
        getIdentity: async () => { throw new Error('client should not be called'); },
        getGrantedPermissions: async () => { throw new Error('client should not be called'); }
      }
    });

    await expect(service.getAccessiblePages()).rejects.toMatchObject<Partial<MetaError>>({
      code: 'META_TOKEN_MISSING'
    });
  });
});

describe('production Meta connection', () => {
  it('stores a validated credential and reports missing permissions without exposing the token', async () => {
    let credential: MetaCredential | null = null;
    const service = new MetaService({
      readCredential: () => credential,
      saveToken: (value) => { credential = value; },
      getStatus: baseStatus,
      requestToken: async () => 'secret-token',
      client: {
        getIdentity: async () => ({ id: '1', name: 'Owner' }),
        getGrantedPermissions: async () => ['pages_show_list'],
        getAccessiblePages: async () => [],
        getPageDetails: async () => { throw new Error('unused'); }
      }
    });
    const result = await service.connect();
    expect(result.state).toBe('permission_missing');
    expect(result.missingPermissions).toEqual(['pages_read_engagement', 'pages_read_user_content']);
    expect(JSON.stringify(result)).not.toContain('secret-token');
    expect(credential).toEqual(expect.objectContaining({ accessToken: 'secret-token' }));
  });

  it('reports an expired credential and preserves it for reconnect', async () => {
    const credential: MetaCredential = {
      accessToken: 'expired-token', accountName: 'Owner',
      grantedPermissions: ['pages_show_list', 'pages_read_engagement', 'pages_read_user_content'],
      savedAt: '2026-09-28T00:00:00.000Z'
    };
    const service = new MetaService({
      readCredential: () => credential,
      getStatus: () => ({ ...baseStatus(), state: 'connected', connected: true }),
      client: {
        getIdentity: async () => { throw new MetaError('META_TOKEN_EXPIRED', 'expired'); },
        getGrantedPermissions: async () => [],
        getAccessiblePages: async () => [],
        getPageDetails: async () => { throw new Error('unused'); }
      }
    });
    const result = await service.testConnection();
    expect(result.state).toBe('expired');
    expect(result.connected).toBe(false);
    expect(credential.accessToken).toBe('expired-token');
  });

  it('exposes connecting state and rejects a second simultaneous login', async () => {
    let release: (token: string) => void = () => undefined;
    let credential: MetaCredential | null = null;
    const service = new MetaService({
      getStatus: baseStatus,
      readCredential: () => credential,
      saveToken: (value) => { credential = value; },
      requestToken: () => new Promise<string>((resolve) => { release = resolve; }),
      client: {
        getIdentity: async () => ({ id: '1', name: 'Owner' }),
        getGrantedPermissions: async () => ['pages_show_list', 'pages_read_engagement', 'pages_read_user_content'],
        getAccessiblePages: async () => [],
        getPageDetails: async () => { throw new Error('unused'); }
      }
    });
    const first = service.connect();
    expect(service.getConnectionStatus().state).toBe('connecting');
    await expect(service.connect()).rejects.toMatchObject({ code: 'META_OAUTH_IN_PROGRESS' });
    release('token');
    expect((await first).state).toBe('connected');
  });
});

describe('developer mode Meta token', () => {
  it('stores a validated manual token, grants connected status, and avoids leaking raw token in status', async () => {
    let credential: MetaCredential | null = null;
    const service = new MetaService({
      isDev: true,
      readCredential: () => credential,
      saveToken: (value) => { credential = value; },
      getStatus: baseStatus,
      client: {
        getIdentity: async () => ({ id: 'dev-user-id', name: 'Dev Account' }),
        getGrantedPermissions: async () => [
          'pages_show_list',
          'pages_read_engagement',
          'pages_read_user_content'
        ],
        getAccessiblePages: async () => [],
        getPageDetails: async () => { throw new Error('unused'); }
      }
    });

    const result = await service.setDeveloperToken('  EAA-manual-token-123  ');
    expect(result.state).toBe('connected');
    expect(result.connected).toBe(true);
    expect(result.accountName).toBe('Dev Account');
    expect(result.missingPermissions).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('EAA-manual-token-123');
    expect(credential).toEqual(expect.objectContaining({
      accessToken: 'EAA-manual-token-123',
      accountName: 'Dev Account',
      grantedPermissions: ['pages_show_list', 'pages_read_engagement', 'pages_read_user_content']
    }));
  });

  it('identifies missing permissions when manual token has partial grants', async () => {
    let credential: MetaCredential | null = null;
    const service = new MetaService({
      isDev: true,
      readCredential: () => credential,
      saveToken: (value) => { credential = value; },
      getStatus: baseStatus,
      client: {
        getIdentity: async () => ({ id: 'dev-user-id', name: 'Dev Account' }),
        getGrantedPermissions: async () => ['pages_show_list'],
        getAccessiblePages: async () => [],
        getPageDetails: async () => { throw new Error('unused'); }
      }
    });

    const result = await service.setDeveloperToken('EAA-limited-token');
    expect(result.state).toBe('permission_missing');
    expect(result.connected).toBe(false);
    expect(result.missingPermissions).toEqual(['pages_read_engagement', 'pages_read_user_content']);
    expect((credential as MetaCredential | null)?.accessToken).toBe('EAA-limited-token');
  });

  it('rejects empty or whitespace-only token with META_TOKEN_INVALID without calling Meta API', async () => {
    const service = new MetaService({
      isDev: true,
      client: {
        getIdentity: async () => { throw new Error('should not call'); },
        getGrantedPermissions: async () => { throw new Error('should not call'); },
        getAccessiblePages: async () => [],
        getPageDetails: async () => { throw new Error('unused'); }
      }
    });

    await expect(service.setDeveloperToken('   ')).rejects.toMatchObject({
      code: 'META_TOKEN_INVALID'
    });
  });

  it('rejects manual token when in production mode (isDev: false)', async () => {
    const service = new MetaService({
      isDev: false,
      client: {
        getIdentity: async () => ({ id: 'dev-user-id', name: 'Dev Account' }),
        getGrantedPermissions: async () => ['pages_show_list'],
        getAccessiblePages: async () => [],
        getPageDetails: async () => { throw new Error('unused'); }
      }
    });

    await expect(service.setDeveloperToken('EAA-prod-attempt')).rejects.toMatchObject({
      code: 'META_DEVELOPER_MODE_DISABLED'
    });
  });

  it('propagates Meta errors such as expired/invalid tokens without saving credential', async () => {
    let credential: MetaCredential | null = null;
    const service = new MetaService({
      isDev: true,
      readCredential: () => credential,
      saveToken: (value) => { credential = value; },
      getStatus: baseStatus,
      client: {
        getIdentity: async () => {
          throw new MetaError('META_TOKEN_EXPIRED', 'Token expired.');
        },
        getGrantedPermissions: async () => [],
        getAccessiblePages: async () => [],
        getPageDetails: async () => { throw new Error('unused'); }
      }
    });

    await expect(service.setDeveloperToken('EAA-expired-token')).rejects.toMatchObject({
      code: 'META_TOKEN_EXPIRED'
    });
    expect(credential).toBeNull();
  });
});
