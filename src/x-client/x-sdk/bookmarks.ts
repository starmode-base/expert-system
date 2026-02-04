/**
 * X Bookmarks API Functions
 *
 * This module provides functions for fetching bookmarks from X (Twitter).
 *
 * API Endpoint:
 * - GET /2/users/:id/bookmarks/folders/:folder_id - Folder bookmarks (returns IDs only)
 *
 * Authentication: OAuth 2.0 User Context (requires bookmark.read scope)
 *
 * @see https://docs.x.com/x-api/users/get-bookmarks-by-folder-id
 */

const X_API_BASE = "https://api.x.com/2";

// =============================================================================
// TYPES
// =============================================================================

export interface BookmarksFolderResponse {
  data?: { id: string }[];
  errors?: {
    title: string;
    type: string;
    detail: string;
    status: number;
  }[];
  meta?: {
    next_token?: string;
  };
}

// =============================================================================
// FUNCTIONS
// =============================================================================

/**
 * Get bookmarked tweet IDs from a specific folder.
 *
 * Uses: GET /2/users/:id/bookmarks/folders/:folder_id
 *
 * IMPORTANT: This endpoint only returns tweet IDs. To get full tweet details
 * (author, text, metrics, etc.), use a separate tweets lookup endpoint.
 *
 * @param accessToken - OAuth2 access token with bookmark.read scope
 * @param xUserId - The authenticated user's X ID
 * @param folderId - The bookmark folder ID to fetch from
 * @returns Response with array of tweet IDs
 */
export async function getBookmarksByFolder(
  accessToken: string,
  xUserId: string,
  folderId: string,
): Promise<BookmarksFolderResponse> {
  const url = `${X_API_BASE}/users/${xUserId}/bookmarks/folders/${folderId}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();

    if (response.status === 429) {
      const limit = response.headers.get("x-rate-limit-limit");
      const remaining = response.headers.get("x-rate-limit-remaining");
      const reset = response.headers.get("x-rate-limit-reset");
      const resetDate = reset ? new Date(Number(reset) * 1000) : null;

      console.error("Rate limit exceeded:");
      console.error(`  Limit: ${limit ?? "unknown"}`);
      console.error(`  Remaining: ${remaining ?? "unknown"}`);
      console.error(
        `  Reset: ${reset ?? "unknown"} (${resetDate?.toISOString() ?? "unknown"})`,
      );
    }

    throw new Error(
      `Failed to get bookmarks from folder: ${response.status} ${errorText}`,
    );
  }

  return response.json() as Promise<BookmarksFolderResponse>;
}
