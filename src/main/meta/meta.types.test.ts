import { describe, expect, it } from 'vitest';
import {
  graphAccessiblePagesResponseSchema,
  normalizeAccessiblePagesResponse
} from './meta.types';

describe('normalizeAccessiblePagesResponse', () => {
  it('maps Graph API page data into internal summaries and marks imported pages', () => {
    const response = graphAccessiblePagesResponseSchema.parse({
      data: [
        {
          id: '123456789',
          name: 'Cửa hàng Hà Nội',
          category: 'Retail',
          picture: {
            data: {
              url: 'https://example.com/page.jpg'
            }
          }
        }
      ]
    });

    expect(normalizeAccessiblePagesResponse(response, new Set(['123456789']))).toEqual([
      {
        facebookPageId: '123456789',
        name: 'Cửa hàng Hà Nội',
        category: 'Retail',
        pictureUrl: 'https://example.com/page.jpg',
        imported: true
      }
    ]);
  });
});
