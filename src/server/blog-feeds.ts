import { createServerFn } from "@tanstack/react-start";
import { parseStringPromise } from "xml2js";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { z } from "zod";

interface OpmlOutline {
  $: {
    type?: string;
    text?: string;
    title?: string;
    xmlUrl?: string;
    htmlUrl?: string;
  };
}

interface OpmlResult {
  opml: {
    body: [{ outline: [{ outline: OpmlOutline[] }] }];
  };
}

export interface BlogFeed {
  title: string;
  xmlUrl: string;
  htmlUrl: string;
}

interface RssFeedItem {
  title: string;
  link: string;
  pubDate: string | null;
}

/**
 * Parse the OPML file and return the list of blog feeds
 */
export const listBlogFeedsSF = createServerFn({ method: "GET" }).handler(
  async () => {
    const opmlPath = resolve(
      process.cwd(),
      "src/inngest/importers/blog-feeds.opml",
    );
    const opmlContent = await readFile(opmlPath, "utf-8");
    const result = (await parseStringPromise(opmlContent)) as OpmlResult;

    const outlines = result.opml.body[0].outline[0].outline;

    const feeds: BlogFeed[] = outlines
      .filter(
        (o): o is OpmlOutline & { $: { xmlUrl: string } } =>
          o.$.type === "rss" && typeof o.$.xmlUrl === "string",
      )
      .map((o) => ({
        title: o.$.title ?? o.$.text ?? "Unknown",
        xmlUrl: o.$.xmlUrl,
        htmlUrl: o.$.htmlUrl ?? "",
      }))
      .sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
      );

    return feeds;
  },
);

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

    // Handle RSS 2.0
    const rss = parsed as { rss?: { channel?: { item?: unknown[] }[] } };
    if (rss.rss?.channel?.[0]?.item) {
      const items = rss.rss.channel[0].item as {
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

    // Handle Atom
    const atom = parsed as { feed?: { entry?: unknown[] } };
    if (atom.feed?.entry) {
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

    // Handle RDF/RSS 1.0
    const rdf = parsed as {
      "rdf:RDF"?: { item?: unknown[] };
    };
    if (rdf["rdf:RDF"]?.item) {
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

    return articles;
  });
