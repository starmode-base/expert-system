/**
 * X API v2 helper for fetching tweets for a given username
 *
 * Notes:
 * - Uses app-only auth (Bearer token) via X API v2.
 * - Designed to be simple to call from scripts or background jobs.
 */

import { ensureEnv } from "~/lib/env";

interface XUser {
  id: string;
  username: string;
  name?: string;
}

interface XPost {
  id: string;
  text: string;
  created_at?: string;
  public_metrics?: {
    like_count?: number;
    reply_count?: number;
    repost_count?: number;
    quote_count?: number;
    bookmark_count?: number;
    impression_count?: number;
  };
}

interface XTimelineResponse {
  data?: XPost[];
  meta?: {
    newest_id?: string;
    oldest_id?: string;
    result_count?: number;
    next_token?: string;
  };
}

const X_API_BASE = "https://api.x.com/2";

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

async function xFetch(
  path: string,
  params?: Record<string, string>,
): Promise<Response> {
  const token = ensureEnv("X_BEARER_TOKEN");
  const url = new URL(`${X_API_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }

  return await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

async function lookupUserByUsername(
  username: string,
): Promise<XUser | undefined> {
  const normalized = username.trim();
  if (!normalized) return undefined;

  const res = await xFetch("/users/by", {
    usernames: normalized,
    "user.fields": "id,username,name",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`X user lookup failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { data?: XUser[] };
  return json.data?.[0];
}

export async function fetchTweetsByUsername(args: {
  username: string;
  maxResults?: number;
  sinceId?: string;
}): Promise<{ user: XUser; posts: XPost[]; meta?: XTimelineResponse["meta"] }> {
  const { username, sinceId, maxResults = 10 } = args;
  const user = await lookupUserByUsername(username);

  if (!user) {
    throw new Error(`User not found: @${username}`);
  }

  const params: Record<string, string> = {
    max_results: String(clamp(maxResults, 5, 100)),
    "tweet.fields": "id,text,created_at,public_metrics",
    // Keeping it to "original posts" is often what people want for feeds
    exclude: "replies,retweets",
  };
  if (sinceId) params.since_id = sinceId;

  const res = await xFetch(
    `/users/${encodeURIComponent(user.id)}/tweets`,
    params,
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `X timeline fetch failed (${res.status}) for username=@${username}: ${text}`,
    );
  }

  const timeline = (await res.json()) as XTimelineResponse;
  return { user, posts: timeline.data ?? [], meta: timeline.meta };
}
