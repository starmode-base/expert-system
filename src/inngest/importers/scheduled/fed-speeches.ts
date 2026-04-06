import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";
import { invariant } from "@tanstack/react-router";
import { inArray } from "drizzle-orm";
import { db, schema } from "~/postgres/db";
import { inngest } from "../../client";
import { scrapePageFromHtml } from "~/inngest/importers/scrapers/scrape-page";
import {
  processAndUploadImages,
  type ProcessedImage,
} from "~/inngest/importers/scrapers/process-images";
import { getDocumentSummary } from "../helpers/get-document-summary";

interface FedRssItem {
  title?: (string | { _: string })[];
  link?: (string | { _: string })[];
  guid?: (string | { _: string; $?: Record<string, string> })[];
  description?: (string | { _: string })[];
  category?: (string | { _: string })[];
  pubDate?: (string | { _: string })[];
}

interface FedRssChannel {
  item?: FedRssItem[] | FedRssItem;
}

interface FedRssFeed {
  rss: {
    channel: FedRssChannel[] | FedRssChannel;
  };
}

interface FedCandidate {
  link: string;
  title: string;
  description: string;
  category: string;
  publicationDate: string;
}

const FED_SPEECHES_RSS_URL =
  "https://www.federalreserve.gov/feeds/speeches_and_testimony.xml";

const FED_SOURCE = "Federal Reserve (Speeches & Testimony)";

export const fedSpeechesTakeawayPrompt = `
Focus on takeaways that matter for business, investing, and the economy.

Guidelines:
- Write takeaways that generalize beyond a recap of the speech
- Prefer second-order implications and decision-relevant signals
- If the speaker provides a conditional outlook, capture the conditions and the implied policy reaction function
`.trim();

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

async function scrapePageContent(url: string) {
  const res = await fetch(url);
  const html = await res.text();
  const scraped = await scrapePageFromHtml(html, url);

  const images =
    scraped.images.length > 0
      ? await processAndUploadImages(scraped.images, url)
      : [];

  return { articleText: scraped.articleText, images };
}

/**
 * Scrape Federal Reserve speeches and testimony RSS feed.
 * Runs daily.
 */
const trigger =
  process.env.NODE_ENV === "production"
    ? ({ cron: "TZ=America/Phoenix 15 5 * * *" } as const)
    : ({ event: "dev/scheduler.fed-speeches-scraper.manual" } as const);

export const fedSpeechesScraper = inngest.createFunction(
  { id: "scheduler.fed-speeches-scraper" },
  trigger,
  async ({ step }) => {
    const rssItems: FedRssItem[] = await step.run(
      "fetch-and-parse-rss",
      async () => {
        const res = await fetch(FED_SPEECHES_RSS_URL);
        const xml = await res.text();

        const parsed = (await parseStringPromise(xml, {
          trim: true,
          explicitArray: true,
        })) as FedRssFeed;

        const channel = coerceToArray(parsed.rss.channel)[0];
        invariant(channel, "Invalid RSS feed");

        return coerceToArray(channel.item);
      },
    );

    const candidates: FedCandidate[] = await step.run("parse-rss-items", () => {
      return rssItems
        .map((item) => {
          const rawGuid = extractXmlText(item.guid);
          const rawLink = extractXmlText(item.link);
          const rawTitle = extractXmlText(item.title);
          const rawDescription = extractXmlText(item.description);
          const rawCategory = extractXmlText(item.category);
          const rawPubDate = extractXmlText(item.pubDate);

          if (!rawTitle || !rawDescription || !rawPubDate) {
            return null;
          }

          const linkCandidate = (rawGuid ?? rawLink)?.trim();
          if (!linkCandidate) {
            return null;
          }

          const link = normalizeLink(linkCandidate);
          if (!link) {
            return null;
          }

          const publicationDate = new Date(rawPubDate);
          if (Number.isNaN(publicationDate.getTime())) {
            return null;
          }

          return {
            link,
            title: rawTitle.trim(),
            description: rawDescription.trim(),
            category: (rawCategory ?? "").trim(),
            publicationDate: publicationDate.toISOString(),
          };
        })
        .filter((c): c is NonNullable<typeof c> => Boolean(c));
    });

    if (candidates.length === 0) {
      return { inserted: 0, skipped: rssItems.length };
    }

    const cutoffDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

    const recentCandidates = candidates.filter(
      (candidate) => new Date(candidate.publicationDate) >= cutoffDate,
    );

    if (recentCandidates.length === 0) {
      return { inserted: 0, skipped: candidates.length };
    }

    const uniqueLinks = Array.from(
      new Set(recentCandidates.map((candidate) => candidate.link)),
    );

    const existingLinks = await step.run("get-existing-links", async () => {
      const rows = await db
        .select({ link: schema.documents.link })
        .from(schema.documents)
        .where(inArray(schema.documents.link, uniqueLinks));

      return rows.map((r) => r.link);
    });

    const existingLinkSet = new Set(existingLinks);
    const toScrape = recentCandidates.filter(
      (candidate) => !existingLinkSet.has(candidate.link),
    );

    if (toScrape.length === 0) {
      return { inserted: 0, skipped: recentCandidates.length };
    }

    const scraped = await Promise.allSettled(
      toScrape.map(async (candidate, index) => {
        const content = await step.run(`scrape-page-${index}`, async () => {
          return await scrapePageContent(candidate.link);
        });

        return { candidate, ...content };
      }),
    );

    const fulfilledScraped = scraped.filter(
      (
        result,
      ): result is PromiseFulfilledResult<{
        candidate: FedCandidate;
        articleText: string;
        images: ProcessedImage[];
      }> => result.status === "fulfilled",
    );

    if (fulfilledScraped.length === 0) {
      return { inserted: 0, skipped: toScrape.length };
    }

    // Generate summaries for each document
    const withSummaries = await Promise.all(
      fulfilledScraped.map(async (doc, index) => {
        const summaryResult = await step.run(
          `generate-summary-${index}`,
          async () => {
            return await getDocumentSummary(
              doc.value.articleText,
              doc.value.candidate.title,
            );
          },
        );
        return { ...doc.value, summaryResult };
      }),
    );

    const inserted = await step.run("insert-documents", async () => {
      const results: { id: string }[] = [];

      for (const doc of withSummaries) {
        const [row] = await db
          .insert(schema.documents)
          .values({
            source: FED_SOURCE,
            title: doc.candidate.title,
            description: doc.summaryResult.summary,
            isSubstantive: doc.summaryResult.isSubstantive,
            publicationDate: new Date(doc.candidate.publicationDate),
            link: doc.candidate.link,
            articleText: doc.articleText,
          })
          .returning({ id: schema.documents.id });

        if (!row) continue;
        results.push(row);

        if (doc.images.length > 0) {
          await db.insert(schema.documentImages).values(
            doc.images.map((img) => ({
              documentId: row.id,
              blobUrl: img.blobUrl,
              altText: img.altText,
              position: img.position,
              widthPx: img.widthPx,
              heightPx: img.heightPx,
              sizeBytes: img.sizeBytes,
            })),
          );
        }
      }

      return results;
    });

    await Promise.all(
      inserted.map(async (doc) => {
        await step.sendEvent(`generate-takeaways-${doc.id}`, {
          name: "app/generate-takeaways",
          data: {
            documentId: doc.id,
            takeawayPrompt: fedSpeechesTakeawayPrompt,
            model: "gpt-5.1",
            user: { id: "", email: "" },
          },
        });
      }),
    );

    return {
      inserted: inserted.length,
      skipped: recentCandidates.length - inserted.length,
    };
  },
);
