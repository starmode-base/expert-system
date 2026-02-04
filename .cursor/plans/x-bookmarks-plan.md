# X Bookmarks → Daily Downloader (OAuth2 + PKCE + Refresh) — Implementation Plan

Goal: authenticate once with OAuth 2.0 User Context, then run a daily job that:

- Refreshes an access token via `POST https://api.x.com/2/oauth2/token`
- Reads new bookmarks
- Stores the text (and optionally expands linked-article text)

This plan is written for a coding agent to implement in a TypeScript repo.

## 0. Key Docs / Constraints (source of truth)

- XDK TypeScript SDK repo (auth helpers + Client). Use `@xdevplatform/xdk` for OAuth2 + API calls: https://github.com/xdevplatform/xdk-typescript
- OAuth2 token refresh still uses `POST https://api.x.com/2/oauth2/token` when you need a refresh grant (use SDK helper if it exists; otherwise manual POST).
- Bookmarks endpoint is supported by the SDK (see "Bookmarks" support in README); use the SDK Client instead of raw fetch for API calls.

## 1. Requirements & Decisions

### 1.1 X App setup

- Enable OAuth 2.0 in the X developer console
- Set a Redirect URI (exact match required)
- Capture:
  - `X_CLIENT_ID`
  - `X_CLIENT_SECRET` (needed for confidential client flows / Basic auth to token endpoint)
  - `X_REDIRECT_URI`

### 1.1.1 SDK dependency

- Add the XDK SDK: `@xdevplatform/xdk` (bun)
- All OAuth2 helpers and API calls should go through the SDK Client and OAuth2 classes

### 1.2 Scopes

Minimum for bookmarks:

- `tweet.read`
- `users.read`
- `bookmark.read`

Add for automation:

- `offline.access` (to get refresh tokens)

### 1.3 Token storage model (important)

Store tokens in DB/kv:

- `refresh_token` (primary credential for automation)
- `access_token` + `expires_at` (cacheable)
- `user_id` (from `/2/users/me`)
- Optional: `scope`, `token_type`

Refresh tokens often rotate: after refresh, always overwrite stored `refresh_token` with the latest returned value (if present). (General OAuth best practice.)

## 2. Repo Structure (for this repo)

- `src/inngest/importers/scheduled/x-bookmarks/`
  - `x-bookmarks-job.ts` Daily Inngest function (cron) that refreshes auth → fetches bookmarks → inserts documents → triggers takeaways.
  - `x-bookmarks-helpers.ts` Mapping utilities (tweet → document fields, URL extraction, prompt text).
- `src/x-client/`
  - `oauth.ts` Build auth URL + exchange code using XDK OAuth2 helpers.
  - `token.ts` Refresh via `POST /2/oauth2/token` (form-urlencoded; Basic auth).
  - `client.ts` Creates an XDK Client from access token.
  - `types.ts` Token + auth record types.
- `src/routes/api/x-bookmarks-start.ts` `/api/x-bookmarks/start` OAuth2 start endpoint (redirect).
- `src/routes/api/x-bookmarks-callback.ts` `/api/x-bookmarks/callback` OAuth2 callback endpoint (store tokens + user id).
- `src/inngest/importers/helpers/get-document-summary.ts` Shared doc summary helper already used by other importers.
- `src/postgres/schema.ts` Add an auth table for X bookmarks (tokens + user_id + sync cursor).

## 3. OAuth2 Interactive Setup Flow (one-time user connect)

### 3.1 Start endpoint: `/auth/x/start`

Purpose: generate PKCE + state, redirect user to X consent page.

Implementation steps:

- Generate:
  - `state` (random, URL-safe)
  - `codeVerifier` via XDK `generateCodeVerifier()`
  - `codeChallenge` via XDK `generateCodeChallenge(codeVerifier)`
- Persist `{ state, codeVerifier }` in a short-lived server session (or encrypted HTTP-only cookie).
- Create OAuth2 with:
  - `clientId`, `clientSecret`, `redirectUri`, `scope[]`
- Call:
  - `oauth2.setPkceParameters(codeVerifier, codeChallenge)`
  - `authUrl = await oauth2.getAuthorizationUrl(state)`
- Redirect to `authUrl`.

Acceptance criteria:

- Visiting `/auth/x/start` takes you to X consent screen.
- Session contains verifier + state.

### 3.2 Callback endpoint: `/auth/x/callback`

Purpose: verify state, exchange auth code for tokens, persist refresh token.

Implementation steps:

- Read query params: `code`, `state`.
- Load expected `{ state, codeVerifier }` from session.
- Verify state matches (reject if mismatch).
- Exchange code for tokens:
  - `tokens = await oauth2.exchangeCode(code, codeVerifier)`
  - `refresh_token` (requires `offline.access`)
  - `access_token`, `expires_in` → compute `expires_at`
- Immediately call `client.users.getMe()` using the SDK client with `access_token` to get the authenticated user id (store it). (This is referenced as needed for bookmarks lookup.)

Acceptance criteria:

- DB has a row with `user_id`, `refresh_token`, `access_token`, `expires_at`.
- You can successfully fetch bookmarks for that user id.

## 4. Refresh Token Implementation (automation-critical)

### 4.1 Endpoint

- Use the SDK OAuth2 helper for refresh if available
- Otherwise ask user

### 4.2 Form parameters (refresh grant)

- `Content-Type: application/x-www-form-urlencoded`
- Body (if manual refresh):
  - `grant_type=refresh_token`
  - `refresh_token=...`
  - `client_id=...`

### 4.3 Confidential client auth (recommended)

- Add header:
  - `Authorization: Basic base64(client_id:client_secret)`

Coding agent tasks:

- Implement `refreshAccessToken(refresh_token)` that:
  - Uses SDK refresh helper if available, otherwise POSTs to token endpoint with form-urlencoded body
  - Includes Basic auth header if `X_CLIENT_SECRET` is set
  - Returns `{ access_token, expires_in, refresh_token? }`
  - Updates DB (overwrite `refresh_token` if present)

Acceptance criteria:

- Refresh succeeds without user interaction
- Stored tokens update correctly (access + expiry; refresh rotates if returned)

## 5. Bookmarks Fetch + Sync (MacroVoices-style pattern)

Mirror the MacroVoices flow: fetch candidates → remove existing → enrich → summarize → insert.

### 5.1 Fetch bookmarks

Endpoint (via SDK Client):

- Use the SDK bookmarks client to fetch `GET /2/users/{id}/bookmarks`

Query params:

- `max_results` (1..100)
- `pagination_token` (use `meta.next_token` for paging)
- `tweet.fields=created_at,author_id,public_metrics,entities` (tune)
- Optionally `expansions=author_id` + `user.fields=username`

Implementation steps:

- Ensure you have a valid access token (refresh if expired/near-expiry).
- Create an SDK `Client` with `accessToken`.
- Fetch the most recent bookmarks (one page is fine to start; `max_results=30`).
- Map to lightweight candidates (tweet id, text, created_at, entities.urls).

### 5.2 Diff + insert pattern (MacroVoices-style)

Process:

- Build canonical tweet links for each candidate (`https://x.com/i/web/status/{tweet_id}`).
- Query documents for existing links (same pattern as MacroVoices).
- Filter to new candidates only.
- For new candidates:
  - Optionally expand URL + extract article text
  - Generate summaries via `getDocumentSummary`
  - Insert documents in batch.
  - Trigger takeaways for each inserted document.

Acceptance criteria:

- Running sync twice does not create duplicates.
- New bookmarks are picked up the next day.

## 6. Process bookmarks as Documents (MacroVoices-style)

This repo standardizes ingest on the documents table + takeaway generation. For bookmarks, treat each new bookmark as a document.

### 6.1 Map a bookmark to documents

- `source`: `"X Bookmarks"`
- `title`: derive from tweet text (first ~80–120 chars, trimmed).
- `description`: output of `getDocumentSummary(tweetText, title)` or fallback to truncated tweet text.
- `publicationDate`: `tweet.created_at`
- `link`: canonical tweet URL (`https://x.com/i/web/status/{tweet_id}`)
- `articleText`: start with tweet text or extracted article text (if exist).

### 6.2 Optional linked-article text extraction

If the tweet contains URLs (from `entities.urls`):

- Expand shortened URLs (follow redirects)
- Fetch HTML
- Reuse existing scraper helpers (e.g. `extract-body-text.ts`)
- Append extracted text to `articleText` and store the final URL in the link list for traceability (keep the document link as the tweet URL).

Acceptance criteria:

- New bookmarks become documents rows.
- Running the job twice remains idempotent (based on link or tweet id).

## 7. Daily Job Orchestration (Inngest scheduled importer)

### 7.1 Job steps (daily)

Implement in `src/inngest/importers/scheduled/x-bookmarks/x-bookmarks-job.ts` with a cron trigger (mirroring `macrovoices-job.ts`).

- Load auth record (`viewerId`, `refresh_token`, `access_token`, `expires_at`, `user_id`, `last_sync_cursor`).
- If access token expired or expiring soon → refresh via SDK (or `/2/oauth2/token` fallback).
- Fetch bookmarks pages via the SDK client.
- Filter to new bookmarks (by tweet id + `last_sync_cursor` or by existing `documents.link`).
- Map bookmarks → documents rows (Section 6).
- Insert new documents.
- Trigger `app/generate-takeaways` for each inserted document, using a custom prompt (defined in `x-bookmarks-helpers.ts`).
- Update `last_sync_cursor` (and rotated `refresh_token` if returned).

### 7.2 Failure modes to handle

- Refresh returns 401/403:
  - Mark auth as invalid, alert user to reconnect.
- Bookmarks endpoint returns 401:
  - Token refresh failed or scopes missing.
- Rate limits / transient errors:
  - Exponential backoff + retry budget.

Acceptance criteria:

- Job runs daily without manual steps.
- Errors are visible (logs/alerts).

## 8. Auth endpoints in this repo (keep OAuth2 flow intact)

Use the same OAuth2 + PKCE flow from Sections 3–4, but wire it into TanStack Start API routes:

- `/api/x-bookmarks/start` (`src/routes/api/x-bookmarks-start.ts`)
  - Generate state, PKCE verifier/challenge.
  - Persist verifier + state in a short-lived cookie/session.
  - Redirect to X consent.
- `/api/x-bookmarks/callback` (`src/routes/api/x-bookmarks-callback.ts`)
  - Validate state.
  - Exchange code for tokens with XDK OAuth2.
  - Persist `refresh_token`, `access_token`, `expires_at`, `user_id`, and associate with the current viewer if applicable.

Auth helper modules live under `src/x-client/` and are imported by both the API routes and the scheduled job.

## 9. Testing Checklist

Unit tests:

- PKCE/state generation persistence
- Refresh token request builder (form-urlencoded, Basic auth)
- Bookmark → document mapping

Integration tests (manual ok at first):

- `/api/x-bookmarks/start` redirects correctly
- `/api/x-bookmarks/callback` stores tokens + user id
- Refresh flow updates tokens
- Bookmarks fetch returns data
- Inngest job inserts only new documents

## 10. Deliverables for the coding agent

- Implement `/api/x-bookmarks/start` and `/api/x-bookmarks/callback` using XDK OAuth2 flow.
- Implement `refreshAccessToken()` using SDK refresh helper (fallback to `POST /2/oauth2/token` refresh grant).
- Implement `getMe()` with the SDK client to store `user_id` for bookmarks lookup.
- Implement bookmarks sync using the SDK Client bookmarks endpoint with pagination.
- Implement scheduled importer in `src/inngest/importers/scheduled/x-bookmarks/` that writes documents + triggers takeaways.
- Optional: article text extraction pipeline (reuse scraper helpers).

Notes / Sharp Edges:

- Confidential clients: token endpoint may require Basic auth header (`client_id:client_secret` base64).
- `max_results` is capped at 100 per request; use `meta.next_token` for pagination.
- Bookmarks are private and the `{id}` must match the authenticated user.
