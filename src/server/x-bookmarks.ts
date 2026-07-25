/**
 * X Bookmarks Server Functions
 *
 * These server functions provide the backend for the X bookmarks settings UI.
 * They allow users to:
 * - Check if their X account is connected
 * - View connection status and token expiry
 * - Fetch and select bookmark folders
 * - Disconnect their X account
 *
 * The actual OAuth flow is handled by the API routes:
 * - /api/x-bookmarks-start: Initiates OAuth
 * - /api/x-bookmarks-callback: Handles OAuth callback
 */

import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { authMiddleware } from "~/middleware/auth-middleware";
import { db, schema } from "~/postgres/db";
import {
  getBookmarkFolders,
  isTokenExpired,
  refreshAccessToken,
  calculateExpiresAt,
} from "src/x-client/x-sdk/";
import { inngest } from "~/inngest/client";
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
  /** Selected folder ID for syncing (null = all bookmarks) */
  selectedFolderId: string | null;
  /** Selected folder name for display */
  selectedFolderName: string | null;
  latestSync: XBookmarkSyncInfo | null;
  failedItemCount: number;
}

export interface XBookmarkSyncInfo {
  id: string;
  status: "queued" | "running" | "completed" | "partial" | "failed";
  trigger: "initial" | "daily" | "manual";
  createdAt: Date;
  completedAt: Date | null;
  discoveredCount: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  error: string | null;
}

/**
 * Bookmark folder info returned to the UI
 */
export interface XBookmarkFolderInfo {
  id: string;
  name: string;
}

/**
 * Get the X bookmarks authentication status for the current user.
 *
 * Called by the settings page to show:
 * - Whether X is connected
 * - The connected X user ID
 * - Token expiration time
 * - Selected folder (if any)
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
        selectedFolderId: null,
        selectedFolderName: null,
        latestSync: null,
        failedItemCount: 0,
      };
    }

    const [latestSync, failedItemRows] = await Promise.all([
      db.query.xBookmarkSyncRuns.findFirst({
        where: eq(schema.xBookmarkSyncRuns.userId, viewer.id),
        orderBy: [desc(schema.xBookmarkSyncRuns.createdAt)],
      }),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.xBookmarkItems)
        .where(
          and(
            eq(schema.xBookmarkItems.userId, viewer.id),
            eq(schema.xBookmarkItems.status, "failed"),
          ),
        ),
    ]);

    return {
      isConnected: true,
      xUserId: auth.xUserId,
      expiresAt: auth.expiresAt,
      lastSyncCursor: auth.lastSyncCursor,
      selectedFolderId: auth.selectedFolderId,
      selectedFolderName: auth.selectedFolderName,
      latestSync: latestSync
        ? {
            id: latestSync.id,
            status: latestSync.status,
            trigger: latestSync.trigger,
            createdAt: latestSync.createdAt,
            completedAt: latestSync.completedAt,
            discoveredCount: latestSync.discoveredCount,
            importedCount: latestSync.importedCount,
            skippedCount: latestSync.skippedCount,
            failedCount: latestSync.failedCount,
            error: latestSync.error,
          }
        : null,
      failedItemCount: failedItemRows[0]?.count ?? 0,
    };
  });

export const syncXBookmarksNowSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const viewer = context.ensureViewer();
    const auth = await db.query.xBookmarksAuth.findFirst({
      where: eq(schema.xBookmarksAuth.userId, viewer.id),
    });
    if (!auth) throw new Error("X account not connected");

    const activeRun = await db.query.xBookmarkSyncRuns.findFirst({
      where: and(
        eq(schema.xBookmarkSyncRuns.userId, viewer.id),
        inArray(schema.xBookmarkSyncRuns.status, ["queued", "running"]),
      ),
      orderBy: [desc(schema.xBookmarkSyncRuns.createdAt)],
    });
    if (activeRun)
      return { accepted: false, reason: "already_running" as const };

    const priorSuccess = await db.query.xBookmarkSyncRuns.findFirst({
      where: and(
        eq(schema.xBookmarkSyncRuns.userId, viewer.id),
        inArray(schema.xBookmarkSyncRuns.status, ["completed", "partial"]),
      ),
    });
    const [queuedRun] = await db
      .insert(schema.xBookmarkSyncRuns)
      .values({
        userId: viewer.id,
        trigger: priorSuccess ? "manual" : "initial",
        status: "queued",
      })
      .returning({ id: schema.xBookmarkSyncRuns.id });
    if (!queuedRun) throw new Error("Unable to queue X bookmark sync");
    try {
      await inngest.send({
        name: "x/bookmarks.sync.requested",
        data: {
          userId: viewer.id,
          trigger: priorSuccess ? "manual" : "initial",
          runId: queuedRun.id,
        },
        user: { id: viewer.id, email: viewer.email },
      });
    } catch (error) {
      await db
        .update(schema.xBookmarkSyncRuns)
        .set({
          status: "failed",
          completedAt: new Date(),
          error: "Unable to queue bookmark sync",
        })
        .where(eq(schema.xBookmarkSyncRuns.id, queuedRun.id));
      throw error;
    }
    return { accepted: true, reason: null };
  });

/**
 * Fetch the user's bookmark folders from X.
 *
 * This requires a valid access token. If the token is expired,
 * it will be refreshed automatically.
 *
 * @returns Array of folder objects with id and name
 */
export const getXBookmarkFoldersSF = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<XBookmarkFolderInfo[]> => {
    const viewer = context.ensureViewer();

    const auth = await db.query.xBookmarksAuth.findFirst({
      where: eq(schema.xBookmarksAuth.userId, viewer.id),
    });

    if (!auth) {
      throw new Error("X account not connected");
    }

    // Refresh token if expired
    let accessToken = auth.accessToken;
    if (isTokenExpired(auth.expiresAt)) {
      const tokens = await refreshAccessToken(auth.refreshToken);
      accessToken = tokens.access_token;

      // Update stored tokens
      await db
        .update(schema.xBookmarksAuth)
        .set({
          accessToken: tokens.access_token,
          expiresAt: calculateExpiresAt(tokens.expires_in),
          // Update refresh token if rotated
          ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
        })
        .where(eq(schema.xBookmarksAuth.id, auth.id));
    }

    // Fetch folders from X API
    const folders = await getBookmarkFolders(accessToken, auth.xUserId);

    return folders;
  });

/**
 * Save the user's selected bookmark folder.
 *
 * The daily sync job will use this folder instead of fetching all bookmarks.
 * Pass null/empty to clear the selection and sync all bookmarks.
 */
export const setSelectedFolderSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      folderId: z.string().nullable(),
      folderName: z.string().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const viewer = context.ensureViewer();

    const auth = await db.query.xBookmarksAuth.findFirst({
      where: eq(schema.xBookmarksAuth.userId, viewer.id),
    });

    if (!auth) {
      throw new Error("X account not connected");
    }

    await db
      .update(schema.xBookmarksAuth)
      .set({
        selectedFolderId: data.folderId,
        selectedFolderName: data.folderName,
      })
      .where(eq(schema.xBookmarksAuth.id, auth.id));

    return { success: true };
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
