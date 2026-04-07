import { inngest } from "~/inngest/client";
import fetch from "node-fetch";
import {
  type MacroVoicesCandidate,
  fetchMacroVoicesTranscript,
  macroVoicesTakeawayPrompt,
  parseMacroVoicesList,
} from "./macrovoices-helpers";
import {
  getExistingLinks,
  ingestDocuments,
} from "../../helpers/ingest-pipeline";

type MacroVoicesCandidateWithTranscript = MacroVoicesCandidate & {
  articleText: string;
};

/**
 * Scrape MacroVoices transcripts landing page (first page) daily.
 * Runs daily at 5 AM Phoenix time.
 */
const trigger =
  process.env.NODE_ENV === "production"
    ? ({ cron: "TZ=America/Phoenix 0 5 * * *" } as const)
    : ({ event: "dev/scheduler.macrovoices-scraper.manual" } as const);

export const macroVoicesScraper = inngest.createFunction(
  { id: "scheduler.macrovoices-scraper" },
  trigger,
  async ({ step }) => {
    const baseUrl = "https://www.macrovoices.com";
    const listUrl = `${baseUrl}/podcast-transcripts`;

    // Pull the transcript listing page for the latest episodes
    const listHtml = await step.run("fetch-list-page", async () => {
      const res = await fetch(listUrl);
      return res.text();
    });

    const candidates: MacroVoicesCandidate[] = await step.run(
      "parse-list",
      () => parseMacroVoicesList(listHtml, baseUrl),
    );

    // Skip early if nothing new is found on the landing page
    if (candidates.length === 0) {
      return { inserted: 0, skipped: 0 };
    }

    // Avoid reprocessing transcripts already in the database
    const existingLinkSet = await getExistingLinks(
      step,
      candidates.map((c) => c.link),
    );

    const newCandidates = candidates.filter(
      (candidate) => !existingLinkSet.has(candidate.link),
    );

    // Nothing to do if all candidates already exist
    if (newCandidates.length === 0) {
      return { inserted: 0, skipped: candidates.length };
    }

    // Fetch and parse each transcript to capture full article text
    const candidatesWithTranscripts = await step.run(
      "fetch-transcripts",
      async () => {
        const results = await Promise.all(
          newCandidates.map(async (candidate) => {
            const articleText = await fetchMacroVoicesTranscript(
              candidate.link,
            );
            if (!articleText) {
              return null;
            }

            return { ...candidate, articleText };
          }),
        );

        return results.filter((c): c is MacroVoicesCandidateWithTranscript =>
          Boolean(c),
        );
      },
    );

    // Abort insert if transcript fetch failed for every new candidate
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
        source: "MacroVoices",
        takeawayPrompt: macroVoicesTakeawayPrompt,
        takeawayModel: "gpt-5.4",
      },
    );

    return {
      inserted: inserted.length,
      skipped: candidates.length - candidatesWithTranscripts.length,
    };
  },
);
