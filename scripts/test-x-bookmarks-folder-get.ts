import { promises as fs } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, schema } from "~/postgres/db";
import {
  getBookmarksByFolderWithDetails,
  XBookmarksResponse,
} from "~/x-client/bookmarks";
import {
  isTokenExpired,
  refreshAccessToken,
  calculateExpiresAt,
  labelBookmarks,
} from "~/x-client";

interface CachedBookmarks {
  cachedAt: string;
  response: Awaited<ReturnType<typeof getBookmarksByFolderWithDetails>>;
}

async function loadAuthRecord() {
  const viewerId = process.env.X_BOOKMARKS_AUTH_USER_ID;

  if (viewerId) {
    const auth = await db.query.xBookmarksAuth.findFirst({
      where: eq(schema.xBookmarksAuth.userId, viewerId),
    });

    if (!auth) {
      throw new Error(`No X bookmarks auth for user "${viewerId}"`);
    }

    return auth;
  }

  const rows = await db.select().from(schema.xBookmarksAuth).limit(2);

  if (rows.length === 0) {
    throw new Error("No X bookmarks auth records found");
  }

  if (rows.length > 1) {
    throw new Error(
      "Multiple X bookmarks auth records found. Set X_BOOKMARKS_AUTH_USER_ID",
    );
  }

  return rows[0];
}

const cachePath =
  process.env.X_BOOKMARKS_CACHE_PATH ??
  path.join(process.cwd(), ".cache", "x-bookmarks-folder-get.json");

const auth = await loadAuthRecord();
if (!auth) {
  throw new Error("No X bookmarks auth record found");
}

// Refresh token if expired
let accessToken = auth.accessToken;
if (isTokenExpired(auth.expiresAt)) {
  console.log("Access token expired, refreshing...");
  const tokens = await refreshAccessToken(auth.refreshToken);
  accessToken = tokens.access_token;

  // Update stored tokens in DB
  await db
    .update(schema.xBookmarksAuth)
    .set({
      accessToken: tokens.access_token,
      expiresAt: calculateExpiresAt(tokens.expires_in),
      ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
    })
    .where(eq(schema.xBookmarksAuth.id, auth.id));
  console.log("Token refreshed successfully");
}

const userId = auth.xUserId;
const folderId = auth.selectedFolderId;

if (!folderId) {
  throw new Error(
    "Missing X_BOOKMARKS_FOLDER_ID and no selectedFolderId in DB",
  );
}

async function loadCache(): Promise<CachedBookmarks | null> {
  try {
    const raw = await fs.readFile(cachePath, "utf8");
    return JSON.parse(raw) as CachedBookmarks;
  } catch {
    return null;
  }
}

async function cacheExists(): Promise<boolean> {
  try {
    await fs.access(cachePath);
    return true;
  } catch {
    return false;
  }
}

async function saveCache(response: CachedBookmarks["response"]) {
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  const payload: CachedBookmarks = {
    cachedAt: new Date().toISOString(),
    response,
  };
  await fs.writeFile(cachePath, JSON.stringify(payload, null, 2), "utf8");
}

function logSummary(source: string, cached: XBookmarksResponse) {
  const count = cached.data?.length ?? 0;
  const nextToken = cached.meta?.nextToken ?? "none";
  console.log(`${source} (${count} bookmarks, next: ${nextToken})`);
  const labeled = labelBookmarks(cached);
  console.log("Labeled bookmarks:", labeled);
}

const cached = (await cacheExists()) ? await loadCache() : null;

if (cached) {
  logSummary("Using cached bookmarks", cached.response);
  console.log(`Cache file: ${cachePath}`);
} else {
  const response = await getBookmarksByFolderWithDetails(
    accessToken,
    userId,
    folderId,
  );
  await saveCache(response);
  logSummary("Fetched bookmarks", response);

  console.log(`Cache file: ${cachePath}`);
  process.exit(0);
}
