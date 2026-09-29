import type {
  FacebookPageRecord,
  FacebookPageSummary,
  MetaConnectionStatus
} from '@shared/types/ipc';
import { META_REQUIRED_PERMISSIONS } from '@shared/constants/meta';
import { listFacebookPages, listImportedFacebookPageIds, upsertFacebookPage } from '../database/pages.repository';
import { MetaError } from './meta.errors';
import { MetaGraphApiClient } from './meta.client';
import {
  deleteCredential,
  getMetaConnectionStatus,
  readAccessToken,
  readCredential,
  saveCredential,
  type MetaCredential
} from './token.service';
import { requestOAuthToken } from './oauth.service';

declare const __IS_DEV__: boolean | undefined;

function isDevelopmentMode(): boolean {
  if (typeof __IS_DEV__ !== 'undefined') return __IS_DEV__;
  return process.env.NODE_ENV !== 'production';
}

export interface MetaServiceDependencies {
  readToken?: () => string | null;
  saveToken?: (credential: MetaCredential) => void;
  deleteToken?: () => void;
  readCredential?: () => MetaCredential | null;
  requestToken?: () => Promise<string>;
  getStatus?: () => MetaConnectionStatus;
  listImportedIds?: () => Set<string>;
  upsertPage?: (page: Awaited<ReturnType<MetaGraphApiClient['getPageDetails']>>) => FacebookPageRecord;
  client?: Pick<MetaGraphApiClient, 'getAccessiblePages' | 'getPageDetails' | 'getIdentity' | 'getGrantedPermissions'>;
  isDev?: boolean;
}

export class MetaService {
  private readonly readToken: () => string | null;
  private readonly saveToken: (credential: MetaCredential) => void;
  private readonly deleteToken: () => void;
  private readonly readCredential: () => MetaCredential | null;
  private readonly requestToken: () => Promise<string>;
  private readonly getStatus: () => MetaConnectionStatus;
  private readonly listImportedIds: () => Set<string>;
  private readonly upsertPage: (page: Awaited<ReturnType<MetaGraphApiClient['getPageDetails']>>) => FacebookPageRecord;
  private readonly client: Pick<MetaGraphApiClient, 'getAccessiblePages' | 'getPageDetails' | 'getIdentity' | 'getGrantedPermissions'>;
  private readonly isDev: boolean;
  private connecting = false;

  constructor(dependencies: MetaServiceDependencies = {}) {
    this.readToken = dependencies.readToken ?? readAccessToken;
    this.saveToken = dependencies.saveToken ?? saveCredential;
    this.deleteToken = dependencies.deleteToken ?? deleteCredential;
    this.readCredential = dependencies.readCredential ?? readCredential;
    this.requestToken = dependencies.requestToken ?? requestOAuthToken;
    this.getStatus = dependencies.getStatus ?? getMetaConnectionStatus;
    this.listImportedIds = dependencies.listImportedIds ?? listImportedFacebookPageIds;
    this.upsertPage = dependencies.upsertPage ?? upsertFacebookPage;
    this.client = dependencies.client ?? new MetaGraphApiClient();
    this.isDev = dependencies.isDev ?? isDevelopmentMode();
  }

  getConnectionStatus(): MetaConnectionStatus {
    const status = this.getStatus();
    if (this.connecting) return { ...status, state: 'connecting', connected: false };
    const credential = this.readCredential();
    if (!credential) return status;
    const missingPermissions = META_REQUIRED_PERMISSIONS.filter(
      (permission) => !credential.grantedPermissions.includes(permission)
    );
    return {
      ...status,
      state: missingPermissions.length ? 'permission_missing' : 'connected',
      connected: missingPermissions.length === 0,
      missingPermissions,
      ...(credential.accountName ? { accountName: credential.accountName } : {})
    };
  }

  async connect(): Promise<MetaConnectionStatus> {
    if (this.connecting) throw new MetaError('META_OAUTH_IN_PROGRESS', 'OAuth is already in progress.');
    this.connecting = true;
    try {
      const token = await this.requestToken();
      const [identity, grantedPermissions] = await Promise.all([
        this.client.getIdentity(token),
        this.client.getGrantedPermissions(token)
      ]);
      this.saveToken({
        accessToken: token,
        accountName: identity.name,
        grantedPermissions,
        savedAt: new Date().toISOString()
      });
    } finally {
      this.connecting = false;
    }
    return this.getConnectionStatus();
  }

  async reconnect(): Promise<MetaConnectionStatus> {
    return this.connect();
  }

  disconnect(): MetaConnectionStatus {
    this.deleteToken();
    return this.getConnectionStatus();
  }

  async setDeveloperToken(token: string): Promise<MetaConnectionStatus> {
    if (!this.isDev) {
      throw new MetaError(
        'META_DEVELOPER_MODE_DISABLED',
        'Developer mode is only available in development environment.'
      );
    }

    const trimmed = token.trim();
    if (!trimmed) {
      throw new MetaError('META_TOKEN_INVALID', 'Access Token không được để trống.');
    }

    const [identity, grantedPermissions] = await Promise.all([
      this.client.getIdentity(trimmed),
      this.client.getGrantedPermissions(trimmed)
    ]);

    this.saveToken({
      accessToken: trimmed,
      accountName: identity.name,
      grantedPermissions,
      savedAt: new Date().toISOString()
    });

    return this.getConnectionStatus();
  }

  async testConnection(): Promise<MetaConnectionStatus> {
    const credential = this.readCredential();
    if (!credential) return this.getConnectionStatus();
    try {
      const [identity, grantedPermissions] = await Promise.all([
        this.client.getIdentity(credential.accessToken),
        this.client.getGrantedPermissions(credential.accessToken)
      ]);
      this.saveToken({ ...credential, accountName: identity.name, grantedPermissions });
      return this.getConnectionStatus();
    } catch (error) {
      if (error instanceof MetaError) {
        const state = error.code === 'META_TOKEN_EXPIRED' ? 'expired' :
          error.code === 'META_TOKEN_REVOKED' ? 'revoked' :
          error.code === 'META_PERMISSION_DENIED' ? 'permission_missing' : 'error';
        return { ...this.getConnectionStatus(), state, connected: false };
      }
      throw error;
    }
  }

  async getAccessiblePages(): Promise<FacebookPageSummary[]> {
    const token = this.requireToken();
    return this.client.getAccessiblePages(token, this.listImportedIds());
  }

  async importPage(pageId: string): Promise<FacebookPageRecord> {
    const token = this.requireToken();
    const accessiblePages = await this.client.getAccessiblePages(token, this.listImportedIds());
    if (!accessiblePages.some((page) => page.facebookPageId === pageId)) {
      throw new MetaError('META_PERMISSION_DENIED', 'Page is not accessible to the connected account.');
    }
    const page = await this.client.getPageDetails(token, pageId);
    return this.upsertPage(page);
  }

  listImportedPages(): FacebookPageRecord[] {
    return listFacebookPages();
  }

  private requireToken(): string {
    const token = this.readToken();

    if (!token) {
      throw new MetaError('META_TOKEN_MISSING', 'Meta connection is missing.');
    }

    return token;
  }
}

export const metaService = new MetaService();
