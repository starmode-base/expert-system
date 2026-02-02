/**
 * X OAuth2 Type Definitions
 *
 * This module contains TypeScript interfaces for the X (Twitter) OAuth2
 * authentication flow and API responses.
 */

/**
 * OAuth2 session stored in an encrypted cookie during the auth flow.
 *
 * This session is created when the user starts OAuth (/api/x-bookmarks-start)
 * and read back when X redirects to the callback (/api/x-bookmarks-callback).
 *
 * IMPORTANT: We store viewerId here because Clerk auth doesn't work on the
 * callback endpoint - when X redirects back, it's an external redirect and
 * Clerk needs to do a "handshake" which breaks the flow. By storing the
 * viewerId in the encrypted session cookie, we can identify the user without
 * relying on Clerk in the callback.
 */
export interface XOAuthSession {
  /** Random string for CSRF protection - must match on callback */
  state: string;
  /** PKCE code verifier - used to prove we initiated the auth request */
  codeVerifier: string;
  /** Our internal user ID - stored because Clerk auth fails on external redirects */
  viewerId: string;
}

/**
 * Token response from X OAuth2 token endpoint (POST /2/oauth2/token)
 *
 * Returned when exchanging an authorization code or refreshing a token.
 */
export interface XTokenResponse {
  /** The access token for API calls */
  access_token: string;
  /** Always "bearer" for OAuth2 */
  token_type: string;
  /** Seconds until the access token expires (typically 7200 = 2 hours) */
  expires_in: number;
  /** Refresh token for getting new access tokens (only if offline.access scope) */
  refresh_token?: string;
  /** Space-separated list of granted scopes */
  scope?: string;
}

/**
 * Stored auth record for X bookmarks (mirrors the x_bookmarks_auth DB table)
 */
export interface XAuthRecord {
  id: string;
  /** Our internal user ID (foreign key to users table) */
  userId: string;
  /** X's user ID (needed for bookmarks API - must match authenticated user) */
  xUserId: string;
  /** Refresh token for automated token refresh */
  refreshToken: string;
  /** Current access token */
  accessToken: string;
  /** When the access token expires */
  expiresAt: Date;
  /** Pagination cursor for incremental bookmark sync */
  lastSyncCursor: string | null;
}

/**
 * X user object from the /2/users/me endpoint
 */
export interface XUser {
  /** X's user ID (numeric string) */
  id: string;
  /** Display name */
  name: string;
  /** @handle without the @ */
  username: string;
}

/**
 * Response wrapper from /2/users/me endpoint
 */
export interface XUserMeResponse {
  data: XUser;
}

/**
 * X bookmark folder object
 */
export interface XBookmarkFolder {
  id: string;
  name: string;
}

/**
 * Response from getBookmarkFolders endpoint
 */
export interface XBookmarkFoldersResponse {
  data?: XBookmarkFolder[];
  meta?: {
    next_token?: string;
    result_count?: number;
  };
}
