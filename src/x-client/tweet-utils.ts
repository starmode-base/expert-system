/**
 * X Tweet Utility Functions
 *
 * Functions for classifying and analyzing tweets.
 */

import { invariant } from "@tanstack/react-router";
import type { XBookmarksResponse, XTweet, XUserExpansion } from "./bookmarks";

/**
 * Content type of a tweet
 */
export type TweetContentType = "article" | "tweet";

/**
 * Pattern to match X article URLs.
 * Articles are hosted at x.com/i/article/{id} or twitter.com/i/article/{id}
 */
const ARTICLE_URL_PATTERN =
  /^https?:\/\/(x\.com|twitter\.com)\/i\/article\/\d+$/;
const ARTICLE_URL_ID_PATTERN =
  /^https?:\/\/(?:x\.com|twitter\.com)\/i\/article\/(\d+)$/;

/**
 * Determines if a tweet is an X Article or a traditional tweet.
 *
 * X Articles are long-form content that appear as a special URL in the tweet.
 * They can be identified by:
 * 1. Having a URL entity that points to x.com/i/article/{id}
 *
 * @param tweet - The tweet to classify
 * @returns The content type: "article" or "tweet"
 */
export function getTweetContentType(tweet: XTweet): TweetContentType {
  if (isArticle(tweet)) {
    return "article";
  }
  return "tweet";
}

/**
 * Checks if a tweet is an X Article.
 *
 * @param tweet - The tweet to check
 * @returns true if the tweet is an article
 */
export function isArticle(tweet: XTweet): boolean {
  const urls = tweet.entities?.urls;
  if (!urls || urls.length === 0) {
    return false;
  }

  return urls.some((url) => {
    // Check expandedUrl first (most reliable)
    if (url.expandedUrl && ARTICLE_URL_PATTERN.test(url.expandedUrl)) {
      return true;
    }
    // Fall back to unwoundUrl if available
    if (url.unwoundUrl && ARTICLE_URL_PATTERN.test(url.unwoundUrl)) {
      return true;
    }
    return false;
  });
}

/**
 * Checks if a tweet is a traditional tweet (not an article).
 *
 * @param tweet - The tweet to check
 * @returns true if the tweet is a traditional tweet
 */
export function isTweet(tweet: XTweet): boolean {
  return !isArticle(tweet);
}

/**
 * Extracts the article ID from a tweet if it's an article.
 *
 * @param tweet - The tweet to extract from
 * @returns The article ID or null if not an article
 */
export function getArticleId(tweet: XTweet): string | null {
  const urls = tweet.entities?.urls;
  if (!urls || urls.length === 0) {
    return null;
  }

  for (const url of urls) {
    const urlToCheck = url.expandedUrl || url.unwoundUrl;
    if (urlToCheck) {
      const match = ARTICLE_URL_ID_PATTERN.exec(urlToCheck);
      if (match?.[1]) {
        return match[1];
      }
    }
  }

  return null;
}

// =============================================================================
// LABELED BOOKMARK TYPES
// =============================================================================

/**
 * A labeled tweet bookmark with extracted content
 */
export interface LabeledTweet {
  type: "tweet";
  /** URL to the tweet on X */
  tweetUrl: string;
  /** The tweet's text content */
  text: string;
  /** When the tweet was created (ISO 8601) */
  createdAt: string | null;
  /** External links found in the tweet */
  links: string[];
}

/**
 * A labeled article bookmark
 */
export interface LabeledArticle {
  type: "article";
  /** URL to the article on X */
  articleUrl: string;
  /** When the article was posted (ISO 8601) */
  createdAt: string | null;
}

/**
 * Union type for labeled bookmarks
 */
export type LabeledBookmark = LabeledTweet | LabeledArticle;

// =============================================================================
// LABELED BOOKMARK FUNCTIONS
// =============================================================================

/**
 * Pattern to identify media/photo URLs that should be filtered out
 */
const MEDIA_URL_PATTERN =
  /^https?:\/\/(?:x\.com|twitter\.com)\/\w+\/status\/\d+\/(?:photo|video)/;
const PIC_URL_PATTERN = /^https?:\/\/pic\.(?:x\.com|twitter\.com)\//;

/**
 * Processes bookmarks from getBookmarksByFolderWithDetails and returns
 * labeled results with extracted content.
 *
 * For tweets: Returns the tweet URL, text, created date, and external links.
 * For articles: Returns the article URL and created date.
 *
 * @param response - The response from getBookmarksByFolderWithDetails
 * @returns Array of labeled bookmarks
 */
export function labelBookmarks(
  response: XBookmarksResponse,
): LabeledBookmark[] {
  if (!response.data) {
    return [];
  }

  // Build a map of user IDs to usernames for constructing tweet URLs
  const userMap = new Map<string, XUserExpansion>();
  if (response.includes?.users) {
    for (const user of response.includes.users) {
      userMap.set(user.id, user);
    }
  }

  return response.data.map((tweet) => labelTweet(tweet, userMap));
}

/**
 * Labels a single tweet as either a tweet or article with extracted content.
 *
 * @param tweet - The tweet to label
 * @param userMap - Map of user IDs to user objects for username lookup
 * @returns Labeled bookmark
 */
export function labelTweet(
  tweet: XTweet,
  userMap?: Map<string, XUserExpansion>,
): LabeledBookmark {
  const createdAt = tweet.createdAt ?? null;

  if (isArticle(tweet)) {
    const articleId = getArticleId(tweet);
    invariant(articleId, "Article ID not found");
    return {
      type: "article",
      articleUrl: `https://x.com/i/article/${articleId}`,
      createdAt,
    };
  }

  // Build the tweet URL
  const username = userMap?.get(tweet.authorId ?? "")?.username;
  const tweetUrl = username
    ? `https://x.com/${username}/status/${tweet.id}`
    : `https://x.com/i/web/status/${tweet.id}`;

  // Extract external links (filter out media and internal X URLs)
  const links = extractExternalLinks(tweet);

  return {
    type: "tweet",
    tweetUrl,
    text: tweet.text,
    createdAt,
    links,
  };
}

/**
 * Extracts external links from a tweet, filtering out media and internal URLs.
 *
 * @param tweet - The tweet to extract links from
 * @returns Array of external URLs
 */
function extractExternalLinks(tweet: XTweet): string[] {
  const urls = tweet.entities?.urls;
  if (!urls || urls.length === 0) {
    return [];
  }

  const links: string[] = [];

  for (const urlEntity of urls) {
    // Use unwoundUrl (final destination) or expandedUrl
    const url = urlEntity.unwoundUrl ?? urlEntity.expandedUrl;
    if (!url) {
      continue;
    }

    // Filter out media URLs
    if (MEDIA_URL_PATTERN.test(url) || PIC_URL_PATTERN.test(url)) {
      continue;
    }

    // Filter out X article URLs (already handled separately)
    if (ARTICLE_URL_PATTERN.test(url)) {
      continue;
    }

    links.push(url);
  }

  return links;
}
