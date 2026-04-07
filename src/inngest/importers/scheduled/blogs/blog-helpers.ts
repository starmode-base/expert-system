import * as cheerio from "cheerio";
import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";
import {
  coerceToArray,
  extractXmlText,
  htmlToPlainText,
  normalizeLink,
} from "../parse-helpers";

export {
  coerceToArray,
  extractXmlText,
  htmlToPlainText,
  normalizeLink,
} from "../parse-helpers";

export interface BlogArticleCandidate {
  link: string;
  title: string;
  description: string;
  publicationDate: string | null;
  articleText: string | null;
}

interface RssItem {
  title?: unknown;
  link?: unknown;
  guid?: unknown;
  description?: unknown;
  pubDate?: unknown;
  "content:encoded"?: unknown;
  "dc:date"?: unknown;
}

interface AtomEntry {
  title?: unknown[];
  link?: { $: { href: string; rel?: string } }[];
  published?: string[];
  updated?: string[];
  summary?: unknown[];
  content?: unknown[];
}

/**
 * Extract the longest content text and the first article link from a parsed feed.
 * Returns null if no usable content/link is found.
 */
function extractFirstItemContentAndLink(
  parsed: Record<string, unknown>,
): { feedText: string; link: string } | null {
  // RSS 2.0
  const rss = parsed as {
    rss?: { channel?: { item?: RssItem[] | RssItem }[] };
  };
  const rssChannel = rss.rss?.channel?.[0];
  if (rssChannel) {
    const items = coerceToArray(rssChannel.item);
    const firstItem = items[0];
    if (firstItem) {
      const encoded = extractXmlText(firstItem["content:encoded"]);
      const feedText = encoded ? htmlToPlainText(encoded) : "";
      const rawLink =
        extractXmlText(firstItem.guid) ?? extractXmlText(firstItem.link);
      const link = rawLink ? normalizeLink(rawLink) : "";
      if (feedText.length > 0 && link) {
        return { feedText, link };
      }
    }
    return null;
  }

  // Atom
  const atom = parsed as { feed?: { entry?: AtomEntry[] } };
  if (atom.feed?.entry?.[0]) {
    const entry = atom.feed.entry[0];
    const contentRaw = extractXmlText(entry.content?.[0]);
    const feedText = contentRaw ? htmlToPlainText(contentRaw) : "";
    const altLink = entry.link?.find(
      (l) => (l.$ as { rel?: string }).rel === "alternate",
    );
    const linkEl = altLink ?? entry.link?.[0];
    const rawLink = linkEl?.$.href;
    const link = rawLink ? normalizeLink(rawLink) : "";
    if (feedText.length > 0 && link) {
      return { feedText, link };
    }
  }

  return null;
}

/**
 * Extract plain text from an HTML page using cheerio (no LLM call).
 * Strips nav, footer, script, style, and other boilerplate tags.
 */
function extractPagePlainText(html: string): string {
  const $ = cheerio.load(html);
  $(
    "script, style, noscript, svg, nav, footer, header, aside, [role='navigation'], [role='banner'], [role='contentinfo']",
  ).remove();

  // Prefer <article> or <main> if present
  const article = $("article").first();
  const main = $("main").first();
  const target = article.length ? article : main.length ? main : $("body");

  return target
    .text()
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Detect whether a parsed feed includes full article content by comparing
 * the feed's inline content against the actual page content.
 *
 * Fetches the first article's URL and compares text lengths.
 * If the feed content is >= 50% of the page content, assumes full articles
 * are embedded in the feed.
 */
export async function detectContentInFeed(
  parsed: Record<string, unknown>,
): Promise<boolean> {
  const extracted = extractFirstItemContentAndLink(parsed);
  if (!extracted) {
    return false;
  }

  const { feedText, link } = extracted;

  // Fetch the actual page and compare
  try {
    const res = await fetch(link, {
      headers: { "User-Agent": "ExpertSystem/1.0 RSS Reader" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      // Can't verify — assume not full content
      return false;
    }
    const html = await res.text();
    const pageText = extractPagePlainText(html);

    if (pageText.length === 0) {
      // Can't extract page text — fall back to false
      return false;
    }

    return feedText.length >= pageText.length * 0.5;
  } catch {
    // Network/timeout error — default to false (will scrape pages)
    return false;
  }
}

/**
 * Unified RSS 2.0 / Atom / RDF parser.
 * When `contentInFeed` is true, extracts article text from content elements.
 * When false, sets `articleText = null`.
 */
export async function parseFeedItems(
  xml: string,
  contentInFeed: boolean,
): Promise<BlogArticleCandidate[]> {
  const parsed = (await parseStringPromise(xml, {
    trim: true,
    explicitArray: true,
  })) as Record<string, unknown>;

  const candidates: BlogArticleCandidate[] = [];

  // RSS 2.0
  const rss = parsed as {
    rss?: { channel?: { item?: RssItem[] | RssItem }[] };
  };
  if (rss.rss?.channel?.[0]) {
    const items = coerceToArray(rss.rss.channel[0].item);
    for (const item of items) {
      const candidate = parseRssItem(item, contentInFeed);
      if (candidate) {
        candidates.push(candidate);
      }
    }
    return candidates;
  }

  // Atom
  const atom = parsed as { feed?: { entry?: AtomEntry[] } };
  if (atom.feed?.entry) {
    for (const entry of atom.feed.entry) {
      const candidate = parseAtomEntry(entry, contentInFeed);
      if (candidate) {
        candidates.push(candidate);
      }
    }
    return candidates;
  }

  // RDF / RSS 1.0
  const rdf = parsed as { "rdf:RDF"?: { item?: RssItem[] } };
  if (rdf["rdf:RDF"]?.item) {
    for (const item of rdf["rdf:RDF"].item) {
      const candidate = parseRssItem(item, contentInFeed);
      if (candidate) {
        candidates.push(candidate);
      }
    }
  }

  return candidates;
}

function parseRssItem(
  item: RssItem,
  contentInFeed: boolean,
): BlogArticleCandidate | null {
  const rawGuid = extractXmlText(item.guid);
  const rawLink = extractXmlText(item.link);
  const rawTitle = extractXmlText(item.title);
  const rawDescription = extractXmlText(item.description);
  const rawPubDate =
    extractXmlText(item.pubDate) ?? extractXmlText(item["dc:date"]);

  const linkSource = (rawGuid ?? rawLink)?.trim();
  if (!linkSource || !rawTitle) {
    return null;
  }

  const link = normalizeLink(linkSource);
  if (!link) {
    return null;
  }

  let publicationDate: string | null = null;
  if (rawPubDate) {
    const parsed = new Date(rawPubDate);
    if (!Number.isNaN(parsed.getTime())) {
      publicationDate = parsed.toISOString();
    }
  }

  let articleText: string | null = null;
  if (contentInFeed) {
    const rawContent = extractXmlText(item["content:encoded"]);
    if (rawContent) {
      articleText = htmlToPlainText(rawContent);
    }
  }

  return {
    link,
    title: rawTitle.trim(),
    description: (rawDescription ?? rawTitle).trim(),
    publicationDate,
    articleText,
  };
}

function parseAtomEntry(
  entry: AtomEntry,
  contentInFeed: boolean,
): BlogArticleCandidate | null {
  const rawTitle = extractXmlText(entry.title?.[0]);
  const rawPubDate = entry.published?.[0] ?? entry.updated?.[0] ?? null;
  const rawSummary = extractXmlText(entry.summary?.[0]);

  if (!rawTitle) {
    return null;
  }

  const altLink = entry.link?.find(
    (l) => (l.$ as { rel?: string }).rel === "alternate",
  );
  const linkEl = altLink ?? entry.link?.[0];
  const rawLink = linkEl?.$.href;
  if (!rawLink) {
    return null;
  }

  const link = normalizeLink(rawLink);
  if (!link) {
    return null;
  }

  let publicationDate: string | null = null;
  if (rawPubDate) {
    const parsed = new Date(rawPubDate);
    if (!Number.isNaN(parsed.getTime())) {
      publicationDate = parsed.toISOString();
    }
  }

  let articleText: string | null = null;
  if (contentInFeed) {
    const rawContent = extractXmlText(entry.content?.[0]);
    if (rawContent) {
      articleText = htmlToPlainText(rawContent);
    }
  }

  return {
    link,
    title: rawTitle.trim(),
    description: (rawSummary ?? rawTitle).trim(),
    publicationDate,
    articleText,
  };
}

/**
 * Extract feed-level metadata (title, description) from parsed XML.
 */
export async function extractFeedMetadata(
  xml: string,
): Promise<{ title: string | null; description: string | null }> {
  const parsed = (await parseStringPromise(xml, {
    trim: true,
    explicitArray: true,
  })) as Record<string, unknown>;

  // RSS 2.0
  const rss = parsed as {
    rss?: { channel?: { title?: string[]; description?: string[] }[] };
  };
  if (rss.rss?.channel?.[0]) {
    const channel = rss.rss.channel[0];
    return {
      title: channel.title?.[0] ?? null,
      description: channel.description?.[0] ?? null,
    };
  }

  // Atom
  const atom = parsed as {
    feed?: {
      title?: (string | { _: string })[];
      subtitle?: (string | { _: string })[];
    };
  };
  if (atom.feed) {
    const feedTitle = atom.feed.title?.[0];
    const feedSubtitle = atom.feed.subtitle?.[0];
    return {
      title: typeof feedTitle === "string" ? feedTitle : (feedTitle?._ ?? null),
      description:
        typeof feedSubtitle === "string"
          ? feedSubtitle
          : (feedSubtitle?._ ?? null),
    };
  }

  // RDF
  const rdf = parsed as {
    "rdf:RDF"?: {
      channel?: { title?: string[]; description?: string[] }[];
    };
  };
  if (rdf["rdf:RDF"]?.channel?.[0]) {
    const ch = rdf["rdf:RDF"].channel[0];
    return {
      title: ch.title?.[0] ?? null,
      description: ch.description?.[0] ?? null,
    };
  }

  return { title: null, description: null };
}

/**
 * Detect contentInFeed from raw XML string.
 */
export async function detectContentInFeedFromXml(
  xml: string,
): Promise<boolean> {
  const parsed = (await parseStringPromise(xml, {
    trim: true,
    explicitArray: true,
  })) as Record<string, unknown>;
  return await detectContentInFeed(parsed);
}
