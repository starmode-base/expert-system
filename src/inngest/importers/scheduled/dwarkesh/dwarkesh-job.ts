import { inngest } from "~/inngest/client";
import fetch from "node-fetch";
import {
  type DwarkeshPodcastCandidate,
  dwarkeshPodcastTakeawayPrompt,
  fetchDwarkeshCandidatesWithTranscripts,
  parseDwarkeshPodcastCandidates,
} from "./dwarkesh-helpers";
import {
  getExistingLinks,
  ingestDocuments,
} from "../../helpers/ingest-pipeline";

/**
 * Scrape Dwarkesh Podcast RSS and ingest new episodes with transcripts.
 * Runs daily at 5 AM Phoenix time.
 */
const trigger =
  process.env.NODE_ENV === "production"
    ? ({ cron: "TZ=America/Phoenix 0 5 * * *" } as const)
    : ({ event: "dev/scheduler.dwarkesh-podcast-scraper.manual" } as const);

export const dwarkeshPodcastScraper = inngest.createFunction(
  { id: "scheduler.dwarkesh-podcast-scraper" },
  trigger,
  async ({ step }) => {
    const rssXml = await step.run("fetch-rss", async () => {
      const res = await fetch(
        "https://api.substack.com/feed/podcast/69345.rss",
      );
      return res.text();
    });

    const candidates: DwarkeshPodcastCandidate[] = await step.run(
      "parse-rss-items",
      () => parseDwarkeshPodcastCandidates(rssXml),
    );

    if (candidates.length === 0) {
      return { inserted: 0, skipped: 0 };
    }

    const existingLinkSet = await getExistingLinks(
      step,
      candidates.map((c) => c.link),
    );

    const cutoffDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

    const newCandidates = candidates.filter(
      (candidate) =>
        !existingLinkSet.has(candidate.link) &&
        new Date(candidate.publicationDate) > cutoffDate,
    );

    if (newCandidates.length === 0) {
      return { inserted: 0, skipped: candidates.length };
    }

    const candidatesWithTranscripts = await step.run("fetch-transcripts", () =>
      fetchDwarkeshCandidatesWithTranscripts(newCandidates),
    );

    if (candidatesWithTranscripts.length === 0) {
      return { inserted: 0, skipped: newCandidates.length };
    }

    const { inserted } = await ingestDocuments(
      step,
      candidatesWithTranscripts.map((c) => ({
        link: c.link,
        title: c.title,
        publicationDate: c.publicationDate,
        articleText: c.articleText,
      })),
      {
        source: "Dwarkesh Podcast",
        takeawayPrompt: dwarkeshPodcastTakeawayPrompt,
        takeawayModel: "gpt-5.4",
      },
    );

    return {
      inserted: inserted.length,
      skipped: candidates.length - candidatesWithTranscripts.length,
    };
  },
);
