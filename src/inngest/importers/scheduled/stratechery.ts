import { inngest } from "~/inngest/client";
import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";
import * as cheerio from "cheerio";
import { invariant } from "@tanstack/react-router";
import { db, schema } from "~/postgres/db";
import { inArray } from "drizzle-orm";

interface StratecheryCandidate {
  link: string;
  title: string;
  description: string;
  publicationDate: string;
  articleText: string;
}

interface StratecheryRssItem {
  title?: (string | { _: string })[];
  guid?: (string | { _: string; $?: Record<string, string> })[];
  link?: (string | { _: string })[];
  description?: (string | { _: string })[];
  pubDate?: (string | { _: string })[];
  "content:encoded"?: (string | { _: string })[];
}

interface StratecheryRssChannel {
  item?: StratecheryRssItem[] | StratecheryRssItem;
}

interface StratecheryRssFeed {
  rss: {
    channel: StratecheryRssChannel[] | StratecheryRssChannel;
  };
}

function normalizeLink(rawGuid: string) {
  const trimmed = rawGuid.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    url.hash = "";
    url.searchParams.delete("access_token");
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

export const stratecheryTakeawayPrompt = `
Focus on takeaways that matter for strategy, technology businesses, competitive dynamics, market structure, distribution, regulation, and second-order effects.

Guidelines:
- Write takeaways that generalize beyond the article, not just a recap of what happened
- Prioritize what changes incentives, moats, value chains, or the balance of power
- Call out tradeoffs and why the obvious alternative is wrong
- If relevant, include one concrete implication for builders/investors/operators
`.trim();

/**
 * Scrape Stratechery daily.
 * Runs daily at 9 AM Phoenix time.
 */
export const stratecheryScraper = inngest.createFunction(
  { id: "scheduler.stratechery-scraper" },
  { cron: "TZ=America/Phoenix 0 5 * * *" },
  async ({ step }) => {
    const rssItems: StratecheryRssItem[] = await step.run(
      "fetch-and-parse-rss",
      async () => {
        const res = await fetch(
          "https://stratechery.passport.online/feed/rss/CKPvLmrWXqk3s5KJf6fjL",
        );
        const xml = await res.text();

        const parsed = (await parseStringPromise(xml, {
          trim: true,
          explicitArray: true,
        })) as StratecheryRssFeed;

        const channel = coerceToArray(parsed.rss.channel)[0];
        invariant(channel, "Invalid RSS feed");

        return coerceToArray(channel.item);
      },
    );

    const candidates: StratecheryCandidate[] = await step.run(
      "parse-rss-items",
      () => {
        return rssItems
          .map((item) => {
            const rawGuid = extractXmlText(item.guid);
            const rawLink = extractXmlText(item.link);
            const rawTitle = extractXmlText(item.title);
            const rawDescription = extractXmlText(item.description);
            const rawPubDate = extractXmlText(item.pubDate);
            const rawContent = extractXmlText(item["content:encoded"]);
            if (
              !(rawGuid || rawLink) ||
              !rawTitle ||
              !rawDescription ||
              !rawPubDate ||
              !rawContent
            ) {
              return null;
            }

            const guidCandidate = rawGuid?.trim();
            const linkToNormalize = (guidCandidate ? rawGuid : null) ?? rawLink;
            if (!linkToNormalize) {
              return null;
            }

            const link = normalizeLink(linkToNormalize);
            if (!link) {
              return null;
            }

            const publicationDate = new Date(rawPubDate);
            if (Number.isNaN(publicationDate.getTime())) {
              return null;
            }

            return {
              link,
              title: rawTitle,
              description: rawDescription,
              publicationDate: publicationDate.toISOString(),
              articleText: htmlToPlainText(rawContent),
            };
          })
          .filter((c): c is NonNullable<typeof c> => Boolean(c));
      },
    );

    // No candidates found, nothing to do.
    if (candidates.length === 0) {
      return { inserted: 0, skipped: rssItems.length };
    }

    // Get unique links.
    const uniqueLinks = Array.from(
      new Set(candidates.map((candidate) => candidate.link)),
    );

    // Get existing links.
    const existingLinks = await step.run("get-existing-links", async () => {
      const rows = await db
        .select({ link: schema.documents.link })
        .from(schema.documents)
        .where(inArray(schema.documents.link, uniqueLinks));

      return rows.map((r) => r.link);
    });

    const existingLinkSet = new Set(existingLinks);

    // Filter candidates that are not in the existing link set and have a publication date after October 1st
    const cutoffDate = new Date("2025-01-01T00:00:00Z");
    const toInsert = candidates.filter(
      (candidate) =>
        !existingLinkSet.has(candidate.link) &&
        new Date(candidate.publicationDate) > cutoffDate,
    );

    if (toInsert.length === 0) {
      return { inserted: 0, skipped: candidates.length };
    }

    const inserted = await step.run("insert-documents", async () => {
      const values = toInsert.map((doc) => ({
        source: "Stratechery (Ben Thompson)",
        title: doc.title,
        description: doc.description,
        publicationDate: new Date(doc.publicationDate),
        link: doc.link,
        articleText: doc.articleText,
      }));

      return await db
        .insert(schema.documents)
        .values(values)
        .returning({ id: schema.documents.id });
    });

    await Promise.all(
      inserted.map(async (doc) => {
        await step.sendEvent(`generate-takeaways-${doc.id}`, {
          name: "app/generate-takeaways",
          data: {
            documentId: doc.id,
            takeawayPrompt: stratecheryTakeawayPrompt,
            model: "gpt-5.2",
            user: { id: "", email: "" },
          },
        });
      }),
    );

    return {
      inserted: inserted.length,
      skipped: candidates.length - toInsert.length,
    };
  },
);
