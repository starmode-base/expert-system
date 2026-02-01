# X Bookmarks → Daily Downloader (OAuth2 + PKCE + Refresh) — Implementation Plan

Goal: Authenticate once with OAuth 2.0 User Context, then run a daily job that:

1. refreshes an access token via `POST https://api.x.com/2/oauth2/token`
2. reads new bookmarks
3. stores the text (and optionally expands linked-article text)

This plan is written for a coding agent to implement in a TypeScript repo.

---

## 0) Key Docs / Constraints (source of truth)

- **TypeScript XDK OAuth2 helpers**: `OAuth2`, `generateCodeVerifier`, `generateCodeChallenge`, `getAuthorizationUrl`, `exchangeCode`. [oai_citation:0‡X Developer Platform](https://docs.x.com/xdks/typescript/authentication)
- **OAuth2 user access + refresh flow** (token endpoint + required form params + confidential-client Basic auth details). [oai_citation:1‡X Developer Platform](https://docs.x.com/fundamentals/authentication/oauth-2-0/user-access-token)
- **Bookmarks endpoint**: `GET /2/users/{id}/bookmarks` (max_results 1..100, pagination_token, tweet.fields, expansions, etc.). [oai_citation:2‡X Developer Platform](https://docs.x.com/x-api/users/get-bookmarks)

---

## 1) Requirements & Decisions

### 1.1 X App setup

- Enable OAuth 2.0 in the X developer console
- Set a Redirect URI (exact match required)
- Capture:
  - `X_CLIENT_ID`
  - `X_CLIENT_SECRET` (needed for confidential client flows / Basic auth to token endpoint) [oai_citation:3‡X Developer Platform](https://docs.x.com/fundamentals/authentication/oauth-2-0/user-access-token)
  - `X_REDIRECT_URI`

### 1.2 Scopes

Minimum for bookmarks:

- `tweet.read`
- `users.read`
- `bookmark.read`
  Add for automation:
- `offline.access` (to get refresh tokens) [oai_citation:4‡X Developer Platform](https://docs.x.com/fundamentals/authentication/oauth-2-0/user-access-token)

### 1.3 Token storage model (important)

Store tokens in DB/kv:

- `refresh_token` (primary credential for automation)
- `access_token` + `expires_at` (cacheable)
- `user_id` (from `/2/users/me`)
- optional: `scope`, `token_type`

Refresh tokens often rotate: after refresh, **always overwrite stored refresh_token** with the latest returned value (if present). (General OAuth best practice.)

---

## 2) Repo Structure (for this repo)

- `src/inngest/importers/scheduled/x-bookmarks/`
  - `x-bookmarks-job.ts`
    Daily Inngest function (cron) that refreshes auth → fetches bookmarks →
    inserts documents → triggers takeaways.
  - `x-bookmarks-helpers.ts`
    Mapping utilities (tweet → document fields, URL extraction, prompt text).
  - `x-client/`
    - `oauth.ts`
      Build auth URL + exchange code using XDK OAuth2 helpers.
    - `token.ts`
      Refresh via `POST /2/oauth2/token` (form-urlencoded; Basic auth).
    - `client.ts`
      Creates an XDK `Client` from access token.
    - `types.ts`
      Token + auth record types.
- `src/routes/api/x-bookmarks-start.ts`
  `/api/x-bookmarks/start` OAuth2 start endpoint (redirect).
- `src/routes/api/x-bookmarks-callback.ts`
  `/api/x-bookmarks/callback` OAuth2 callback endpoint (store tokens + user id).
- `src/inngest/importers/helpers/get-document-summary.ts`
  Shared doc summary helper already used by other importers.
- `src/postgres/schema.ts`
  Add an auth table for X bookmarks (tokens + user_id + sync cursor).

---

## 3) OAuth2 Interactive Setup Flow (one-time user connect)

### 3.1 Start endpoint: `/auth/x/start`

Purpose: generate PKCE + state, redirect user to X consent page.

Implementation steps:

1. Generate:
   - `state` (random, URL-safe)
   - `codeVerifier` via XDK `generateCodeVerifier()`
   - `codeChallenge` via XDK `generateCodeChallenge(codeVerifier)` [oai_citation:5‡X Developer Platform](https://docs.x.com/xdks/typescript/authentication)
2. Persist `{ state, codeVerifier }` in a short-lived server session (or encrypted HTTP-only cookie).
3. Create `OAuth2` with:
   - clientId, clientSecret, redirectUri, scope[] [oai_citation:6‡X Developer Platform](https://docs.x.com/xdks/typescript/authentication)
4. Call:
   - `oauth2.setPkceParameters(codeVerifier, codeChallenge)`
   - `authUrl = await oauth2.getAuthorizationUrl(state)` [oai_citation:7‡X Developer Platform](https://docs.x.com/xdks/typescript/authentication)
5. Redirect to `authUrl`.

Acceptance criteria:

- Visiting `/auth/x/start` takes you to X consent screen.
- Session contains verifier + state.

### 3.2 Callback endpoint: `/auth/x/callback`

Purpose: verify `state`, exchange auth code for tokens, persist refresh token.

Implementation steps:

1. Read query params: `code`, `state`.
2. Load expected `{ state, codeVerifier }` from session.
3. Verify state matches (reject if mismatch).
4. Exchange code for tokens:
   - `tokens = await oauth2.exchangeCode(code, codeVerifier)` [oai_citation:8‡X Developer Platform](https://docs.x.com/xdks/typescript/authentication)
5. Persist:
   - `refresh_token` (requires `offline.access`) [oai_citation:9‡X Developer Platform](https://docs.x.com/fundamentals/authentication/oauth-2-0/user-access-token)
   - `access_token`, `expires_in` → compute `expires_at`
6. Immediately call `GET /2/users/me` using access_token to get the authenticated user id (store it). (This is referenced as needed for bookmarks lookup.) [oai_citation:10‡X Developer Platform](https://docs.x.com/x-api/posts/bookmarks/quickstart/bookmarks-lookup)

Acceptance criteria:

- DB has a row with `user_id`, `refresh_token`, `access_token`, `expires_at`.
- You can successfully fetch bookmarks for that user id.

---

## 4) Refresh Token Implementation (automation-critical)

### 4.1 Endpoint

`POST https://api.x.com/2/oauth2/token` [oai_citation:11‡X Developer Platform](https://docs.x.com/fundamentals/authentication/oauth-2-0/user-access-token)

### 4.2 Form parameters (refresh grant)

- `Content-Type: application/x-www-form-urlencoded`
- body:
  - `grant_type=refresh_token`
  - `refresh_token=...`
  - `client_id=...` [oai_citation:12‡X Developer Platform](https://docs.x.com/fundamentals/authentication/oauth-2-0/user-access-token)

### 4.3 Confidential client auth (recommended)

Add header:

- `Authorization: Basic base64(client_id:client_secret)` [oai_citation:13‡X Developer Platform](https://docs.x.com/fundamentals/authentication/oauth-2-0/user-access-token)

Coding agent tasks:

- Implement `refreshAccessToken(refresh_token)` that:
  1. POSTs to token endpoint with form-urlencoded body
  2. includes Basic auth header if `X_CLIENT_SECRET` is set
  3. returns `{ access_token, expires_in, refresh_token? }`
  4. updates DB (overwrite refresh_token if present)

Acceptance criteria:

- Refresh succeeds without user interaction
- Stored tokens update correctly (access + expiry; refresh rotates if returned)

---

## 5) Bookmarks Fetch + Sync (MacroVoices-style pattern)

Mirror the MacroVoices flow: fetch candidates → remove existing → enrich →
summarize → insert.

### 5.1 Fetch bookmarks

Endpoint:

- `GET https://api.x.com/2/users/{id}/bookmarks` [oai_citation:14‡X Developer Platform](https://docs.x.com/x-api/users/get-bookmarks)

Query params:

- `max_results` (1..100) [oai_citation:15‡X Developer Platform](https://docs.x.com/x-api/users/get-bookmarks)
- `pagination_token` (use `meta.next_token` for paging) [oai_citation:16‡X Developer Platform](https://docs.x.com/x-api/users/get-bookmarks)
- `tweet.fields=created_at,author_id,public_metrics,entities` (tune)
- optionally `expansions=author_id` + `user.fields=username` [oai_citation:17‡X Developer Platform](https://docs.x.com/x-api/posts/bookmarks/quickstart/bookmarks-lookup)

Implementation steps:

1. Ensure you have a valid access token (refresh if expired/near-expiry).
2. Fetch the most recent bookmarks (one page is fine to start; `max_results=30`).
3. Map to lightweight candidates (tweet id, text, created_at, entities.urls).

### 5.2 Diff + insert pattern (MacroVoices-style)

Process:

1. Build canonical tweet links for each candidate
   (`https://x.com/i/web/status/{tweet_id}`).
2. Query `documents` for existing links (same pattern as MacroVoices).
3. Filter to new candidates only.
4. For new candidates:
   - optionally expand URL + extract article text
   - generate summaries via `getDocumentSummary`
5. Insert documents in batch.
6. Trigger takeaways for each inserted document.

Acceptance criteria:

- Running sync twice does not create duplicates.
- New bookmarks are picked up the next day.

---

## 6) Process bookmarks as Documents (macrovoices-style)

This repo standardizes ingest on the `documents` table + takeaway generation.
For bookmarks, treat each new bookmark as a document.

### 6.1 Map a bookmark to `documents`

- `source`: `"X Bookmarks"`
- `title`: derive from tweet text (first ~80–120 chars, trimmed).
- `description`: output of `getDocumentSummary(tweetText, title)` or fallback to
  truncated tweet text.
- `publicationDate`: `tweet.created_at`
- `link`: canonical tweet URL (`https://x.com/i/web/status/{tweet_id}`)
- `articleText`: start with tweet text or extracted
  article text (if exist).

### 6.2 Optional linked-article text extraction

If the tweet contains URLs (from `entities.urls`):

1. Expand shortened URLs (follow redirects)
2. Fetch HTML
3. Reuse existing scraper helpers (e.g. `extract-body-text.ts`)
4. Append extracted text to `articleText` and store the final URL in the link
   list for traceability (keep the document `link` as the tweet URL).

Acceptance criteria:

- New bookmarks become `documents` rows.
- Running the job twice remains idempotent (based on `link` or tweet id).

---

## 7) Daily Job Orchestration (Inngest scheduled importer)

### 7.1 Job steps (daily)

Implement in `src/inngest/importers/scheduled/x-bookmarks/x-bookmarks-job.ts`
with a cron trigger (mirroring `macrovoices-job.ts`).

1. Load auth record (viewerId, refresh_token, access_token, expires_at, user_id,
   last_sync_cursor).
2. If access token expired or expiring soon → refresh via `/2/oauth2/token`. [oai_citation:19‡X Developer Platform](https://docs.x.com/fundamentals/authentication/oauth-2-0/user-access-token)
3. Fetch bookmarks pages.
4. Filter to new bookmarks (by tweet id + last_sync_cursor or by existing
   `documents.link`).
5. Map bookmarks → `documents` rows (Section 6).
6. Insert new documents.
7. Trigger `app/generate-takeaways` for each inserted document, using a custom
   prompt (defined in `x-bookmarks-helpers.ts`).
8. Update last_sync_cursor (and rotated refresh_token if returned).

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

---

## 8) Auth endpoints in this repo (keep OAuth2 flow intact)

Use the same OAuth2 + PKCE flow from Sections 3–4, but wire it into TanStack
Start API routes:

- `/api/x-bookmarks/start` (`src/routes/api/x-bookmarks-start.ts`)
  - Generate `state`, PKCE verifier/challenge.
  - Persist verifier + state in a short-lived cookie/session.
  - Redirect to X consent.
- `/api/x-bookmarks/callback` (`src/routes/api/x-bookmarks-callback.ts`)
  - Validate `state`.
  - Exchange code for tokens with XDK OAuth2.
  - Persist `refresh_token`, `access_token`, `expires_at`, `user_id`, and
    associate with the current viewer if applicable.

Auth helper modules live under
`src/inngest/importers/scheduled/x-bookmarks/x-client/` and are imported by both
the API routes and the scheduled job.

---

## 9) Testing Checklist

- Unit tests:
  - PKCE/state generation persistence
  - Refresh token request builder (form-urlencoded, Basic auth)
  - Bookmark → document mapping
- Integration tests (manual ok at first):
  - `/api/x-bookmarks/start` redirects correctly
  - `/api/x-bookmarks/callback` stores tokens + user id
  - Refresh flow updates tokens
  - Bookmarks fetch returns data
  - Inngest job inserts only new documents

---

## 10) Deliverables for the coding agent

1. Implement `/api/x-bookmarks/start` and `/api/x-bookmarks/callback` using XDK
   OAuth2 flow. [oai_citation:23‡X Developer Platform](https://docs.x.com/xdks/typescript/authentication)
2. Implement `refreshAccessToken()` using `POST /2/oauth2/token` refresh grant. [oai_citation:24‡X Developer Platform](https://docs.x.com/fundamentals/authentication/oauth-2-0/user-access-token)
3. Implement `getMe()` to store `user_id` for bookmarks lookup. [oai_citation:25‡X Developer Platform](https://docs.x.com/x-api/posts/bookmarks/quickstart/bookmarks-lookup)
4. Implement bookmarks sync using `GET /2/users/{id}/bookmarks` with pagination. [oai_citation:26‡X Developer Platform](https://docs.x.com/x-api/users/get-bookmarks)
5. Implement scheduled importer in `src/inngest/importers/scheduled/x-bookmarks/`
   that writes `documents` + triggers takeaways.
6. Optional: article text extraction pipeline (reuse scraper helpers).

---

## Notes / Sharp Edges

- Confidential clients: token endpoint may require Basic auth header (client_id:client_secret base64). [oai_citation:27‡X Developer Platform](https://docs.x.com/fundamentals/authentication/oauth-2-0/user-access-token)
- `max_results` is capped at 100 per request; use `meta.next_token` for pagination. [oai_citation:28‡X Developer Platform](https://docs.x.com/x-api/users/get-bookmarks)
- Bookmarks are private and the `{id}` must match the authenticated user. [oai_citation:29‡X Developer Platform](https://docs.x.com/x-api/users/get-bookmarks)
