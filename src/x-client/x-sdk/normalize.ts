import type { XApiUser, XPost, XPostsResponse } from "./types";

export class IncompleteXArticleError extends Error {
  constructor() {
    super("X Article content is incomplete");
    this.name = "IncompleteXArticleError";
  }
}

export interface NormalizedXDocument {
  externalId: string;
  link: string;
  title: string;
  articleText: string;
  publicationDate: Date;
}

function collectText(value: unknown, output: string[]): void {
  if (typeof value === "string") {
    const text = value.trim();
    if (text) output.push(text);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, output);
    return;
  }
  if (!value || typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  for (const key of ["text", "plain_text", "content", "body", "blocks"]) {
    if (key in record) collectText(record[key], output);
  }
}

function authorFor(
  post: XPost,
  response: XPostsResponse,
): XApiUser | undefined {
  return response.includes?.users?.find((user) => user.id === post.author_id);
}

function references(post: XPost): string[] {
  const urls = [
    ...(post.note_tweet?.entities?.urls ?? []),
    ...(post.entities?.urls ?? []),
  ];
  return Array.from(
    new Set(
      urls
        .map((url) => url.expanded_url ?? url.url)
        .filter((url) => url.startsWith("https://x.com/")),
    ),
  );
}

export function normalizeXPost(
  post: XPost,
  response: XPostsResponse,
): NormalizedXDocument {
  const author = authorFor(post, response);
  const username = author?.username ?? "i";
  const link = `https://x.com/${username}/status/${post.id}`;
  const publicationDate = post.created_at
    ? new Date(post.created_at)
    : new Date();

  if (Number.isNaN(publicationDate.getTime())) {
    throw new Error("X post has an invalid publication date");
  }

  let title: string;
  let body: string;
  if (post.article) {
    const articleParts: string[] = [];
    collectText(post.article.content, articleParts);
    collectText(post.article.body, articleParts);
    collectText(post.article.blocks, articleParts);
    collectText(post.article.plain_text, articleParts);
    collectText(post.article.text, articleParts);
    body = Array.from(new Set(articleParts)).join("\n\n").trim();
    title = post.article.title?.trim() ?? "";
    if (!title || !body) throw new IncompleteXArticleError();
  } else {
    body = post.note_tweet?.text?.trim() ?? post.text.trim();
    if (!body) throw new Error("X post has no readable text");
    const authorLabel = author
      ? `${author.name} (@${author.username})`
      : "X post";
    title = `${authorLabel}: ${body.slice(0, 100)}`;
  }

  const sourceReferences = references(post);
  const articleText =
    sourceReferences.length > 0
      ? `${body}\n\nX references:\n${sourceReferences.join("\n")}`
      : body;

  return {
    externalId: `x:${post.id}`,
    link,
    title,
    articleText,
    publicationDate,
  };
}
