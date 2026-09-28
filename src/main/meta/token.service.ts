import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { app, safeStorage } from 'electron';
import { MetaError } from './meta.errors';

const TOKEN_FILE_NAME = 'meta-development-token.bin';

export interface MetaTokenStatus {
  connected: boolean;
  encryptionAvailable: boolean;
  checkedAt: string;
}

function getTokenFilePath(): string {
  return join(app.getPath('userData'), TOKEN_FILE_NAME);
}

function createStatus(connected: boolean): MetaTokenStatus {
  return {
    connected,
    encryptionAvailable: safeStorage.isEncryptionAvailable(),
    checkedAt: new Date().toISOString()
  };
}

export function getMetaConnectionStatus(): MetaTokenStatus {
  if (!safeStorage.isEncryptionAvailable()) {
    return createStatus(false);
  }

  const tokenPath = getTokenFilePath();
  if (!existsSync(tokenPath)) {
    return createStatus(false);
  }

  try {
    const encrypted = readFileSync(tokenPath);
    safeStorage.decryptString(encrypted);
    return createStatus(true);
  } catch {
    return createStatus(false);
  }
}

export function saveDevelopmentToken(token: string): MetaTokenStatus {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new MetaError('META_STORAGE_UNAVAILABLE', 'safeStorage is unavailable.');
  }

  const tokenPath = getTokenFilePath();
  mkdirSync(dirname(tokenPath), { recursive: true });
  const encrypted = safeStorage.encryptString(token);
  writeFileSync(tokenPath, encrypted, { mode: 0o600 });

  return createStatus(true);
}

export function readDevelopmentToken(): string | null {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new MetaError('META_STORAGE_UNAVAILABLE', 'safeStorage is unavailable.');
  }

  const tokenPath = getTokenFilePath();
  if (!existsSync(tokenPath)) {
    return null;
  }

  try {
    return safeStorage.decryptString(readFileSync(tokenPath));
  } catch {
    return null;
  }
}

export function deleteDevelopmentToken(): MetaTokenStatus {
  const tokenPath = getTokenFilePath();
  if (existsSync(tokenPath)) {
    rmSync(tokenPath, { force: true });
  }

  return createStatus(false);
}
