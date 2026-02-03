/**
 * X Bookmarks API Functions
 *
 * This module provides functions for fetching bookmarks from X (Twitter).
 * It supports both fetching all bookmarks and fetching from a specific folder.
 *
 * API Endpoints:
 * - GET /2/users/:id/bookmarks - All bookmarks
 * - GET /2/users/:id/bookmarks/folders/:folder_id - Folder bookmarks
 *
 * Authentication: OAuth 2.0 User Context (requires bookmark.read scope)
 *
 * Note: Types are defined separately at the top for easy migration to types.ts
 */

import { createXClient } from "./client";

/**
 * Base URL for X API v2
 */
const X_API_BASE = "https://api.x.com/2";

// =============================================================================
// TYPES - Can be moved to types.ts later
// =============================================================================

/**
 * Image preview for a URL entity
 */
export interface XTweetEntityUrlImage {
  /** Image URL */
  url: string;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
}

/**
 * Tweet entity URLs - links found in tweet text
 */
export interface XTweetEntityUrl {
  /** The URL as it appears in the tweet text */
  url: string;
  /** The fully expanded/resolved URL */
  expandedUrl: string;
  /** Display version of the URL (truncated) */
  displayUrl: string;
  /** Start index in tweet text */
  start: number;
  /** End index in tweet text */
  end: number;
  /** Unwound URL info (after following redirects) */
  unwoundUrl?: string;
  /** Title of the linked page */
  title?: string;
  /** Description of the linked page */
  description?: string;
  /** HTTP status code when fetching the URL */
  status?: number;
  /** Preview images for the URL */
  images?: XTweetEntityUrlImage[];
  /** Media key for attached media (photos, videos) */
  mediaKey?: string;
}

/**
 * Tweet entities - parsed elements from tweet text
 */
export interface XTweetEntities {
  urls?: XTweetEntityUrl[];
  hashtags?: { tag: string; start: number; end: number }[];
  mentions?: { username: string; id: string; start: number; end: number }[];
  cashtags?: { tag: string; start: number; end: number }[];
  annotations?: {
    start: number;
    end: number;
    probability: number;
    type: string;
    normalizedText: string;
  }[];
}

/**
 * Tweet public metrics
 */
export interface XTweetPublicMetrics {
  retweetCount: number;
  replyCount: number;
  likeCount: number;
  quoteCount: number;
  bookmarkCount: number;
  impressionCount?: number;
}

/**
 * X Tweet object from the API
 *
 * This uses camelCase to match XDK's normalized response format.
 */
export interface XTweet {
  /** Tweet ID (numeric string) */
  id: string;
  /** Tweet text content */
  text: string;
  /** Author's user ID */
  authorId?: string;
  /** When the tweet was created (ISO 8601) */
  createdAt?: string;
  /** ID of the conversation this tweet belongs to */
  conversationId?: string;
  /** User ID this tweet is replying to */
  inReplyToUserId?: string;
  /** Parsed entities (URLs, hashtags, mentions, etc.) */
  entities?: XTweetEntities;
  /** Public engagement metrics */
  publicMetrics?: XTweetPublicMetrics;
  /** Language code (BCP47) */
  lang?: string;
  /** Whether the tweet may contain sensitive content */
  possiblySensitive?: boolean;
  /** Source application */
  source?: string;
  /** For long tweets (notes), the full content */
  noteTweet?: {
    text: string;
    entities?: XTweetEntities;
  };
  /** Referenced tweets (quoted, replied to, retweeted) */
  referencedTweets?: {
    type: "retweeted" | "quoted" | "replied_to";
    id: string;
  }[];
  /** Edit history tweet IDs */
  editHistoryTweetIds?: string[];
}

/**
 * X User object (from expansions)
 */
export interface XUserExpansion {
  id: string;
  name: string;
  username: string;
  profileImageUrl?: string;
  description?: string;
  verified?: boolean;
  createdAt?: string;
  publicMetrics?: {
    followersCount: number;
    followingCount: number;
    tweetCount: number;
    listedCount: number;
  };
}

/**
 * Pagination metadata from X API responses
 */
export interface XPaginationMeta {
  /** Token to fetch next page */
  nextToken?: string;
  /** Token to fetch previous page */
  previousToken?: string;
  /** Number of results in this response */
  resultCount: number;
}

/**
 * Response from bookmarks endpoints
 */
export interface XBookmarksResponse {
  /** Array of bookmarked tweets */
  data?: XTweet[];
  /** Expanded objects (users, referenced tweets, etc.) */
  includes?: {
    users?: XUserExpansion[];
    tweets?: XTweet[];
  };
  /** Pagination info */
  meta?: XPaginationMeta;
  /** Any errors that occurred */
  errors?: { detail: string; title: string; type: string }[];
}

/**
 * Options for fetching bookmarks
 */
export interface GetBookmarksOptions {
  /** Max results per page (1-100, default varies by endpoint) */
  maxResults?: number;
  /** Pagination token for next page */
  paginationToken?: string;
  /** Tweet fields to include */
  tweetFields?: string[];
  /** Expansions to include (e.g., author_id for user info) */
  expansions?: string[];
  /** User fields to include when expanding users */
  userFields?: string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default tweet fields to request for bookmark sync.
 * These fields provide the essential data for document creation.
 */
const DEFAULT_TWEET_FIELDS = [
  "id",
  "text",
  "author_id",
  "created_at",
  "entities",
  "public_metrics",
  "conversation_id",
  "in_reply_to_user_id",
  "lang",
  "possibly_sensitive",
  "referenced_tweets",
  "note_tweet",
];

/**
 * Default expansions - include author info
 */
const DEFAULT_EXPANSIONS = ["author_id"];

/**
 * Default user fields when expanding author
 */
const DEFAULT_USER_FIELDS = ["id", "name", "username", "profile_image_url"];

// =============================================================================
// FUNCTIONS
// =============================================================================

/**
 * Get bookmarked tweets from a specific folder.
 *
 * Uses: GET /2/users/:id/bookmarks/folders/:folder_id
 *
 * IMPORTANT: The X API v2 folder endpoint does NOT support query parameters
 * like tweet.fields, expansions, user.fields, max_results, or pagination_token.
 * It only returns basic tweet data (id, text). To get full tweet details
 * (author, metrics, entities, etc.), use getTweetsByIds() with the returned IDs.
 *
 * @param accessToken - OAuth2 access token with bookmark.read scope
 * @param xUserId - The authenticated user's X ID
 * @param folderId - The bookmark folder ID to fetch from
 * @param _options - Currently unused (API doesn't support options)
 * @returns Bookmarks response with basic tweet data (id, text only)
 */
export async function getBookmarksByFolder(
  accessToken: string,
  xUserId: string,
  folderId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _options: GetBookmarksOptions = {},
): Promise<XBookmarksResponse> {
  // Note: The X API v2 endpoint /bookmarks/folders/{folder_id} does NOT support
  // query parameters like tweet.fields, expansions, user.fields, max_results.
  // It only returns basic tweet data (id, text). For full tweet data, you must
  // use getTweetsByIds() with the IDs returned from this endpoint.

  // Build the URL (no query params - they're not supported)
  const url = `${X_API_BASE}/users/${xUserId}/bookmarks/folders/${folderId}`;

  // Make the request
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to get bookmarks from folder: ${response.status} ${errorText}`,
    );
  }

  const data = (await response.json()) as RawApiResponse;

  // Map raw API response (snake_case) to our typed response (camelCase)
  return mapRawApiResponse(data);
}

/**
 * Get all bookmarked tweets (not from a specific folder).
 *
 * Uses: GET /2/users/:id/bookmarks
 *
 * @param accessToken - OAuth2 access token with bookmark.read scope
 * @param xUserId - The authenticated user's X ID
 * @param options - Optional parameters for pagination and fields
 * @returns Bookmarks response with tweets and pagination info
 */
export async function getBookmarks(
  accessToken: string,
  xUserId: string,
  options: GetBookmarksOptions = {},
): Promise<XBookmarksResponse> {
  const client = createXClient(accessToken);

  const response = await client.users.getBookmarks(xUserId, {
    maxResults: options.maxResults ?? 100,
    paginationToken: options.paginationToken,
    tweetFields: options.tweetFields ?? DEFAULT_TWEET_FIELDS,
    expansions: options.expansions ?? DEFAULT_EXPANSIONS,
    userFields: options.userFields ?? DEFAULT_USER_FIELDS,
  });

  // Map XDK response to our typed response
  // Cast through unknown to bridge XDK types to our mapper
  return mapXdkResponse(response as unknown as XdkResponse);
}

/**
 * Get tweets by their IDs.
 *
 * Uses: GET /2/tweets (via XDK posts.getByIds)
 *
 * @param accessToken - OAuth2 access token
 * @param tweetIds - Array of tweet IDs to fetch
 * @param options - Optional parameters for fields
 * @returns Array of tweets
 */
export async function getTweetsByIds(
  accessToken: string,
  tweetIds: string[],
  options: Pick<
    GetBookmarksOptions,
    "tweetFields" | "expansions" | "userFields"
  > = {},
): Promise<XBookmarksResponse> {
  const client = createXClient(accessToken);

  const response = await client.posts.getByIds(tweetIds, {
    tweetFields: options.tweetFields ?? DEFAULT_TWEET_FIELDS,
    expansions: options.expansions ?? DEFAULT_EXPANSIONS,
    userFields: options.userFields ?? DEFAULT_USER_FIELDS,
  });

  // Map XDK response to our typed response
  // Cast through unknown to bridge XDK types to our mapper
  return mapXdkResponse(response as unknown as XdkResponse);
}

/**
 * Get bookmarked tweets from a specific folder WITH full tweet details.
 *
 * This is a convenience function that combines two API calls:
 * 1. getBookmarksByFolder() - gets tweet IDs from the folder
 * 2. getTweetsByIds() - fetches full tweet data for those IDs
 *
 * Use this when you need full tweet data (author, metrics, entities, etc.)
 * from a specific bookmark folder.
 *
 * @param accessToken - OAuth2 access token with bookmark.read and tweet.read scopes
 * @param xUserId - The authenticated user's X ID
 * @param folderId - The bookmark folder ID to fetch from
 * @param options - Optional parameters for tweet fields and expansions
 * @returns Bookmarks response with full tweet data
 */
export async function getBookmarksByFolderWithDetails(
  accessToken: string,
  xUserId: string,
  folderId: string,
  options: Pick<
    GetBookmarksOptions,
    "tweetFields" | "expansions" | "userFields"
  > = {},
): Promise<XBookmarksResponse> {
  // Step 1: Get tweet IDs from the folder
  const folderResponse = await getBookmarksByFolder(
    accessToken,
    xUserId,
    folderId,
  );

  // If no bookmarks in folder, return empty response
  if (!folderResponse.data || folderResponse.data.length === 0) {
    return folderResponse;
  }

  // Step 2: Extract tweet IDs and fetch full details
  const tweetIds = folderResponse.data.map((tweet) => tweet.id);
  return getTweetsByIds(accessToken, tweetIds, options);
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Type for raw X API responses (snake_case field names).
 * This is what the API returns before any SDK transformation.
 */
interface RawApiResponse {
  data?: RawApiTweet[];
  includes?: {
    users?: RawApiUser[];
    tweets?: RawApiTweet[];
  };
  meta?: {
    next_token?: string;
    previous_token?: string;
    result_count?: number;
  };
  errors?: { detail?: string; title?: string; type?: string }[];
}

/**
 * Raw tweet from X API (snake_case field names)
 */
interface RawApiTweet {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  conversation_id?: string;
  in_reply_to_user_id?: string;
  entities?: RawApiEntities;
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    bookmark_count: number;
    impression_count?: number;
  };
  lang?: string;
  possibly_sensitive?: boolean;
  source?: string;
  note_tweet?: {
    text: string;
    entities?: RawApiEntities;
  };
  referenced_tweets?: {
    type: "retweeted" | "quoted" | "replied_to";
    id: string;
  }[];
  edit_history_tweet_ids?: string[];
}

/**
 * Raw entities from X API (snake_case field names)
 */
interface RawApiEntities {
  urls?: {
    url: string;
    expanded_url: string;
    display_url: string;
    start: number;
    end: number;
    unwound_url?: string;
    title?: string;
    description?: string;
    status?: number;
    images?: { url: string; width: number; height: number }[];
    media_key?: string;
  }[];
  hashtags?: { tag: string; start: number; end: number }[];
  mentions?: { username: string; id: string; start: number; end: number }[];
  cashtags?: { tag: string; start: number; end: number }[];
  annotations?: {
    start: number;
    end: number;
    probability: number;
    type: string;
    normalized_text: string;
  }[];
}

/**
 * Raw user from X API (snake_case field names)
 */
interface RawApiUser {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
  description?: string;
  verified?: boolean;
  created_at?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
}

/**
 * Map raw X API response (snake_case) to our typed response (camelCase).
 *
 * The X API returns snake_case field names. This function converts them
 * to camelCase to match our TypeScript interfaces.
 */
function mapRawApiResponse(response: RawApiResponse): XBookmarksResponse {
  return {
    data: response.data?.map(mapRawTweet),
    includes: response.includes
      ? {
          users: response.includes.users?.map(mapRawUser),
          tweets: response.includes.tweets?.map(mapRawTweet),
        }
      : undefined,
    meta: response.meta
      ? {
          nextToken: response.meta.next_token,
          previousToken: response.meta.previous_token,
          resultCount: response.meta.result_count ?? 0,
        }
      : undefined,
    errors: response.errors?.map((e) => ({
      detail: e.detail ?? "",
      title: e.title ?? "",
      type: e.type ?? "",
    })),
  };
}

/**
 * Map a raw API tweet (snake_case) to our typed XTweet (camelCase)
 */
function mapRawTweet(raw: RawApiTweet): XTweet {
  return {
    id: raw.id,
    text: raw.text,
    authorId: raw.author_id,
    createdAt: raw.created_at,
    conversationId: raw.conversation_id,
    inReplyToUserId: raw.in_reply_to_user_id,
    entities: raw.entities ? mapRawEntities(raw.entities) : undefined,
    publicMetrics: raw.public_metrics
      ? {
          retweetCount: raw.public_metrics.retweet_count,
          replyCount: raw.public_metrics.reply_count,
          likeCount: raw.public_metrics.like_count,
          quoteCount: raw.public_metrics.quote_count,
          bookmarkCount: raw.public_metrics.bookmark_count,
          impressionCount: raw.public_metrics.impression_count,
        }
      : undefined,
    lang: raw.lang,
    possiblySensitive: raw.possibly_sensitive,
    source: raw.source,
    noteTweet: raw.note_tweet
      ? {
          text: raw.note_tweet.text,
          entities: raw.note_tweet.entities
            ? mapRawEntities(raw.note_tweet.entities)
            : undefined,
        }
      : undefined,
    referencedTweets: raw.referenced_tweets,
    editHistoryTweetIds: raw.edit_history_tweet_ids,
  };
}

/**
 * Map raw API entities (snake_case) to our typed XTweetEntities (camelCase)
 */
function mapRawEntities(raw: RawApiEntities): XTweetEntities {
  return {
    urls: raw.urls?.map((u) => ({
      url: u.url,
      expandedUrl: u.expanded_url,
      displayUrl: u.display_url,
      start: u.start,
      end: u.end,
      unwoundUrl: u.unwound_url,
      title: u.title,
      description: u.description,
      status: u.status,
      images: u.images,
      mediaKey: u.media_key,
    })),
    hashtags: raw.hashtags,
    mentions: raw.mentions,
    cashtags: raw.cashtags,
    annotations: raw.annotations?.map((a) => ({
      start: a.start,
      end: a.end,
      probability: a.probability,
      type: a.type,
      normalizedText: a.normalized_text,
    })),
  };
}

/**
 * Map a raw API user (snake_case) to our typed XUserExpansion (camelCase)
 */
function mapRawUser(raw: RawApiUser): XUserExpansion {
  return {
    id: raw.id,
    name: raw.name,
    username: raw.username,
    profileImageUrl: raw.profile_image_url,
    description: raw.description,
    verified: raw.verified,
    createdAt: raw.created_at,
    publicMetrics: raw.public_metrics
      ? {
          followersCount: raw.public_metrics.followers_count,
          followingCount: raw.public_metrics.following_count,
          tweetCount: raw.public_metrics.tweet_count,
          listedCount: raw.public_metrics.listed_count,
        }
      : undefined,
  };
}

/**
 * Type for XDK responses that we map to our types.
 * Uses Record<string, unknown> to allow any XDK response shape.
 */
interface XdkResponse {
  data?: Record<string, unknown>[];
  includes?: {
    users?: Record<string, unknown>[];
    tweets?: Record<string, unknown>[];
  };
  meta?: Record<string, unknown>;
  errors?: { detail?: unknown; title?: unknown; type?: unknown }[];
}

/**
 * Map XDK response to our typed response.
 *
 * The XDK returns typed objects but we want a consistent interface
 * that we control. This maps the XDK response to our types.
 */
function mapXdkResponse(response: XdkResponse): XBookmarksResponse {
  return {
    data: response.data?.map(mapTweet),
    includes: response.includes
      ? {
          users: response.includes.users?.map(mapUser),
          tweets: response.includes.tweets?.map(mapTweet),
        }
      : undefined,
    meta: response.meta
      ? {
          nextToken: response.meta.next_token as string | undefined,
          previousToken: response.meta.previous_token as string | undefined,
          resultCount:
            typeof response.meta.result_count === "number"
              ? response.meta.result_count
              : 0,
        }
      : undefined,
    errors: response.errors?.map((e) => ({
      detail: typeof e.detail === "string" ? e.detail : "",
      title: typeof e.title === "string" ? e.title : "",
      type: typeof e.type === "string" ? e.type : "",
    })),
  };
}

/**
 * Map a raw tweet object to our typed XTweet
 */
function mapTweet(raw: Record<string, unknown>): XTweet {
  return {
    id: typeof raw.id === "string" ? raw.id : "",
    text: typeof raw.text === "string" ? raw.text : "",
    authorId: raw.authorId as string | undefined,
    createdAt: raw.createdAt as string | undefined,
    conversationId: raw.conversationId as string | undefined,
    inReplyToUserId: raw.inReplyToUserId as string | undefined,
    entities: raw.entities as XTweetEntities | undefined,
    publicMetrics: raw.publicMetrics as XTweetPublicMetrics | undefined,
    lang: raw.lang as string | undefined,
    possiblySensitive: raw.possiblySensitive as boolean | undefined,
    source: raw.source as string | undefined,
    noteTweet: raw.noteTweet as XTweet["noteTweet"],
    referencedTweets: raw.referencedTweets as XTweet["referencedTweets"],
    editHistoryTweetIds: raw.editHistoryTweetIds as string[] | undefined,
  };
}

/**
 * Map a raw user object to our typed XUserExpansion
 */
function mapUser(raw: Record<string, unknown>): XUserExpansion {
  return {
    id: typeof raw.id === "string" ? raw.id : "",
    name: typeof raw.name === "string" ? raw.name : "",
    username: typeof raw.username === "string" ? raw.username : "",
    profileImageUrl: raw.profileImageUrl as string | undefined,
    description: raw.description as string | undefined,
    verified: raw.verified as boolean | undefined,
    createdAt: raw.createdAt as string | undefined,
    publicMetrics: raw.publicMetrics as XUserExpansion["publicMetrics"],
  };
}
