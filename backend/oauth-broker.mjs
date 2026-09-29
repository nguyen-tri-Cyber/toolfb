import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const GRAPH_VERSION = 'v26.0';
const SCOPES = 'pages_show_list,pages_read_engagement,pages_read_user_content';
const SESSION_TTL_MS = 120_000;
const HANDOFF_TTL_MS = 60_000;

function send(response, status, body, headers = {}) {
  response.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  response.end(body);
}

function validCallback(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' && url.hostname === '127.0.0.1' &&
      Number(url.port) > 0 && url.pathname === '/oauth/callback' && !url.search && !url.hash;
  } catch {
    return false;
  }
}

async function graphToken(query) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
  const response = await fetch(url, {
    method: 'POST',
    body: new URLSearchParams(query),
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error('Meta token exchange failed');
  const body = await response.json();
  if (typeof body.access_token !== 'string' || !body.access_token) throw new Error('Meta token missing');
  return body.access_token;
}

export function createOAuthBroker(config, exchangeCode = graphToken) {
  const { appId, appSecret, redirectUri } = config;
  if (!appId || !appSecret || !redirectUri) throw new Error('Meta OAuth broker is not configured');
  const sessions = new Map();
  const handoffs = new Map();

  return createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    try {
      if (request.method === 'GET' && url.pathname === '/oauth/start') {
        for (const [key, value] of sessions) if (value.expiresAt < Date.now()) sessions.delete(key);
        for (const [key, value] of handoffs) if (value.expiresAt < Date.now()) handoffs.delete(key);
        if (sessions.size >= 1000 || handoffs.size >= 1000) {
          send(response, 503, 'OAuth broker is busy');
          return;
        }
        const callback = url.searchParams.get('callback');
        const desktopState = url.searchParams.get('state');
        const challenge = url.searchParams.get('challenge');
        if (!validCallback(callback) || !/^[A-Za-z0-9_-]{20,200}$/.test(desktopState ?? '') ||
            !/^[A-Za-z0-9_-]{20,200}$/.test(challenge ?? '')) {
          send(response, 400, 'Invalid OAuth request');
          return;
        }
        const metaState = randomBytes(24).toString('base64url');
        sessions.set(metaState, { callback, desktopState, challenge, expiresAt: Date.now() + SESSION_TTL_MS });
        const login = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
        login.searchParams.set('client_id', appId);
        login.searchParams.set('redirect_uri', redirectUri);
        login.searchParams.set('state', metaState);
        login.searchParams.set('scope', SCOPES);
        login.searchParams.set('response_type', 'code');
        send(response, 302, '', { Location: login.toString() });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/oauth/callback') {
        const metaState = url.searchParams.get('state');
        const session = sessions.get(metaState);
        sessions.delete(metaState);
        if (!session || session.expiresAt < Date.now()) {
          send(response, 400, 'OAuth session expired or was cancelled');
          return;
        }
        if (!url.searchParams.get('code')) {
          const local = new URL(session.callback);
          local.searchParams.set('state', session.desktopState);
          local.searchParams.set('error', 'cancelled');
          send(response, 302, '', { Location: local.toString() });
          return;
        }
        let accessToken;
        try {
          const shortToken = await exchangeCode({
            client_id: appId,
            client_secret: appSecret,
            redirect_uri: redirectUri,
            code: url.searchParams.get('code')
          });
          accessToken = await exchangeCode({
            grant_type: 'fb_exchange_token',
            client_id: appId,
            client_secret: appSecret,
            fb_exchange_token: shortToken
          });
        } catch {
          const local = new URL(session.callback);
          local.searchParams.set('state', session.desktopState);
          local.searchParams.set('error', 'failed');
          send(response, 302, '', { Location: local.toString() });
          return;
        }
        const handoff = randomBytes(32).toString('base64url');
        handoffs.set(handoff, {
          accessToken,
          challenge: session.challenge,
          expiresAt: Date.now() + HANDOFF_TTL_MS
        });
        const local = new URL(session.callback);
        local.searchParams.set('state', session.desktopState);
        local.searchParams.set('handoff', handoff);
        send(response, 302, '', { Location: local.toString() });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/oauth/exchange') {
        let input = '';
        for await (const chunk of request) {
          input += chunk;
          if (input.length > 4096) { send(response, 413, 'Request too large'); return; }
        }
        const { handoff, verifier } = JSON.parse(input);
        const record = handoffs.get(handoff);
        handoffs.delete(handoff);
        if (!record || record.expiresAt < Date.now() || typeof verifier !== 'string') {
          send(response, 400, 'Invalid handoff');
          return;
        }
        const actual = createHash('sha256').update(verifier).digest('base64url');
        const expectedBytes = Buffer.from(record.challenge);
        const actualBytes = Buffer.from(actual);
        if (expectedBytes.length !== actualBytes.length || !timingSafeEqual(expectedBytes, actualBytes)) {
          send(response, 400, 'Invalid verifier');
          return;
        }
        send(response, 200, JSON.stringify({ accessToken: record.accessToken }), {
          'Content-Type': 'application/json; charset=utf-8'
        });
        return;
      }
      send(response, 404, 'Not found');
    } catch {
      send(response, 502, 'OAuth request failed');
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const broker = createOAuthBroker({
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    redirectUri: process.env.META_REDIRECT_URI
  });
  broker.listen(Number(process.env.PORT ?? 8787), '127.0.0.1');
}
