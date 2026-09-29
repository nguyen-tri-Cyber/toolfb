import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createOAuthBroker } from './oauth-broker.mjs';

let server;
afterEach(() => server?.close());

test('exchanges a verified handoff once without putting the token in the callback URL', async () => {
  const calls = [];
  server = createOAuthBroker({
    appId: 'app-id', appSecret: 'secret', redirectUri: 'https://example.test/oauth/callback'
  }, async (query) => {
    calls.push(query);
    return calls.length === 1 ? 'short-token' : 'long-token';
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const verifier = 'test-verifier-12345678901234567890';
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const start = new URL('/oauth/start', base);
  start.searchParams.set('state', 'desktop-state-123456789012345');
  start.searchParams.set('challenge', challenge);
  start.searchParams.set('callback', 'http://127.0.0.1:43210/oauth/callback');
  const first = await fetch(start, { redirect: 'manual' });
  assert.equal(first.status, 302);
  const login = new URL(first.headers.get('location'));
  assert.equal(login.searchParams.get('scope'), 'pages_show_list,pages_read_engagement,pages_read_user_content');
  const callback = new URL('/oauth/callback', base);
  callback.searchParams.set('state', login.searchParams.get('state'));
  callback.searchParams.set('code', 'meta-code');
  const second = await fetch(callback, { redirect: 'manual' });
  assert.equal(second.status, 302);
  const local = new URL(second.headers.get('location'));
  assert.equal(local.searchParams.get('state'), 'desktop-state-123456789012345');
  assert.equal(local.searchParams.has('access_token'), false);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].fb_exchange_token, 'short-token');
  const payload = JSON.stringify({ handoff: local.searchParams.get('handoff'), verifier });
  const exchange = await fetch(`${base}/oauth/exchange`, { method: 'POST', body: payload });
  assert.equal(exchange.status, 200);
  assert.deepEqual(await exchange.json(), { accessToken: 'long-token' });
  const replay = await fetch(`${base}/oauth/exchange`, { method: 'POST', body: payload });
  assert.equal(replay.status, 400);
});

test('rejects a non-loopback callback before redirecting to Meta', async () => {
  server = createOAuthBroker({
    appId: 'app-id', appSecret: 'secret', redirectUri: 'https://example.test/oauth/callback'
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = new URL(`http://127.0.0.1:${server.address().port}/oauth/start`);
  url.searchParams.set('state', 'desktop-state-123456789012345');
  url.searchParams.set('challenge', 'challenge-12345678901234567890');
  url.searchParams.set('callback', 'https://attacker.test/oauth/callback');
  assert.equal((await fetch(url)).status, 400);
});

test('rejects an unknown Meta state without exchanging a code', async () => {
  let exchanges = 0;
  server = createOAuthBroker({
    appId: 'app-id', appSecret: 'secret', redirectUri: 'https://example.test/oauth/callback'
  }, async () => { exchanges += 1; return 'token'; });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const callback = new URL(`http://127.0.0.1:${server.address().port}/oauth/callback`);
  callback.searchParams.set('state', 'unknown');
  callback.searchParams.set('code', 'code');
  assert.equal((await fetch(callback)).status, 400);
  assert.equal(exchanges, 0);
});

test('returns a cancellation to the waiting desktop callback', async () => {
  server = createOAuthBroker({
    appId: 'app-id', appSecret: 'secret', redirectUri: 'https://example.test/oauth/callback'
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const start = new URL('/oauth/start', base);
  start.searchParams.set('state', 'desktop-state-123456789012345');
  start.searchParams.set('challenge', 'challenge-12345678901234567890');
  start.searchParams.set('callback', 'http://127.0.0.1:43210/oauth/callback');
  const login = new URL((await fetch(start, { redirect: 'manual' })).headers.get('location'));
  const callback = new URL('/oauth/callback', base);
  callback.searchParams.set('state', login.searchParams.get('state'));
  callback.searchParams.set('error', 'access_denied');
  const response = await fetch(callback, { redirect: 'manual' });
  assert.equal(response.status, 302);
  const local = new URL(response.headers.get('location'));
  assert.equal(local.searchParams.get('error'), 'cancelled');
  assert.equal(local.searchParams.get('state'), 'desktop-state-123456789012345');
});
