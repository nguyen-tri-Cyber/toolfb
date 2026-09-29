import { describe, expect, it } from 'vitest';
import { validateCallback } from './oauth.service';

describe('desktop OAuth callback', () => {
  const state = 'expected-state';
  const handoff = 'handoff-12345678901234567890';

  it('accepts the matching callback and returns only the one-time handoff', () => {
    const url = new URL(`http://127.0.0.1:12345/oauth/callback?state=${state}&handoff=${handoff}`);
    expect(validateCallback(url, state)).toBe(handoff);
  });

  it('rejects mismatched state and malformed handoffs', () => {
    const wrongState = new URL(`http://127.0.0.1:12345/oauth/callback?state=other&handoff=${handoff}`);
    const badHandoff = new URL(`http://127.0.0.1:12345/oauth/callback?state=${state}&handoff=x`);
    expect(() => validateCallback(wrongState, state)).toThrow();
    expect(() => validateCallback(badHandoff, state)).toThrow();
  });

  it('reports a cancelled login with a matching state', () => {
    const cancelled = new URL(`http://127.0.0.1:12345/oauth/callback?state=${state}&error=cancelled`);
    expect(() => validateCallback(cancelled, state)).toThrow();
  });
});
