import type {
  FacebookPageRecord,
  FacebookPageSummary,
  MetaConnectionStatus
} from '@shared/types/ipc';
import { listFacebookPages, listImportedFacebookPageIds, upsertFacebookPage } from '../database/pages.repository';
import { MetaError } from './meta.errors';
import { MetaGraphApiClient } from './meta.client';
import {
  deleteDevelopmentToken,
  getMetaConnectionStatus,
  readDevelopmentToken,
  saveDevelopmentToken
} from './token.service';

export interface MetaServiceDependencies {
  readToken?: () => string | null;
  saveToken?: (token: string) => MetaConnectionStatus;
  deleteToken?: () => MetaConnectionStatus;
  getStatus?: () => MetaConnectionStatus;
  listImportedIds?: () => Set<string>;
  upsertPage?: (page: Awaited<ReturnType<MetaGraphApiClient['getPageDetails']>>) => FacebookPageRecord;
  client?: Pick<MetaGraphApiClient, 'getAccessiblePages' | 'getPageDetails'>;
}

export class MetaService {
  private readonly readToken: () => string | null;
  private readonly saveToken: (token: string) => MetaConnectionStatus;
  private readonly deleteToken: () => MetaConnectionStatus;
  private readonly getStatus: () => MetaConnectionStatus;
  private readonly listImportedIds: () => Set<string>;
  private readonly upsertPage: (page: Awaited<ReturnType<MetaGraphApiClient['getPageDetails']>>) => FacebookPageRecord;
  private readonly client: Pick<MetaGraphApiClient, 'getAccessiblePages' | 'getPageDetails'>;

  constructor(dependencies: MetaServiceDependencies = {}) {
    this.readToken = dependencies.readToken ?? readDevelopmentToken;
    this.saveToken = dependencies.saveToken ?? saveDevelopmentToken;
    this.deleteToken = dependencies.deleteToken ?? deleteDevelopmentToken;
    this.getStatus = dependencies.getStatus ?? getMetaConnectionStatus;
    this.listImportedIds = dependencies.listImportedIds ?? listImportedFacebookPageIds;
    this.upsertPage = dependencies.upsertPage ?? upsertFacebookPage;
    this.client = dependencies.client ?? new MetaGraphApiClient();
  }

  getConnectionStatus(): MetaConnectionStatus {
    return this.getStatus();
  }

  saveDevelopmentToken(token: string): MetaConnectionStatus {
    return this.saveToken(token);
  }

  disconnect(): MetaConnectionStatus {
    return this.deleteToken();
  }

  async testConnection(): Promise<MetaConnectionStatus> {
    await this.getAccessiblePages();
    return this.getStatus();
  }

  async getAccessiblePages(): Promise<FacebookPageSummary[]> {
    const token = this.requireToken();
    return this.client.getAccessiblePages(token, this.listImportedIds());
  }

  async importPage(pageId: string): Promise<FacebookPageRecord> {
    const token = this.requireToken();
    const page = await this.client.getPageDetails(token, pageId);
    return this.upsertPage(page);
  }

  listImportedPages(): FacebookPageRecord[] {
    return listFacebookPages();
  }

  private requireToken(): string {
    const token = this.readToken();

    if (!token) {
      throw new MetaError('META_TOKEN_MISSING', 'Development token is missing.');
    }

    return token;
  }
}

export const metaService = new MetaService();
