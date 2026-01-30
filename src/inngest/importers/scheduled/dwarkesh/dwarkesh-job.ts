import { inngest } from "~/inngest/client";
import fetch from "node-fetch";
import { db, schema } from "~/postgres/db";
import { inArray } from "drizzle-orm";
import {
  DwarkeshPodcastCandidate,
  dwarkeshPodcastTakeawayPrompt,
  fetchDwarkeshCandidatesWithTranscripts,
  parseDwarkeshPodcastCandidates,
} from "./dwarkesh-helpers";
import { getDocumentSummary } from "../../helpers/get-document-summary";

type DwarkeshPodcastCandidateWithTranscript = DwarkeshPodcastCandidate & {
  articleText: string;
};

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
    const cutoffDate = new Date("2025-09-01T00:00:00Z");

    const newCandidates = candidates.filter(
      (candidate) =>
        !existingLinkSet.has(candidate.link) &&
        new Date(candidate.publicationDate) > cutoffDate,
    );

    if (newCandidates.length === 0) {
      return { inserted: 0, skipped: candidates.length };
    }

    const candidatesWithTranscripts: DwarkeshPodcastCandidateWithTranscript[] =
      await step.run("fetch-transcripts", () =>
        fetchDwarkeshCandidatesWithTranscripts(newCandidates),
      );

    if (candidatesWithTranscripts.length === 0) {
      return { inserted: 0, skipped: newCandidates.length };
    }

    // Generate summaries for each document
    const summaries = await Promise.all(
      candidatesWithTranscripts.map(async (doc, index) => {
        return await step.run(`generate-summary-${index}`, async () => {
          return await getDocumentSummary(doc.articleText, doc.title);
        });
      }),
    );

    const inserted = await step.run("insert-documents", async () => {
      const values = candidatesWithTranscripts.map((doc, index) => ({
        source: "Dwarkesh Podcast",
        title: doc.title,
        description: summaries[index] ?? doc.description,
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
            user: { id: "", email: "" },
          },
        });
      }),
    );

    return {
      inserted: inserted.length,
      skipped: candidates.length - candidatesWithTranscripts.length,
    };
  },
);
