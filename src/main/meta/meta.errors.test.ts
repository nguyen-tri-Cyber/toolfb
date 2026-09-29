import { describe, expect, it } from 'vitest';
import { normalizeGraphError, toVietnameseMetaMessage } from './meta.errors';

describe('normalizeGraphError', () => {
  it('maps common Meta token, permission, and rate-limit errors', () => {
    expect(normalizeGraphError(401, 190)).toBe('META_TOKEN_INVALID');
    expect(normalizeGraphError(401, 190, 463)).toBe('META_TOKEN_EXPIRED');
    expect(normalizeGraphError(401, 190, 467)).toBe('META_TOKEN_REVOKED');
    expect(normalizeGraphError(403, 200)).toBe('META_PERMISSION_DENIED');
    expect(normalizeGraphError(429, 4)).toBe('META_RATE_LIMITED');
  });

  it('returns safe Vietnamese messages without raw API details', () => {
    expect(toVietnameseMetaMessage('META_TOKEN_INVALID')).toBe(
      'Access Token không hợp lệ hoặc đã hết hạn.'
    );
  });
});
