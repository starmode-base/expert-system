import * as cheerio from "cheerio";
import { parseStringPromise } from "xml2js";

export interface BlogArticleCandidate {
  link: string;
  title: string;
  description: string;
  publicationDate: string;
  articleText: string | null;
}

export function htmlToPlainText(html: string): string {
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

export function coerceToArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function extractXmlText(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return extractXmlText(value[0]);
  }

  if (typeof value === "object") {
    const maybeText = (value as { _: unknown })._;
    if (typeof maybeText === "string") {
      return maybeText;
    }
  }

  return null;
}

export function normalizeLink(rawLink: string): string {
  const trimmed = rawLink.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    url.hash = "";
    return url.toString();
  } catch {
    return trimmed;
  }
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
 * Detect whether a parsed feed includes full article content in items.
 * Checks for `content:encoded` or `<content>` with >200 chars of plain text.
 */
export function detectContentInFeed(parsed: Record<string, unknown>): boolean {
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
      if (encoded && htmlToPlainText(encoded).length > 200) {
        return true;
      }
    }
    return false;
  }

  // Atom
  const atom = parsed as { feed?: { entry?: AtomEntry[] } };
  if (atom.feed?.entry?.[0]) {
    const entry = atom.feed.entry[0];
    const content = entry.content?.[0];
    const contentText = extractXmlText(content);
    if (contentText && htmlToPlainText(contentText).length > 200) {
      return true;
    }
  }

  return false;
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
  if (!linkSource || !rawTitle || !rawPubDate) {
    return null;
  }

  const link = normalizeLink(linkSource);
  if (!link) {
    return null;
  }

  const publicationDate = new Date(rawPubDate);
  if (Number.isNaN(publicationDate.getTime())) {
    return null;
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
    publicationDate: publicationDate.toISOString(),
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

  if (!rawTitle || !rawPubDate) {
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

  const publicationDate = new Date(rawPubDate);
  if (Number.isNaN(publicationDate.getTime())) {
    return null;
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
    publicationDate: publicationDate.toISOString(),
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
  return detectContentInFeed(parsed);
}
