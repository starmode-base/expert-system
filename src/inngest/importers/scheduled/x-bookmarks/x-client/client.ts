import type { XBookmarksResponse, XUserResponse } from "./types";

/**
 * X API client for authenticated requests
 */
export class XClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(
    endpoint: string,
    params?: Record<string, string>,
  ): Promise<T> {
    const url = new URL(`https://api.x.com${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`X API error: ${response.status} - ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get authenticated user's info
   */
  async getMe(): Promise<XUserResponse> {
    return this.request<XUserResponse>("/2/users/me");
  }

  /**
   * Get user's bookmarks with pagination support
   */
  async getBookmarks(
    userId: string,
    options?: {
      maxResults?: number;
      paginationToken?: string;
    },
  ): Promise<XBookmarksResponse> {
    const params: Record<string, string> = {
      "tweet.fields": "created_at,author_id,entities",
      expansions: "author_id",
      "user.fields": "username",
      max_results: String(options?.maxResults ?? 30),
    };

    if (options?.paginationToken) {
      params.pagination_token = options.paginationToken;
    }

    return this.request<XBookmarksResponse>(
      `/2/users/${userId}/bookmarks`,
      params,
    );
  }
}

/**
 * Create an authenticated X client from an access token
 */
export function createXClient(accessToken: string): XClient {
  return new XClient(accessToken);
}
