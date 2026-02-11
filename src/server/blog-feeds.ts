import { createServerFn } from "@tanstack/react-start";
import { eq, not } from "drizzle-orm";
import { parseStringPromise } from "xml2js";
import { z } from "zod";
import { db, schema } from "~/postgres/db";

export interface BlogFeed {
  id: string;
  title: string;
  description: string | null;
  xmlUrl: string;
  htmlUrl: string | null;
  enabled: boolean;
  contentInFeed: boolean;
  lastScrapedAt: string | null;
}

interface FeedMetadata {
  title: string | null;
  description: string | null;
}

interface RssFeedItem {
  title: string;
  link: string;
  pubDate: string | null;
}

/**
 * Query the blogs table and return all feeds sorted by title
 */
export const listBlogFeedsSF = createServerFn({ method: "GET" }).handler(
  async () => {
    const rows = await db
      .select()
      .from(schema.blogs)
      .orderBy(schema.blogs.title);

    const feeds: BlogFeed[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      xmlUrl: row.xmlUrl,
      htmlUrl: row.htmlUrl,
      enabled: row.enabled,
      contentInFeed: row.contentInFeed,
      lastScrapedAt: row.lastScrapedAt?.toISOString() ?? null,
    }));

    return feeds;
  },
);

/**
 * Toggle a blog's enabled status
 */
export const toggleBlogEnabledSF = createServerFn({ method: "POST" })
  .validator(z.object({ blogId: z.string() }))
  .handler(async ({ data }) => {
    const rows = await db
      .update(schema.blogs)
      .set({ enabled: not(schema.blogs.enabled) })
      .where(eq(schema.blogs.id, data.blogId))
      .returning({ id: schema.blogs.id, enabled: schema.blogs.enabled });

    const row = rows[0];
    if (!row) {
      throw new Error("Blog not found");
    }

    return row;
  });

/**
 * Fetch and parse an RSS/Atom feed, returning its articles
 */
export const fetchFeedArticlesSF = createServerFn({ method: "GET" })
  .validator(z.object({ xmlUrl: z.url() }))
  .handler(async ({ data }) => {
    const response = await fetch(data.xmlUrl, {
      headers: { "User-Agent": "ExpertSystem/1.0 RSS Reader" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch feed: ${response.status}`);
    }

    const xml = await response.text();
    const parsed = (await parseStringPromise(xml)) as Record<string, unknown>;

    const articles: RssFeedItem[] = [];
    const metadata: FeedMetadata = { title: null, description: null };

    // Handle RSS 2.0
    const rss = parsed as {
      rss?: {
        channel?: {
          item?: unknown[];
          title?: string[];
          description?: string[];
        }[];
      };
    };
    if (rss.rss?.channel?.[0]) {
      const channel = rss.rss.channel[0];
      metadata.title = channel.title?.[0] ?? null;
      metadata.description = channel.description?.[0] ?? null;

      if (channel.item) {
        const items = channel.item as {
          title?: string[];
          link?: string[];
          pubDate?: string[];
        }[];
        for (const item of items) {
          articles.push({
            title: item.title?.[0] ?? "Untitled",
            link: item.link?.[0] ?? "",
            pubDate: item.pubDate?.[0] ?? null,
          });
        }
      }
    }

    // Handle Atom
    const atom = parsed as {
      feed?: {
        entry?: unknown[];
        title?: (string | { _: string })[];
        subtitle?: (string | { _: string })[];
      };
    };
    if (atom.feed) {
      const feedTitle = atom.feed.title?.[0];
      metadata.title =
        metadata.title ??
        (typeof feedTitle === "string" ? feedTitle : (feedTitle?._ ?? null));

      const feedSubtitle = atom.feed.subtitle?.[0];
      metadata.description =
        metadata.description ??
        (typeof feedSubtitle === "string"
          ? feedSubtitle
          : (feedSubtitle?._ ?? null));

      if (atom.feed.entry) {
        const entries = atom.feed.entry as {
          title?: (string | { _: string })[];
          link?: { $: { href: string } }[];
          published?: string[];
          updated?: string[];
        }[];
        for (const entry of entries) {
          const title = entry.title?.[0];
          const titleStr =
            typeof title === "string" ? title : (title?._ ?? "Untitled");

          // Atom links can have rel="alternate" or be the first link
          const link =
            entry.link?.find(
              (l) => (l.$ as { rel?: string }).rel === "alternate",
            ) ?? entry.link?.[0];

          articles.push({
            title: titleStr,
            link: link?.$.href ?? "",
            pubDate: entry.published?.[0] ?? entry.updated?.[0] ?? null,
          });
        }
      }
    }

    // Handle RDF/RSS 1.0
    const rdf = parsed as {
      "rdf:RDF"?: {
        item?: unknown[];
        channel?: { title?: string[]; description?: string[] }[];
      };
    };
    if (rdf["rdf:RDF"]) {
      const rdfChannel = rdf["rdf:RDF"].channel?.[0];
      metadata.title = metadata.title ?? rdfChannel?.title?.[0] ?? null;
      metadata.description =
        metadata.description ?? rdfChannel?.description?.[0] ?? null;

      if (rdf["rdf:RDF"].item) {
        const items = rdf["rdf:RDF"].item as {
          title?: string[];
          link?: string[];
          "dc:date"?: string[];
        }[];
        for (const item of items) {
          articles.push({
            title: item.title?.[0] ?? "Untitled",
            link: item.link?.[0] ?? "",
            pubDate: item["dc:date"]?.[0] ?? null,
          });
        }
      }
    }

    return { metadata, articles };
  });
