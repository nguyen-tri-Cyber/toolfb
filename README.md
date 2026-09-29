# Facebook Sales Intelligence

Facebook Sales Intelligence (FSI) is a local-first Windows desktop application for collecting data from Facebook Pages you own, detecting sales leads from comments, managing a lightweight lead workflow, and reporting/exporting results.

## Requirements

- Node.js 20 or newer
- npm
- Windows desktop environment for running Electron

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

This launches the Electron desktop app through `electron-vite`.

## Type Check

```bash
npm run typecheck
```

## Build

```bash
npm run build
```

## Project Architecture

- `src/main` contains the Electron main process, SQLite initialization, Drizzle schema, services, and IPC handlers.
- `src/preload` exposes the minimal typed `window.fsi` API through `contextBridge`.
- `src/renderer` contains the React, React Router, Zustand, and Tailwind renderer application.
- `src/shared` contains shared IPC constants, Zod schemas, and TypeScript types.

Runtime flow:

```text
React Renderer
  -> Preload API
  -> IPC
  -> Main Process
  -> Services / SQLite / Drizzle
```

## Database Location

The SQLite database is created automatically under Electron's `userData` directory:

```text
app.getPath("userData")/fsi.db
```

The database is not stored inside the source tree.

## Current Phase

Owned Page MVP with production OAuth integration scaffolding

Implemented:

- Secure Electron shell
- Typed preload API
- SQLite database initialization
- Drizzle ORM schema
- Database health check
- Database-backed dashboard statistics
- React Router navigation shell and Vietnamese desktop UI
- Vietnamese application UI
- System-browser Meta OAuth flow through a separate broker
- Secure encrypted token storage with Electron `safeStorage`
- Meta Graph API client in the Electron main process
- Accessible Facebook Page discovery
- Local Facebook Page import and duplicate-safe upsert
- Page post sync with bounded Graph API pagination and retry/backoff
- Comment sync with duplicate-safe SQLite upsert
- Incremental post re-sync using a 7-day overlap, plus comment rechecks on every stored post
- Persistent sync jobs with SUCCESS/FAILED/CANCELLED state and interrupted-job recovery
- Cooperative sync cancellation from the Pages screen; a new run safely upserts earlier results
- Local Vietnamese rule-based lead detection without AI
- Duplicate-safe lead creation from Facebook comments
- Posts and Comments screens with search, Page filter, pagination, and source links
- Lead Inbox with Page/status/score/search filters
- Lead status workflow: New / Contacted / Qualified / Won / Lost
- Lead notes and tags
- CSV export with UTF-8 BOM, filter support, and spreadsheet-formula neutralization
- Local report summary with workflow counts, conversion rate, and top lead-generating posts
- Controlled external-link opening, CSP, context isolation, sandboxed renderer, and typed IPC validation
- Compatibility migration test for older SQLite schemas

## Owned Page MVP

The current build completes the core local value loop for Pages owned by the connected account:

```text
Connect Meta account
  -> import owned Page
  -> sync posts/comments
  -> detect lead intent locally
  -> review/update lead
  -> add note/tags
  -> export CSV / view reports
```

AI is not required for this workflow.

### Meta Documentation Verified

Verified on September 23, 2026:

- Current Graph API version used by this app: `v26.0`
- Version source: Meta Graph API v26.0 changelog, released July 29, 2026
- Accessible Pages endpoint: `GET https://graph.facebook.com/v26.0/me/accounts`
- Page details endpoint: `GET https://graph.facebook.com/v26.0/{page-id}`
- Development permission required for accessible Pages: `pages_show_list`
- Additional Page field access can require Page permissions such as `pages_read_engagement`, `pages_read_user_content`, `pages_manage_ads`, or `pages_manage_metadata` depending on fields and Page configuration.

Documentation:

- https://developers.facebook.com/docs/graph-api/changelog/version26.0/
- https://developers.facebook.com/docs/graph-api/reference/user/accounts/
- https://developers.facebook.com/docs/graph-api/reference/page/
- https://developers.facebook.com/docs/permissions/reference/pages_show_list/

The Graph API version is centralized in:

```text
src/shared/constants/meta.ts
```

### Production OAuth Configuration

The Electron app uses the system browser and a separate OAuth broker. The Meta App Secret must
only be configured on the broker server. See [the deployment checklist](docs/meta-oauth.md).

1. Create a Meta app and configure Facebook Login with the exact HTTPS redirect URI
   `https://your-auth-domain/oauth/callback`.
2. Configure `META_APP_ID`, `META_APP_SECRET`, and `META_REDIRECT_URI` on the broker host.
3. Put the broker behind HTTPS; run `npm run broker` as its application process.
4. Set `META_OAUTH_BROKER_URL=https://your-auth-domain` when building Electron. The URL is
   embedded in the main bundle. Local development may also set it at runtime.
5. Complete Meta App Review/Advanced Access for the permissions used by the Owned Page MVP.
6. Open FSI and complete the four onboarding steps.

The sample `.env.example` contains placeholders only. Do not put a real secret in the desktop
build, source tree, issue tracker, screenshots, or logs.

### Token Storage

The renderer sends the token once through the typed preload API. The raw token is then handled only in the Electron main process.

Token storage rules:

- Stored with Electron `safeStorage.encryptString` after OAuth completes.
- Saved as encrypted bytes under Electron `userData`.
- Not stored in SQLite.
- Not returned to the renderer.
- Not logged.
- If `safeStorage` is unavailable, the app refuses to save the credential and shows a Vietnamese error.

### Current Limitations

- Production Meta App credentials and an HTTPS broker deployment are still required
- Live Meta OAuth and App Review have not been validated with a real Meta app yet
- Production App Review/permission approval not completed
- Every sync rechecks comments on all stored posts, including posts outside the 7-day incremental window. This can take longer and use many Graph API requests for large Pages.
- Graph API pagination limits remain (20 post pages and 50 comment pages per post by default). Reaching a limit fails the sync rather than marking it complete; large Pages still need a resumable cursor strategy.
- Cancellation takes effect after the current Graph API request completes. Durable per-post progress and automatic resume after restart are not implemented yet.
- Replies/advanced conversation threading are not a finished workflow.
- Lead rules are currently built-in presets; end-user rule editing is not implemented.
- CSV export is implemented; XLSX export is not.
- Reports are all-time summaries; date-range analytics and shared report filters are not implemented.
- Bulk lead actions and lead-history/audit trail are not implemented.
- AI enrichment is not implemented and is intentionally not required by the core MVP.
- Windows installer, code signing, auto-update, licensing, and production distribution are not implemented.
- Live Meta sync still requires a locally configured valid token and permissions; automated tests use fixtures/mocks.

## Not Implemented Yet

- Production Meta OAuth
- AI analysis
- User-configurable lead rule editor
- XLSX export
- Bulk CRM actions and workflow history
- Date-range analytics
- Full-history comment refresh strategy for old posts
- Backup/restore workflow
- Cloud backend
- Windows installer / code signing / auto-update
- Licensing / billing
