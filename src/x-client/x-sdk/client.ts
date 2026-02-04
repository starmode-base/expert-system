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
import type { XUser, XUserMeResponse, XBookmarkFolder } from "./types";

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
