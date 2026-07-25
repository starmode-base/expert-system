import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";
import { invariant } from "@tanstack/react-router";
import { inngest } from "../../client";
import { scrapePageFromHtml } from "~/inngest/importers/scrapers/scrape-page";
import { coerceToArray, extractXmlText, normalizeLink } from "./parse-helpers";
import {
  processAndUploadImages,
  type ProcessedImage,
} from "~/inngest/importers/scrapers/process-images";
import {
  getExistingLinks,
  ingestDocuments,
  type IngestCandidate,
} from "../helpers/ingest-pipeline";

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

    const existingLinkSet = await getExistingLinks(
      step,
      recentCandidates.map((c) => c.link),
    );

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

    const ingestCandidates: IngestCandidate[] = scraped
      .filter(
        (
          result,
        ): result is PromiseFulfilledResult<{
          candidate: FedCandidate;
          articleText: string;
          images: ProcessedImage[];
        }> => result.status === "fulfilled",
      )
      .map((r) => ({
        link: r.value.candidate.link,
        title: r.value.candidate.title,
        publicationDate: r.value.candidate.publicationDate,
        articleText: r.value.articleText,
        images: r.value.images,
      }));

    const { inserted } = await ingestDocuments(step, ingestCandidates, {
      source: FED_SOURCE,
      takeawayPrompt: fedSpeechesTakeawayPrompt,
    });

    return {
      inserted: inserted.length,
      skipped: recentCandidates.length - inserted.length,
    };
  },
);
