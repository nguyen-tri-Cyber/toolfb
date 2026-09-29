import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { app, safeStorage } from 'electron';
import { z } from 'zod';
import type { MetaConnectionStatus } from '@shared/types/ipc';
import { MetaError } from './meta.errors';

const CREDENTIAL_FILE = 'meta-credential.bin';
const LEGACY_TOKEN_FILE = 'meta-development-token.bin';

const credentialSchema = z.object({
  accessToken: z.string().min(1),
  accountName: z.string().min(1).optional(),
  grantedPermissions: z.array(z.string()),
  savedAt: z.string()
});

export type MetaCredential = z.infer<typeof credentialSchema>;

function credentialPath(): string {
  return join(app.getPath('userData'), CREDENTIAL_FILE);
}

export function readCredential(): MetaCredential | null {
  if (!safeStorage.isEncryptionAvailable()) return null;
  const path = credentialPath();
  if (!existsSync(path)) return null;
  try {
    return credentialSchema.parse(JSON.parse(safeStorage.decryptString(readFileSync(path))));
  } catch {
    return null;
  }
}

export function readAccessToken(): string | null {
  return readCredential()?.accessToken ?? null;
}

export function saveCredential(credential: MetaCredential): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new MetaError('META_STORAGE_UNAVAILABLE', 'Secure storage is unavailable.');
  }
  const value = credentialSchema.parse(credential);
  const path = credentialPath();
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${randomBytes(8).toString('hex')}.tmp`;
  try {
    writeFileSync(temporaryPath, safeStorage.encryptString(JSON.stringify(value)), { mode: 0o600 });
    renameSync(temporaryPath, path);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
  const legacyPath = join(app.getPath('userData'), LEGACY_TOKEN_FILE);
  try {
    if (existsSync(legacyPath)) rmSync(legacyPath, { force: true });
  } catch {
    // The production credential is already stored; cleanup can retry on the next connection.
  }
}

export function deleteCredential(): void {
  for (const name of [CREDENTIAL_FILE, LEGACY_TOKEN_FILE]) {
    rmSync(join(app.getPath('userData'), name), { force: true });
  }
}

export function getMetaConnectionStatus(): MetaConnectionStatus {
  const encryptionAvailable = safeStorage.isEncryptionAvailable();
  const credential = readCredential();
  return {
    state: credential ? 'connected' : 'disconnected',
    connected: Boolean(credential),
    encryptionAvailable,
    checkedAt: new Date().toISOString(),
    ...(credential?.accountName ? { accountName: credential.accountName } : {}),
    missingPermissions: []
  };
}
