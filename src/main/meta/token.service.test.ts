import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({ directory: '', available: true }));
vi.mock('electron', () => ({
  app: { getPath: () => storage.directory },
  safeStorage: {
    isEncryptionAvailable: () => storage.available,
    encryptString: (value: string) => Buffer.from(Buffer.from(value).toString('base64'), 'utf8'),
    decryptString: (value: Buffer) => Buffer.from(value.toString('utf8'), 'base64').toString('utf8')
  }
}));

import { deleteCredential, getMetaConnectionStatus, readAccessToken, readCredential, saveCredential } from './token.service';

beforeEach(() => {
  storage.directory = mkdtempSync(join(tmpdir(), 'fsi-token-test-'));
  storage.available = true;
});

afterEach(() => rmSync(storage.directory, { recursive: true, force: true }));

describe('Meta credential store', () => {
  it('saves the production credential and removes the legacy token only after saving', () => {
    const legacy = join(storage.directory, 'meta-development-token.bin');
    writeFileSync(legacy, 'old-token');
    saveCredential({ accessToken: 'new-token', accountName: 'Owner',
      grantedPermissions: ['pages_show_list'], savedAt: '2026-09-28T00:00:00.000Z' });
    expect(readAccessToken()).toBe('new-token');
    expect(readFileSync(join(storage.directory, 'meta-credential.bin'), 'utf8')).not.toContain('new-token');
    expect(getMetaConnectionStatus().state).toBe('connected');
    expect(() => readFileSync(legacy)).toThrow();
    saveCredential({ accessToken: 'replacement-token', accountName: 'Owner',
      grantedPermissions: ['pages_show_list'], savedAt: '2026-09-28T00:01:00.000Z' });
    expect(readAccessToken()).toBe('replacement-token');
    deleteCredential();
    expect(readCredential()).toBeNull();
  });

  it('treats corrupt or unreadable credentials as disconnected', () => {
    writeFileSync(join(storage.directory, 'meta-credential.bin'), Buffer.from('not-json'));
    expect(readCredential()).toBeNull();
    storage.available = false;
    expect(getMetaConnectionStatus()).toMatchObject({ state: 'disconnected', encryptionAvailable: false });
  });
});
