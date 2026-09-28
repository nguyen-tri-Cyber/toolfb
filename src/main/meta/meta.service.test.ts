import { describe, expect, it } from 'vitest';
import { MetaError } from './meta.errors';
import { MetaService } from './meta.service';

describe('MetaService', () => {
  it('throws META_TOKEN_MISSING before calling Meta when no token is stored', async () => {
    const service = new MetaService({
      readToken: () => null,
      client: {
        getAccessiblePages: async () => {
          throw new Error('client should not be called');
        },
        getPageDetails: async () => {
          throw new Error('client should not be called');
        }
      }
    });

    await expect(service.getAccessiblePages()).rejects.toMatchObject<Partial<MetaError>>({
      code: 'META_TOKEN_MISSING'
    });
  });
});
