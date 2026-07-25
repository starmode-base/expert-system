/**
 * X API Client
 *
 * This module provides functions to interact with the X (Twitter) API.
 * It wraps the @xdevplatform/xdk SDK and provides typed helpers.
 *
 * The XDK Client is used for making authenticated API requests.
 * For bookmarks, the user ID from getMe() is required because the
 * bookmarks endpoint only works for the authenticated user.
 */

import { Client } from "@xdevplatform/xdk";
import type {
  XUser,
  XUserMeResponse,
  XBookmarkFolder,
  BookmarksFolderResponse,
  XPostsResponse,
} from "./types";

/**
 * Create an XDK Client configured with an access token.
 *
 * The client handles:
 * - Adding Bearer token to requests
 * - Rate limiting and retries
 * - Response parsing
 *
 * @param accessToken - OAuth2 access token
 * @returns Configured XDK Client instance
 */
export function createXClient(accessToken: string): Client {
  return new Client({ accessToken });
}

/**
 * Get the authenticated user's profile info.
 *
 * This is called after OAuth to get the X user ID, which is required
 * for the bookmarks endpoint (GET /2/users/{id}/bookmarks).
 *
 * The bookmarks API only works when {id} matches the authenticated user,
 * so we must store this ID alongside the tokens.
 *
 * @param accessToken - OAuth2 access token
 * @returns The authenticated user's profile (id, name, username)
 */
export async function getMe(accessToken: string): Promise<XUser> {
  const response = await fetch("https://api.x.com/2/users/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get user info: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as XUserMeResponse;
  return data.data;
}

/**
 * Get the user's bookmark folders.
 *
 * X allows users to organize bookmarks into folders. This fetches
 * the list of folders so the user can select which one to sync.
 *
 * @param accessToken - OAuth2 access token
 * @param xUserId - The X user ID
 * @returns Array of bookmark folders (id and name)
 */
export async function getBookmarkFolders(
  accessToken: string,
  xUserId: string,
): Promise<XBookmarkFolder[]> {
  const client = createXClient(accessToken);

  // Use the XDK client to fetch folders
  const response = await client.users.getBookmarkFolders(xUserId);

  // Return empty array if no folders exist
  if (!response.data) {
    return [];
  }

  // Map to our simpler type (XDK returns Record<string, any>)
  return response.data.map((folder) => ({
    id: folder.id as string,
    name: folder.name as string,
  }));
}

const X_API_BASE = "https://api.x.com/2";
const REQUEST_TIMEOUT_MS = 20_000;
const POST_FIELDS = [
  "article",
  "author_id",
  "created_at",
  "entities",
  "note_tweet",
  "referenced_tweets",
  "text",
].join(",");
const EXPANSIONS = [
  "article.cover_media",
  "article.media_entities",
  "author_id",
  "referenced_tweets.id",
  "referenced_tweets.id.author_id",
].join(",");

export class XApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAt: Date | null,
    readonly reconnectRequired: boolean,
  ) {
    super(message);
    this.name = "XApiRequestError";
  }
}

async function fetchX(url: URL, accessToken: string): Promise<Response> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (response.ok) return response;

  const retryAtHeader = response.headers.get("x-rate-limit-reset");
  const retryAt = retryAtHeader ? new Date(Number(retryAtHeader) * 1000) : null;
  throw new XApiRequestError(
    `X API request failed with status ${String(response.status)}`,
    response.status,
    retryAt,
    response.status === 401 || response.status === 403,
  );
}

function addPostFields(url: URL): void {
  url.searchParams.set("tweet.fields", POST_FIELDS);
  url.searchParams.set("expansions", EXPANSIONS);
  url.searchParams.set("user.fields", "id,name,username");
  url.searchParams.set(
    "media.fields",
    "media_key,type,url,preview_image_url,alt_text",
  );
}

export async function getBookmarksPage(
  accessToken: string,
  xUserId: string,
  paginationToken?: string,
): Promise<XPostsResponse> {
  const url = new URL(`${X_API_BASE}/users/${xUserId}/bookmarks`);
  url.searchParams.set("max_results", "100");
  if (paginationToken)
    url.searchParams.set("pagination_token", paginationToken);
  addPostFields(url);
  const response = await fetchX(url, accessToken);
  return response.json() as Promise<XPostsResponse>;
}

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
  paginationToken?: string,
): Promise<BookmarksFolderResponse> {
  const url = new URL(
    `${X_API_BASE}/users/${xUserId}/bookmarks/folders/${folderId}`,
  );
  url.searchParams.set("max_results", "100");
  if (paginationToken)
    url.searchParams.set("pagination_token", paginationToken);
  const response = await fetchX(url, accessToken);
  return response.json() as Promise<BookmarksFolderResponse>;
}

export async function getPostsByIds(
  accessToken: string,
  ids: string[],
): Promise<XPostsResponse> {
  if (ids.length === 0) return { data: [] };
  const url = new URL(`${X_API_BASE}/tweets`);
  url.searchParams.set("ids", ids.slice(0, 100).join(","));
  addPostFields(url);
  const response = await fetchX(url, accessToken);
  return response.json() as Promise<XPostsResponse>;
}
