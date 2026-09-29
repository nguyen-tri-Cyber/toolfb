# Meta OAuth deployment and review checklist

The desktop application opens the system browser at the OAuth broker. The broker exchanges the
Meta authorization code using the App Secret, then issues a one-time handoff bound to a desktop
verifier. The desktop stores the returned user token with Electron `safeStorage`. The renderer
only sees connection state and Page data.

## Broker deployment

- Provision an HTTPS domain such as `auth.example.com` and reverse-proxy to the Node broker.
- Set `META_APP_ID`, `META_APP_SECRET`, and `META_REDIRECT_URI` in server-side secrets/config.
- Register the exact `META_REDIRECT_URI` in Meta's Facebook Login settings.
- Set `META_OAUTH_BROKER_URL` during the Electron build. It must be the broker origin.
- Run one broker instance for now: pending OAuth sessions and handoffs are held in memory.
  Before horizontal scaling, move them to a shared store with atomic one-time redemption.
- Use TLS at the public edge and restrict broker logs so codes, handoffs, and tokens are never logged.
- Restarting the broker cancels pending logins but does not affect credentials already stored on desktops.

## Meta App Review

- Verify the current Facebook Login flow, redirect URI rules, Graph API version, and permissions
  against the Meta developer dashboard before release. Automated documentation fetch was rate limited
  during implementation, so these items need a live configuration review.
- Request `pages_show_list`, `pages_read_engagement`, and `pages_read_user_content` for Page discovery,
  Page posts, and visitor comments respectively. Confirm exact review requirements with Meta.
- Prepare a screencast showing login, Page selection, post/comment sync, and the resulting Lead Inbox.
- Provide privacy policy, data deletion instructions, test account/Page access, and permission use-case text.
- Test approved live mode with a real Page and a user outside app development roles.

## Release checks

- Fresh desktop install: login -> select Page -> import -> first sync -> visible lead data.
- Cancel, expired token, revoked access, and missing permissions show recovery actions.
- Reconnect does not remove local Page, post, comment, or lead records.
- Confirm access token and App Secret are absent from renderer, SQLite, application logs, and build artifacts.
- `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` pass.
