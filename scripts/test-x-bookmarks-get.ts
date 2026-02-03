import { promises as fs } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, schema } from "~/postgres/db";
import { getBookmarks } from "~/x-client/bookmarks";

interface CachedBookmarks {
  cachedAt: string;
  response: Awaited<ReturnType<typeof getBookmarks>>;
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
  path.join(process.cwd(), ".cache", "x-bookmarks-get.json");
const forceRefresh = process.env.X_BOOKMARKS_FORCE_REFRESH === "1";

const auth = await loadAuthRecord();
if (!auth) {
  throw new Error("No X bookmarks auth record found");
}
const accessToken = auth.accessToken;
const userId = auth.xUserId;

async function loadCache(): Promise<CachedBookmarks | null> {
  try {
    const raw = await fs.readFile(cachePath, "utf8");
    return JSON.parse(raw) as CachedBookmarks;
  } catch {
    return null;
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

function logSummary(source: string, cached: CachedBookmarks["response"]) {
  const count = cached.data?.length ?? 0;
  const nextToken = cached.meta?.nextToken ?? "none";
  console.log(`${source} (${count} bookmarks, next: ${nextToken})`);
  // Log the top-level keys of the cached object
  console.log("Data:", cached.data?.[0]);
  console.log("Keys:", Object.keys(cached.data?.[0] ?? {}));
}

const cached = forceRefresh ? null : await loadCache();

if (cached) {
  logSummary("Using cached bookmarks", cached.response);
  console.log(`Cache file: ${cachePath}`);
  process.exit(0);
} else {
  const response = await getBookmarks(accessToken, userId, {
    maxResults: 30,
  });
  await saveCache(response);
  logSummary("Fetched bookmarks", response);
  console.log(`Cache file: ${cachePath}`);
  process.exit(0);
}
