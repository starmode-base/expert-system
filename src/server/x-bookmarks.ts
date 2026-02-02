/**
 * X Bookmarks Server Functions
 *
 * These server functions provide the backend for the X bookmarks settings UI.
 * They allow users to:
 * - Check if their X account is connected
 * - View connection status and token expiry
 * - Disconnect their X account
 *
 * The actual OAuth flow is handled by the API routes:
 * - /api/x-bookmarks-start: Initiates OAuth
 * - /api/x-bookmarks-callback: Handles OAuth callback
 */

import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { authMiddleware } from "~/middleware/auth-middleware";
import { db, schema } from "~/postgres/db";

/**
 * Status information about a user's X bookmarks connection.
 * Used by the settings UI to display connection state.
 */
export interface XBookmarksAuthStatus {
  /** Whether the user has connected their X account */
  isConnected: boolean;
  /** The user's X ID (for display purposes) */
  xUserId: string | null;
  /** When the current access token expires */
  expiresAt: Date | null;
  /** Pagination cursor from last sync (for incremental fetching) */
  lastSyncCursor: string | null;
}

/**
 * Get the X bookmarks authentication status for the current user.
 *
 * Called by the settings page to show:
 * - Whether X is connected
 * - The connected X user ID
 * - Token expiration time
 * - Last sync cursor (if any)
 */
export const getXBookmarksAuthStatusSF = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<XBookmarksAuthStatus> => {
    const viewer = context.ensureViewer();

    const auth = await db.query.xBookmarksAuth.findFirst({
      where: eq(schema.xBookmarksAuth.userId, viewer.id),
    });

    if (!auth) {
      return {
        isConnected: false,
        xUserId: null,
        expiresAt: null,
        lastSyncCursor: null,
      };
    }

    return {
      isConnected: true,
      xUserId: auth.xUserId,
      expiresAt: auth.expiresAt,
      lastSyncCursor: auth.lastSyncCursor,
    };
  });

/**
 * Disconnect the user's X account by removing their auth record.
 *
 * This revokes our stored tokens. The user would need to go through
 * the OAuth flow again to reconnect.
 *
 * Note: This doesn't revoke the token on X's side. The user can do
 * that manually in their X settings if desired.
 */
export const disconnectXBookmarksSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const viewer = context.ensureViewer();

    await db
      .delete(schema.xBookmarksAuth)
      .where(eq(schema.xBookmarksAuth.userId, viewer.id));

    return { success: true };
  });
