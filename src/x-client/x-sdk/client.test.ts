import { afterEach, describe, expect, it, vi } from "vitest";
import { getBookmarksPage, XApiRequestError } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("official X bookmarks client", () => {
  it("requests rich official fields and pagination", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "123", text: "hello" }],
          meta: { next_token: "next" },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getBookmarksPage("access-token", "user-id", "cursor");

    expect(result.meta?.next_token).toBe("next");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    const rawUrl =
      requestUrl instanceof URL
        ? requestUrl.href
        : requestUrl instanceof Request
          ? requestUrl.url
          : requestUrl;
    const url = new URL(rawUrl ?? "");
    expect(url.pathname).toBe("/2/users/user-id/bookmarks");
    expect(url.searchParams.get("pagination_token")).toBe("cursor");
    expect(url.searchParams.get("tweet.fields")).toContain("article");
    expect(url.searchParams.get("tweet.fields")).toContain("note_tweet");
    expect(requestInit?.headers).toEqual({
      Authorization: "Bearer access-token",
    });
  });

  it("returns sanitized rate-limit metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response("sensitive upstream response", {
          status: 429,
          headers: { "x-rate-limit-reset": "2000000000" },
        }),
      ),
    );

    const error = await getBookmarksPage("secret-token", "user-id").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(XApiRequestError);
    if (!(error instanceof XApiRequestError)) return;
    expect(error.status).toBe(429);
    expect(error.retryAt?.toISOString()).toBe("2033-05-18T03:33:20.000Z");
    expect(error.message).not.toContain("sensitive");
    expect(error.message).not.toContain("secret-token");
  });
});
