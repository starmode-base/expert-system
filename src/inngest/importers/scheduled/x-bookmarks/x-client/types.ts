/**
 * X OAuth2 token response from token endpoint
 */
export interface XTokenResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  scope: string;
  refresh_token?: string;
}

/**
 * Stored auth record for X Bookmarks
 */
export interface XAuthRecord {
  id: string;
  userId: string;
  xUserId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  lastSyncCursor: string | null;
}

/**
 * PKCE session data stored temporarily during OAuth flow
 */
export interface XOAuthSession {
  state: string;
  codeVerifier: string;
}

/**
 * X User response from /2/users/me
 */
export interface XUserResponse {
  data: {
    id: string;
    name: string;
    username: string;
  };
}

/**
 * X Bookmark (Tweet) from /2/users/{id}/bookmarks
 */
export interface XBookmark {
  id: string;
  text: string;
  created_at?: string;
  author_id?: string;
  entities?: {
    urls?: {
      start: number;
      end: number;
      url: string;
      expanded_url: string;
      display_url: string;
    }[];
  };
}

/**
 * X Bookmarks response from /2/users/{id}/bookmarks
 */
export interface XBookmarksResponse {
  data?: XBookmark[];
  meta?: {
    result_count: number;
    next_token?: string;
  };
  includes?: {
    users?: {
      id: string;
      name: string;
      username: string;
    }[];
  };
}
