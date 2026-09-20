# Auth0 OAuth 2.1 for the Expert System MCP

## Summary

Replace Clerk with Auth0 across the application, then expose `/api/mcp` as an
OAuth-only MCP resource server. REST API keys remain supported, but MCP clients
authenticate through Auth0 using Authorization Code + PKCE.

Auth0 is preferred because its MCP support, CIMD registration, and RFC 8707
resource handling are generally available, while the repository's Clerk
integration is outdated and Clerk CIMD remains beta. This follows the
[OpenAI OAuth guidance](https://developers.openai.com/plugins/build/auth),
[current MCP authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization),
[Claude Code OAuth behavior](https://code.claude.com/docs/en/mcp), and
[Auth0 Auth for MCP](https://auth0.com/ai/docs/mcp/overview).

OAuth interoperability is the release gate for the plugin plan in
[`expert-system-plugin-plan.md`](./expert-system-plugin-plan.md).

## Implementation Changes

### 1. Replace Clerk application authentication

- Remove `@clerk/tanstack-start`, `ClerkProvider`, Clerk UI components,
  `createClerkHandler`, and Clerk-specific middleware.
- Configure one Auth0 tenant per stable environment and create:
  - A first-party Regular Web Application for the Expert System website.
  - An Auth0 API whose identifier is the canonical MCP URL, such as
    `https://expert-system.starmode.dev/api/mcp`.
- Use `openid-client` for the server-side web authorization-code flow instead
  of turning the application into a browser-only SPA:
  - `/api/auth/login` generates `state`, `nonce`, and an S256 PKCE verifier.
  - `/api/auth/callback` validates the transaction, exchanges the code,
    validates the ID token, upserts the user, rotates the local session, and
    redirects to the original safe same-origin path.
  - `/api/auth/logout` revokes the local session, clears the cookie, and
    redirects through Auth0 logout.
- Store opaque web-session tokens in an HttpOnly, Secure, SameSite=Lax cookie.
  Store only a SHA-256 token hash in a new `auth_sessions` table, with user,
  Auth0 `sid`, expiry, and revocation timestamps.
- Add an Auth0 back-channel logout endpoint that validates signature, issuer,
  audience, events, `sid`/`sub`, and absence of `nonce`, then revokes matching
  local sessions.
- Replace Clerk UI helpers with root-loader authentication state and local
  sign-in/sign-out links. Preserve the existing protected-page behavior.
- Replace the hard-coded Clerk developer identity with a `DEV_AUTH0_SUBJECT`
  environment variable.
- Replace reuse of `CLERK_SECRET_KEY` for X OAuth cookie encryption with a
  dedicated `APP_COOKIE_SECRET`.

### 2. Reset and normalize application identities

- Replace `users.clerkUserId` with a unique `users.auth0Subject`.
- Add nullable `displayName`; allow `email` to be initially nullable because an
  MCP access token is only required to supply a stable `sub`.
- Web login requires and synchronizes a verified email before creating a web
  session. MCP-only users can be provisioned from `sub` and enriched when they
  later use the website.
- Keep the existing internal `users.id` as the stable identity for quota,
  Stripe, API keys, organizations, and the MCP profile tool.
- Update the shared auth middleware to resolve an active local session, load the
  internal user, and expose the same `viewer` contract expected by existing
  server functions.
- Reset user-linked development data during the schema transition, as
  authorized. Use `bun run db:push` while iterating and generate the final
  migration only immediately before the PR.

### 3. Configure Auth0 for MCP

- Enable Auth0's Resource Parameter Compatibility Profile so the MCP `resource`
  parameter maps to the registered MCP API audience.
- Define one API permission: `expert-system:read`.
- Require RS256, Authorization Code + S256 PKCE, explicit consent, short-lived
  access tokens, and rotating refresh tokens.
- Prefer CIMD:
  - Pre-register the published OpenAI and Claude client metadata documents after
    validating their redirect URIs and metadata.
  - Advertise CIMD support through Auth0.
- Enable DCR only as a compatibility fallback for older clients. Treat it as a
  public registration endpoint: apply Auth0 third-party application controls,
  require consent, monitor registrations, and periodically remove abandoned
  clients.
- Use stable development/staging domains and separate Auth0 tenants or
  applications. Do not use ephemeral Vercel preview URLs as production OAuth
  resource identifiers.

Required server configuration will include:

- `AUTH0_ISSUER`
- `AUTH0_WEB_CLIENT_ID`
- `AUTH0_WEB_CLIENT_SECRET`
- `AUTH0_MCP_RESOURCE`
- `APP_COOKIE_SECRET`
- `SITE_ORIGIN`
- `DEV_AUTH0_SUBJECT`

No Auth0 client secret or access token belongs in plugin manifests or repository
files.

### 4. Protect the MCP resource

- Wrap the existing `mcp-handler` endpoint with `withMcpAuth`, with
  authentication required and `expert-system:read` as the required scope.
- Verify Auth0 access tokens locally with `jose` and Auth0 JWKS:
  - Allow only the configured asymmetric algorithm.
  - Validate signature, exact issuer, `exp`, `nbf`, and canonical MCP
    audience/resource.
  - Require `sub` and `expert-system:read`.
  - Reject ID tokens, web-session tokens, REST API keys, and tokens issued for
    any other API.
- Attach the resolved internal `userId`, Auth0 subject, client ID, scopes,
  expiry, and resource to request-local MCP `AuthInfo`.
- Return protocol-level authentication responses:
  - `401` with `WWW-Authenticate` for missing, invalid, expired, revoked, or
    wrong-audience tokens.
  - `403` with `error="insufficient_scope"` and the required scope for valid
    tokens lacking permission.
- Serve public, CORS-enabled metadata at:
  - `/.well-known/oauth-protected-resource/api/mcp`
  - `/.well-known/oauth-protected-resource` as a compatibility alias
- Both documents identify the exact `/api/mcp` resource, Auth0 issuer,
  `expert-system:read`, and MCP documentation URL. The `WWW-Authenticate`
  challenge points to the path-specific document.
- Keep `/api/mcp` OAuth-only. Continue accepting `esak_...` API keys on REST
  `/api/v1` routes.

### 5. Add the authenticated profile tool

Add `get_profile` as the twelfth MCP tool:

- Empty input object.
- Returns exactly one profile for the authenticated token:
  - `id`: stable internal `users.id`.
  - Optional `email`, `name`, and `nickname` when available.
- Mark it read-only and set `_meta["openai/profile"] = true`.
- Publish the exact OpenAI-compatible output schema.
- Do not accept a user ID or account selector from the caller.
- Do not charge quota for this identity-only tool.

Update the plugin plan and MCP documentation to describe OAuth sign-in, remove
MCP API-key/header instructions, and retain API-key documentation only for REST
users.

## Public Interfaces

- New browser routes: `/api/auth/login`, `/api/auth/callback`,
  `/api/auth/logout`, and `/api/auth/backchannel`.
- New public OAuth discovery routes under `/.well-known/`.
- MCP gains `get_profile`; the existing eleven data tools retain their schemas
  and responses.
- `users.clerkUserId` becomes `users.auth0Subject`.
- MCP authentication changes from `Bearer esak_...` to an Auth0 OAuth access
  token with audience equal to the canonical MCP URL and scope
  `expert-system:read`.
- REST authentication and quota behavior remain unchanged.

## Test Plan

- Unit-test JWT verification for valid tokens and failures involving issuer,
  audience/resource, signature, expiry, not-before time, token type, missing
  subject, and missing scope.
- Verify metadata JSON, path-specific discovery, CORS preflight, and exact
  `WWW-Authenticate` challenges.
- Test `401` versus `403` behavior and confirm authentication failures consume
  no quota.
- Test MCP provisioning, stable internal identity, profile output, and isolation
  between concurrent users.
- Re-run all existing MCP parity and billing tests after replacing API-key MCP
  fixtures with authenticated principals.
- Test web login for state, nonce, PKCE, callback replay, unsafe return paths,
  session fixation, cookie flags, expiry, logout, and Auth0 back-channel
  revocation.
- Verify Stripe, usage, API-key management, developer authorization, and X OAuth
  still resolve the correct Auth0-backed user.
- Run end-to-end staging flows with MCP Inspector, Codex/OpenAI, and Claude Code:
  - Initial discovery and consent.
  - CIMD and DCR fallback.
  - Tool discovery and execution.
  - Access-token refresh.
  - Revocation and reauthentication.
  - Denied/cancelled consent.
  - Wrong resource and insufficient scope.
  - Logout and reconnection.
- Complete the repository checks:
  `npx tsc --noEmit && bun run lint && bun run format`, followed by the full
  Vitest suite and a production-equivalent Vinxi build.

## Assumptions

- Existing development users and user-linked data may be cleared; no production
  identity migration is required.
- Auth0 becomes the single identity provider for both website sessions and MCP
  OAuth.
- CIMD is preferred; DCR exists only for backward compatibility.
- The current MCP endpoint, tool behavior, quota accounting, and REST API remain
  otherwise unchanged.
- Plugin packaging and marketplace work resumes only after OAuth passes real
  Codex/OpenAI and Claude interoperability tests.
