import { promises as fs } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, schema } from "~/postgres/db";
import {
  getBookmarksByFolder,
  type BookmarksFolderResponse,
  isTokenExpired,
  refreshAccessToken,
  calculateExpiresAt,
} from "../src/x-client/x-sdk/";
import { getArticle, getTweetsByIds } from "../src/x-client/twitter-api/client";
import type { Tweet } from "../src/x-client/twitter-api/types";

// =============================================================================
// OUTPUT TYPES
// =============================================================================

interface BookmarkSummary {
  type: "tweet" | "article";
  tweetId: string;
  title: string | null;
  text: string;
  createdAt: string;
  url: string;
  author: {
    name: string;
    username: string;
    bio: string;
  };
}

const ARTICLE_URL_PATTERN =
  /^https?:\/\/(x\.com|twitter\.com)\/i\/article\/\d+$/;

function isArticleTweet(tweet: Tweet): boolean {
  const urls = tweet.entities.urls;
  if (urls.length === 0) {
    return false;
  }
  return urls.some((url) => ARTICLE_URL_PATTERN.test(url.expanded_url));
}

// =============================================================================
// CACHE
// =============================================================================

interface CachedBookmarks {
  cachedAt: string;
  response: BookmarksFolderResponse;
}

const cachePath =
  process.env.X_BOOKMARKS_CACHE_PATH ??
  path.join(process.cwd(), ".cache", "x-folder-bookmarks.json");

async function loadCache(): Promise<CachedBookmarks | null> {
  try {
    const raw = await fs.readFile(cachePath, "utf8");
    return JSON.parse(raw) as CachedBookmarks;
  } catch {
    return null;
  }
}

async function saveCache(response: BookmarksFolderResponse) {
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  const payload: CachedBookmarks = {
    cachedAt: new Date().toISOString(),
    response,
  };
  await fs.writeFile(cachePath, JSON.stringify(payload, null, 2), "utf8");
}

// =============================================================================
// AUTH
// =============================================================================

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
  const auth = rows[0];

  if (!auth) {
    throw new Error("No X bookmarks auth record found");
  }

  return auth;
}

async function getValidAccessToken(
  auth: Awaited<ReturnType<typeof loadAuthRecord>>,
): Promise<string> {
  if (!isTokenExpired(auth.expiresAt)) {
    return auth.accessToken;
  }

  console.log("Access token expired, refreshing...");
  const tokens = await refreshAccessToken(auth.refreshToken);

  await db
    .update(schema.xBookmarksAuth)
    .set({
      accessToken: tokens.access_token,
      expiresAt: calculateExpiresAt(tokens.expires_in),
      ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
    })
    .where(eq(schema.xBookmarksAuth.id, auth.id));

  console.log("Token refreshed successfully");
  return tokens.access_token;
}

// =============================================================================
// MAIN
// =============================================================================

const auth = await loadAuthRecord();

const accessToken = await getValidAccessToken(auth);
const userId = auth.xUserId;
const folderId = auth.selectedFolderId;

if (!folderId) {
  throw new Error(
    "Missing X_BOOKMARKS_FOLDER_ID and no selectedFolderId in DB",
  );
}

// Fetch bookmarks (cached) - only returns basic tweet data (id, text)
let bookmarksResponse: BookmarksFolderResponse;
const cached = await loadCache();

if (cached) {
  console.log(`Using cached bookmarks from ${cached.cachedAt}`);
  bookmarksResponse = cached.response;
} else {
  console.log("Fetching bookmarks from X API...");
  bookmarksResponse = await getBookmarksByFolder(accessToken, userId, folderId);
  await saveCache(bookmarksResponse);
  console.log("Bookmarks cached");
}

// Extract tweet IDs from bookmarks
const tweetIds = bookmarksResponse.data?.map((tweet) => tweet.id) ?? [];

if (tweetIds.length === 0) {
  console.log("No bookmarks found");
  process.exit(0);
}

// Fetch full tweet data from twitterapi.io
console.log(`Fetching ${tweetIds.length} tweets from twitterapi.io...`);
const tweetsResponse = await getTweetsByIds(tweetIds);

if (tweetsResponse.status !== "success" || tweetsResponse.tweets.length === 0) {
  console.log("Failed to fetch tweets:", tweetsResponse.message);
  process.exit(1);
}

// Separate tweets and articles
const articleTweets = tweetsResponse.tweets.filter(isArticleTweet);
const regularTweets = tweetsResponse.tweets.filter((t) => !isArticleTweet(t));

console.log(
  `Found ${regularTweets.length} tweets and ${articleTweets.length} articles`,
);

const bookmarks: BookmarkSummary[] = [];

// Process regular tweets
for (const tweet of regularTweets) {
  bookmarks.push({
    type: "tweet",
    tweetId: tweet.id,
    title: null,
    text: tweet.text,
    createdAt: tweet.createdAt,
    url: tweet.url,
    author: {
      name: tweet.author.name,
      username: tweet.author.userName,
      bio: tweet.author.description,
    },
  });
}

// Fetch and process articles
if (articleTweets.length > 0) {
  console.log(`Fetching ${articleTweets.length} article details...`);
}

for (const tweet of articleTweets) {
  try {
    const response = await getArticle(tweet.id);

    if (response.status !== "success") {
      console.warn(`Failed to fetch article ${tweet.id}: ${response.message}`);
      continue;
    }

    const { article } = response;
    const text = article.contents.map((c) => c.text).join("\n\n");

    bookmarks.push({
      type: "article",
      tweetId: article.id,
      title: article.title,
      text,
      createdAt: article.createdAt,
      url: `https://x.com/i/article/${article.id}`,
      author: {
        name: article.author.name,
        username: article.author.userName,
        bio: article.author.description,
      },
    });
  } catch (error) {
    console.warn(`Error fetching article ${tweet.id}:`, error);
  }
}

console.log("\n" + JSON.stringify(bookmarks, null, 2));
