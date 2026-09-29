import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { shell } from 'electron';
import { z } from 'zod';
import { MetaError } from './meta.errors';

const exchangeSchema = z.object({ accessToken: z.string().min(1) });
const LOGIN_TIMEOUT_MS = 120_000;
declare const __META_OAUTH_BROKER_URL__: string;

export function validateCallback(url: URL, expectedState: string): string {
  if (url.pathname !== '/oauth/callback' || url.searchParams.get('state') !== expectedState) {
    throw new MetaError('META_OAUTH_INVALID_CALLBACK', 'OAuth state mismatch.');
  }
  if (url.searchParams.get('error') === 'cancelled') {
    throw new MetaError('META_OAUTH_CANCELLED', 'OAuth was cancelled.');
  }
  if (url.searchParams.get('error') === 'failed') {
    throw new MetaError('META_API_ERROR', 'OAuth broker could not complete login.');
  }
  const handoff = url.searchParams.get('handoff');
  if (!handoff || !/^[A-Za-z0-9_-]{20,200}$/.test(handoff)) {
    throw new MetaError('META_OAUTH_INVALID_CALLBACK', 'OAuth handoff is missing.');
  }
  return handoff;
}

export async function requestOAuthToken(): Promise<string> {
  const configured = process.env.META_OAUTH_BROKER_URL || __META_OAUTH_BROKER_URL__;
  if (!configured) throw new MetaError('META_OAUTH_UNCONFIGURED', 'OAuth broker URL is missing.');
  let broker: URL;
  try {
    broker = new URL(configured);
  } catch {
    throw new MetaError('META_OAUTH_UNCONFIGURED', 'OAuth broker URL is invalid.');
  }
  if (broker.protocol !== 'https:' && !(broker.hostname === '127.0.0.1' && broker.protocol === 'http:')) {
    throw new MetaError('META_OAUTH_UNCONFIGURED', 'OAuth broker must use HTTPS.');
  }

  const state = randomBytes(24).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  let onHandoff: (value: string) => void = () => undefined;
  let onError: (error: Error) => void = () => undefined;
  const handoffPromise = new Promise<string>((resolve, reject) => {
    onHandoff = resolve;
    onError = reject;
  });
  let callbackHandled = false;
  const server = createServer((request, response) => {
    if (callbackHandled) {
      response.writeHead(409);
      response.end();
      return;
    }
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const handoff = validateCallback(url, state);
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end('<!doctype html><meta charset="utf-8"><title>Đã kết nối</title><p>Đã nhận kết quả đăng nhập. Bạn có thể quay lại ứng dụng.</p>');
      callbackHandled = true;
      onHandoff(handoff);
    } catch (error) {
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end('Phiên đăng nhập không hợp lệ.');
      if (urlLooksLikeCallback(request.url)) onError(error instanceof Error ? error : new Error('Invalid callback'));
    }
  });

  try {
    server.listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const port = (server.address() as AddressInfo).port;
    const login = new URL('/oauth/start', broker);
    login.searchParams.set('state', state);
    login.searchParams.set('challenge', challenge);
    login.searchParams.set('callback', `http://127.0.0.1:${port}/oauth/callback`);
    await shell.openExternal(login.toString());

    let timeout: ReturnType<typeof setTimeout> | undefined;
    const handoff = await Promise.race([
      handoffPromise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new MetaError('META_OAUTH_CANCELLED', 'OAuth timed out.')), LOGIN_TIMEOUT_MS);
      })
    ]).finally(() => clearTimeout(timeout));
    const exchange = new URL('/oauth/exchange', broker);
    const response = await fetch(exchange, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handoff, verifier }),
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) throw new MetaError('META_OAUTH_INVALID_CALLBACK', 'OAuth exchange failed.');
    const parsed = exchangeSchema.safeParse(await response.json());
    if (!parsed.success) throw new MetaError('META_VALIDATION_ERROR', 'Invalid OAuth exchange response.');
    return parsed.data.accessToken;
  } finally {
    server.close();
  }
}

function urlLooksLikeCallback(value: string | undefined): boolean {
  return value?.startsWith('/oauth/callback') ?? false;
}
