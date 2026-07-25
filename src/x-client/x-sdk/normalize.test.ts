import { describe, expect, it } from "vitest";
import { IncompleteXArticleError, normalizeXPost } from "./normalize";
import type { XPost, XPostsResponse } from "./types";

const response: XPostsResponse = {
  includes: {
    users: [{ id: "author-1", name: "Ada", username: "ada" }],
  },
};

function post(overrides: Partial<XPost> = {}): XPost {
  return {
    id: "123",
    text: "Short post",
    author_id: "author-1",
    created_at: "2026-07-20T12:00:00.000Z",
    ...overrides,
  };
}

describe("normalizeXPost", () => {
  it("prefers complete long-post text and keeps only X references", () => {
    const result = normalizeXPost(
      post({
        note_tweet: {
          text: "This is the complete long post.",
          entities: {
            urls: [
              {
                url: "https://t.co/x",
                expanded_url: "https://x.com/example/status/456",
              },
              {
                url: "https://t.co/web",
                expanded_url: "https://example.com/article",
              },
            ],
          },
        },
      }),
      response,
    );

    expect(result.externalId).toBe("x:123");
    expect(result.articleText).toContain("This is the complete long post.");
    expect(result.articleText).toContain("https://x.com/example/status/456");
    expect(result.articleText).not.toContain("example.com/article");
    expect(result.link).toBe("https://x.com/ada/status/123");
  });

  it("normalizes a complete X Article", () => {
    const result = normalizeXPost(
      post({
        article: {
          title: "A complete article",
          content: [
            { text: "First paragraph." },
            { content: [{ plain_text: "Second paragraph." }] },
          ],
        },
      }),
      response,
    );

    expect(result.title).toBe("A complete article");
    expect(result.articleText).toBe("First paragraph.\n\nSecond paragraph.");
  });

  it("rejects an incomplete X Article instead of falling back", () => {
    expect(() =>
      normalizeXPost(post({ article: { title: "Missing body" } }), response),
    ).toThrow(IncompleteXArticleError);
  });

  it("rejects invalid publication dates", () => {
    expect(() =>
      normalizeXPost(post({ created_at: "not-a-date" }), response),
    ).toThrow("invalid publication date");
  });
});
