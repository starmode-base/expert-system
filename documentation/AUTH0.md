# Auth0 operations

## Environments

Tenant: `dev-jpxui5jt72ix5l8d.us.auth0.com` (separate applications/resources for
production and local development).

| Environment | Site origin                          | MCP audience                                 | Web client                         |
| ----------- | ------------------------------------ | -------------------------------------------- | ---------------------------------- |
| Production  | `https://expert-system.starmode.dev` | `https://expert-system.starmode.dev/api/mcp` | `9oIQIT4yglG0sUQsTp01kryZZRjl3jxs` |
| Development | `http://localhost:3009`              | `http://localhost:3009/api/mcp`              | `l39dZnVnW1ekDchSxlZ3JJ3zVL0qLQS7` |
| Preview     | Unconfigured                         | None                                         | `AUTH0_DISABLED=true`              |

Ephemeral Vercel previews deliberately cannot authenticate. For staging, provision
an owned stable origin, a separate Auth0 application and resource, and a separate
database, then replace the Preview disable flag for that stable branch only.
Never point preview callbacks or resources at production.

Server variables in Vercel (`--scope starmode`): `AUTH0_ISSUER`,
`AUTH0_WEB_CLIENT_ID`, `AUTH0_WEB_CLIENT_SECRET`, `AUTH0_MCP_RESOURCE`,
`APP_COOKIE_SECRET`, and `SITE_ORIGIN`. Cookie secrets differ by environment.
Production/Preview secrets are sensitive and cannot be downloaded by Vercel CLI.
No local `.env` or `.env.local` was modified during migration. Local testing needs
the development variables exported into the process (or an explicitly approved
local environment-file update). Use port 3009, matching the registered callback.

## Developer access after first login

Developer access is disabled until `DEV_AUTH0_SUBJECT` is set.

1. Sign up/sign in on the deployed site and verify the email address.
2. Locate your user with `auth0 users list`; verify the account yourself and copy
   its exact `user_id` (for example `auth0|...` or `google-oauth2|...`). Do not use
   an email, web client ID, or the internal database user ID.
3. Set `DEV_AUTH0_SUBJECT` using `vercel env add DEV_AUTH0_SUBJECT production
--scope starmode`, entering the subject when prompted. Set Development
   separately if desired. Redeploy so the new value takes effect.
4. Confirm the Dev navigation and protected server operations work for that
   account and remain denied to other users. The earnings system curator also
   uses this identity, so its verified web login must exist in `users`.

## Identity and security behavior

Web login uses Authorization Code + S256 PKCE, state, nonce, and verified email.
Transactions expire after ten minutes and are atomically consumed before exchange.
Sessions rotate on login, last 90 days, and slide: any page load renews the
session and cookie to a fresh 90 days (at most once a day), so a session only
ends after 90 days without a visit, or on logout/back-channel revocation. Only
SHA-256 bearer hashes are stored. `__Host-` cookies are Secure, HttpOnly, SameSite=Lax, Path=/ with no Domain.
Local browser support must accept Secure localhost cookies; use HTTPS locally if
needed. Logout is a same-origin POST. Auth0 back-channel logout validates signed
logout claims and revokes matching sessions (sid and sub are conjunctive).
Repeated valid logout messages are harmless: they cannot revive sessions.

MCP access tokens require RS256, RFC 9068 `at+jwt`, exact issuer and resource,
expiration, subject, client ID, and `expert-system:read`. Scope failures are 403;
invalid/missing/revoked credentials are 401. MCP-only users can have no email.
They retain their internal ID when verified web login enriches their profile.
Stripe, quota, REST API keys and organizations use that same internal ID.

Auth0 access tokens last ten minutes. Revoke refresh tokens/grants in Auth0 to
prevent renewal. Already-issued JWTs remain valid until expiration unless their
hash is inserted into `revoked_mcp_tokens` through the server-side
`revokeAccessToken(token, expiresAt)` helper. This is an administrative helper,
not a public endpoint. Web logout/back-channel logout revokes web sessions; it
does not implicitly cancel independent MCP grants. Never log raw bearer tokens.
Periodically delete expired auth transactions, sessions, and revocation records.

X OAuth cookies use purpose-separated encryption derived from `APP_COOKIE_SECRET`.
Changing it invalidates pending X authorization transactions; no Auth0 client
secret is used for cookie encryption.

## Tenant registration and maintenance

Resource parameter compatibility and CIMD advertisement are enabled. Registered
CIMD URLs are `https://chatgpt.com/oauth/client.json` and
`https://claude.ai/oauth/mcp-oauth-client-metadata`. Redirect URIs were read from
the published documents before registration. Auth0 third-party clients use strict
security mode, explicit consent, and a default **user** grant containing only
`expert-system:read`. All web and registered MCP clients use rotating refresh
tokens with a one-year absolute lifetime and a 90-day idle lifetime, so a
connected MCP client stays signed in for up to a year if used at least
quarterly. Ten-minute access tokens keep revocation meaningful.

Database and Google connections are promoted to domain level for third-party login.
DCR is enabled for compatibility. Treat its registration endpoint as public:
review `auth0 apps list` and tenant logs regularly, investigate unexpected
registration growth, and remove abandoned clients after checking active usage.
Do not delete an active client's registration or rotate its credentials blindly.
Confidential DCR clients may default to non-rotating refresh tokens: inspect each
registration and enforce rotation before approving interoperability testing.
Auth0 discovery advertises both S256 and plain; the web implementation uses S256,
and strict third-party controls enforce PKCE. Verify each client uses S256.

This tenant currently does not advertise authorization response issuer support.
OpenAI may therefore use a callback-specific CIMD URL instead of the stable URL.
Register the exact URL shown in the connection's management page if Auth0
requires preregistration; validate its published redirects before doing so.

## Rollout and verification

Migration `0035_chemical_leech.sql` performs the explicitly authorized identity
reset and creates the Auth0 schema. It preserves shared research/financial data.
Old API keys, user-linked data and pending X links are intentionally invalidated.
Development was updated with `bun run db:push`; do not run this migration on that
already-pushed schema without reconciling migration history. Production applies
the migration once using its existing Drizzle migration history.

Required human-assisted acceptance checks remain: Codex/OpenAI and Claude login,
consent/denial, actual token exchange and `get_profile`, data-tool execution,
refresh, revocation/reconnection, and logout. Also validate Stripe checkout and
portal, API-key creation, and X reconnect after verified web login. Unit tests
and unsigned HTTP probes do not substitute for these account-level checks.
