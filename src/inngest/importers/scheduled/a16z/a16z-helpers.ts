import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { AnyNode } from "domhandler";

export interface A16zCandidate {
  link: string;
  title: string;
  description: string;
  publicationDate: string;
}

function htmlToPlainText(html: string) {
  const $ = cheerio.load(html);
  const text = $.text();

  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeLink(href: string, baseUrl: string) {
  const trimmed = href.trim();
  if (!trimmed) {
    return "";
  }

  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return trimmed;
  }
}

function extractArchiveDescription(container: cheerio.Cheerio<AnyNode>) {

  const descriptionAnchor = container
    .find('a[href^="https://www.a16z.news/p/"]:not([data-testid])')
    .first();
  const html = descriptionAnchor.html() ?? descriptionAnchor.text();
  if (!html) {
    return "";
  }

  const plain = htmlToPlainText(html);
  if (!plain) {
    return "";
  }

  const maxLength = 400;
  if (plain.length <= maxLength) {
    return plain;
  }

  return `${plain.slice(0, maxLength).trim()}…`;
}

export function parseA16zArchiveList(
  listHtml: string,
  baseUrl = "https://www.a16z.news",
): A16zCandidate[] {
  const $ = cheerio.load(listHtml);
  const items: A16zCandidate[] = [];

  $('div[role="article"][aria-label^="Post preview"]').each(
    (_, containerEl) => {
      const container = $(containerEl);
      const anchor = container.find('a[data-testid="post-preview-title"]').first();
      const rawTitle = anchor.text().trim();
      const rawHref = anchor.attr("href")?.trim();
      if (!rawTitle || !rawHref) {
        return;
      }

      const link = normalizeLink(rawHref, baseUrl);
      if (!link) {
        return;
      }

      const rawDatetime = container.find("time[datetime]").attr("datetime");
      if (!rawDatetime) {
        return;
      }

      const publicationDate = new Date(rawDatetime);
      if (Number.isNaN(publicationDate.getTime())) {
        return;
      }

      const description = extractArchiveDescription(container) || rawTitle;

      items.push({
        link,
        title: rawTitle,
        description,
        publicationDate: publicationDate.toISOString(),
      });
    },
  );

  return items;
}

function stripNonArticleNodes(container: cheerio.Cheerio<AnyNode>) {
  container.find("script, style, noscript, svg").remove();
  container.find("form, input, textarea, select, button").remove();
  container.find("figure, picture, img, video, audio, iframe").remove();
  container.find("hr").remove();
  container.find(
    ".subscription-widget-wrap, .subscribe-widget, .post-ufi, #discussion",
  ).remove();
}

export function parseA16zArticleHtml(html: string) {
  const $ = cheerio.load(html);
  const article = $(".available-content .body.markup").first();
  if (article.length === 0) {
    return "";
  }

  const author = $(".post-header")
    .find(".meta-EgzBVA a")
    .first()
    .text()
    .trim();

  const fallbackAuthor =
    author ||
    $(".post-header").find('a[href*="substack.com/@"]').first().text().trim();

  stripNonArticleNodes(article);
  const bodyText = htmlToPlainText(article.html() ?? article.text());
  if (!bodyText) {
    return "";
  }

  const resolvedAuthor = fallbackAuthor;
  if (!resolvedAuthor) {
    return bodyText;
  }

  return `Author: ${resolvedAuthor}\n\n${bodyText}`;
}

export async function fetchA16zArticleText(url: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  const html = await res.text();
  return parseA16zArticleHtml(html);
}

export const a16zTakeawayPrompt = `
Focus on new and/or innovative ideas, frameworks, and trends in technology and business.
- When present, include any quantified metrics or timelines
`.trim();
