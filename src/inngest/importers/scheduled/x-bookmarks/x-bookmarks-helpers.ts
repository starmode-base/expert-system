import type { XBookmark, XBookmarksResponse } from "./x-client";

export interface XBookmarkCandidate {
  tweetId: string;
  link: string;
  title: string;
  text: string;
  publicationDate: string;
  urls: string[];
  authorUsername?: string;
}

/**
 * Build canonical tweet URL
 */
export function getTweetUrl(tweetId: string): string {
  return `https://x.com/i/web/status/${tweetId}`;
}

/**
 * Extract a title from tweet text (first ~100 chars, trimmed at word boundary)
 */
function extractTitle(text: string, maxLength = 100): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const truncated = cleaned.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.6) {
    return `${truncated.slice(0, lastSpace)}...`;
  }

  return `${truncated}...`;
}

/**
 * Extract expanded URLs from tweet entities
 */
function extractUrls(bookmark: XBookmark): string[] {
  return (
    bookmark.entities?.urls?.map((u) => u.expanded_url).filter(Boolean) ?? []
  );
}

/**
 * Map X bookmarks response to candidates
 */
export function mapBookmarksToCandidates(
  response: XBookmarksResponse,
): XBookmarkCandidate[] {
  if (!response.data) {
    return [];
  }

  // Build username lookup from includes
  const userMap = new Map<string, string>();
  if (response.includes?.users) {
    for (const user of response.includes.users) {
      userMap.set(user.id, user.username);
    }
  }

  return response.data.map((bookmark) => ({
    tweetId: bookmark.id,
    link: getTweetUrl(bookmark.id),
    title: extractTitle(bookmark.text),
    text: bookmark.text,
    publicationDate: bookmark.created_at ?? new Date().toISOString(),
    urls: extractUrls(bookmark),
    authorUsername: bookmark.author_id
      ? userMap.get(bookmark.author_id)
      : undefined,
  }));
}

/**
 * Map a bookmark candidate to a document insert value
 */
export function mapCandidateToDocument(
  candidate: XBookmarkCandidate,
  description: string,
  articleText?: string,
) {
  return {
    source: "X Bookmarks",
    title: candidate.title,
    description,
    publicationDate: new Date(candidate.publicationDate),
    link: candidate.link,
    articleText: articleText ?? candidate.text,
  };
}

/**
 * Custom takeaway prompt for X Bookmarks
 */
export const xBookmarksTakeawayPrompt = `
Focus on extracting actionable insights, unique perspectives, and notable claims from this bookmarked content.

Guidelines:
- Capture specific predictions, frameworks, or contrarian views
- Note any data points, statistics, or quantified claims
- Extract actionable advice or recommendations
- Identify emerging trends or patterns mentioned
`.trim();
