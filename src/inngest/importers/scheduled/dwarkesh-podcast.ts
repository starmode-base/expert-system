import { inngest } from "~/inngest/client";
import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";
import * as cheerio from "cheerio";
import { invariant } from "@tanstack/react-router";
import { db, schema } from "~/postgres/db";
import { inArray } from "drizzle-orm";
import { fetchDwarkeshPodcastTranscript } from "~/inngest/importers/scrapers/dwarkesh-podcast";

interface DwarkeshPodcastCandidate {
  link: string;
  title: string;
  description: string;
  publicationDate: string;
}

interface DwarkeshPodcastRssItem {
  title?: (string | { _: string })[];
  guid?: (string | { _: string; $?: Record<string, string> })[];
  link?: (string | { _: string })[];
  description?: (string | { _: string })[];
  pubDate?: (string | { _: string })[];
}

interface DwarkeshPodcastRssChannel {
  item?: DwarkeshPodcastRssItem[] | DwarkeshPodcastRssItem;
}

interface DwarkeshPodcastRssFeed {
  rss: {
    channel: DwarkeshPodcastRssChannel[] | DwarkeshPodcastRssChannel;
  };
}

function normalizeLink(rawLink: string) {
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

function coerceToArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function extractXmlText(value: unknown): string | null {
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

export const dwarkeshPodcastTakeawayPrompt = `
Focus on durable insights from long-form podcast conversations, especially around technology, science, economics, policy, and strategy.

Guidelines:
- Extract arguments, frameworks, or mental models
- Highlight disagreements, surprising claims, or quantified estimates when present
- Connect ideas to practical implications for builders, researchers, and investors
`.trim();

/**
 * Scrape Dwarkesh Podcast RSS and ingest new episodes with transcripts.
 * Runs daily at 5 AM Phoenix time.
 */
export const dwarkeshPodcastScraper = inngest.createFunction(
  { id: "scheduler.dwarkesh-podcast-scraper" },
  { cron: "TZ=America/Phoenix 0 5 * * *" },
  async ({ step }) => {
    const rssItems: DwarkeshPodcastRssItem[] = await step.run(
      "fetch-and-parse-rss",
      async () => {
        const res = await fetch(
          "https://api.substack.com/feed/podcast/69345.rss",
        );
        const xml = await res.text();

        const parsed = (await parseStringPromise(xml, {
          trim: true,
          explicitArray: true,
        })) as DwarkeshPodcastRssFeed;

        const channel = coerceToArray(parsed.rss.channel)[0];
        invariant(channel, "Invalid RSS feed");

        return coerceToArray(channel.item);
      },
    );

    const candidates: DwarkeshPodcastCandidate[] = await step.run(
      "parse-rss-items",
      () => {
        return rssItems
          .map((item) => {
            const rawGuid = extractXmlText(item.guid);
            const rawLink = extractXmlText(item.link);
            const rawTitle = extractXmlText(item.title);
            const rawDescription = extractXmlText(item.description);
            const rawPubDate = extractXmlText(item.pubDate);

            const link = normalizeLink(rawLink ?? rawGuid ?? "");
            if (!link || !rawTitle || !rawDescription || !rawPubDate) {
              return null;
            }

            const publicationDate = new Date(rawPubDate);
            if (Number.isNaN(publicationDate.getTime())) {
              return null;
            }

            return {
              link,
              title: rawTitle,
              description: htmlToPlainText(rawDescription),
              publicationDate: publicationDate.toISOString(),
            };
          })
          .filter((c): c is NonNullable<typeof c> => Boolean(c));
      },
    );

    if (candidates.length === 0) {
      return { inserted: 0, skipped: rssItems.length };
    }

    const uniqueLinks = Array.from(
      new Set(candidates.map((candidate) => candidate.link)),
    );

    const existingLinks = await step.run("get-existing-links", async () => {
      const rows = await db
        .select({ link: schema.documents.link })
        .from(schema.documents)
        .where(inArray(schema.documents.link, uniqueLinks));

      return rows.map((r) => r.link);
    });

    const existingLinkSet = new Set(existingLinks);
    const cutoffDate = new Date("2024-01-01T00:00:00Z");

    const newCandidates = candidates.filter(
      (candidate) =>
        !existingLinkSet.has(candidate.link) &&
        new Date(candidate.publicationDate) > cutoffDate,
    );

    if (newCandidates.length === 0) {
      return { inserted: 0, skipped: candidates.length };
    }

    const candidatesWithTranscripts = await step.run(
      "fetch-transcripts",
      async () => {
        const results = await Promise.all(
          newCandidates.slice(0, 1).map(async (candidate) => {
            const articleText = await fetchDwarkeshPodcastTranscript(
              candidate.link,
            );
            if (!articleText) {
              return null;
            }

            return { ...candidate, articleText };
          }),
        );

        return results.filter(
          (
            candidate,
          ): candidate is DwarkeshPodcastCandidate & { articleText: string } =>
            Boolean(candidate),
        );
      },
    );

    if (candidatesWithTranscripts.length === 0) {
      return { inserted: 0, skipped: newCandidates.length };
    }

    const inserted = await step.run("insert-documents", async () => {
      const values = candidatesWithTranscripts.map((doc) => ({
        source: "Dwarkesh Podcast",
        title: doc.title,
        description: doc.description,
        publicationDate: new Date(doc.publicationDate),
        link: doc.link,
        articleText: doc.articleText,
      }));

      return await db.insert(schema.documents).values(values).returning({
        id: schema.documents.id,
      });
    });

    await Promise.all(
      inserted.map(async (doc) => {
        await step.sendEvent(`generate-takeaways-${doc.id}`, {
          name: "app/generate-takeaways",
          data: {
            documentId: doc.id,
            takeawayPrompt: dwarkeshPodcastTakeawayPrompt,
            model: "gpt-5.2",
          },
          user: { id: "", email: "" },
        });
      }),
    );

    return {
      inserted: inserted.length,
      skipped: candidates.length - candidatesWithTranscripts.length,
    };
  },
);
