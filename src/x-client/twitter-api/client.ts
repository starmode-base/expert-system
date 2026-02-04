import { ensureEnv } from "~/lib/env";
import type { TweetsResponse, TwitterApiArticleResponse } from "./types";

const BASE_URL = "https://api.twitterapi.io";

/**
 * Fetch tweets by their IDs using the twitterapi.io service.
 *
 * @param tweetIds - Array of tweet IDs to fetch (max recommended: 100)
 * @returns Response containing the tweets array and status
 * @throws Error if the API request fails
 *
 * @see https://docs.twitterapi.io/api-reference/endpoint/get_tweet_by_ids
 */
export async function getTweetsByIds(
  tweetIds: string[],
): Promise<TweetsResponse> {
  if (tweetIds.length === 0) {
    return { tweets: [], status: "success", message: "No tweet IDs provided" };
  }

  const apiKey = ensureEnv("TWITTER_API_IO_KEY");

  const url = new URL(`${BASE_URL}/twitter/tweets`);
  url.searchParams.set("tweet_ids", tweetIds.join(","));

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-API-Key": apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch tweets: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<TweetsResponse>;
}

/**
 * Fetch an article by its tweet ID using the twitterapi.io service.
 *
 * Note: This endpoint costs 100 credits per article.
 *
 * @param tweetId - The tweet ID of the article
 * @returns Response containing the article data and status
 * @throws Error if the API request fails
 *
 * @see https://docs.twitterapi.io/api-reference/endpoint/get_article
 */
export async function getArticle(
  tweetId: string,
): Promise<TwitterApiArticleResponse> {
  const apiKey = ensureEnv("TWITTER_API_IO_KEY");

  const url = new URL(`${BASE_URL}/twitter/article`);
  url.searchParams.set("tweet_id", tweetId);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-API-Key": apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch article: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<TwitterApiArticleResponse>;
}
