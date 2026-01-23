import { inngest } from "~/inngest/client";
import fetch from "node-fetch";
import { db, schema } from "~/postgres/db";
import { inArray } from "drizzle-orm";
import {
  MacroVoicesCandidate,
  fetchMacroVoicesTranscript,
  macroVoicesTakeawayPrompt,
  parseMacroVoicesList,
} from "./macrovoices-helpers";
import { getDocumentSummary } from "../../helpers/get-document-summary";

type MacroVoicesCandidateWithTranscript = MacroVoicesCandidate & {
  articleText: string;
};

/**
 * Scrape MacroVoices transcripts landing page (first page) daily.
 * Runs daily at 5 AM Phoenix time.
 */
export const macroVoicesScraper = inngest.createFunction(
  { id: "scheduler.macrovoices-scraper" },
  { cron: "TZ=America/Phoenix 0 5 * * *" },
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

    // Generate summaries for each document
    const summaries = await Promise.all(
      candidatesWithTranscripts.map(async (doc, index) => {
        return await step.run(`generate-summary-${index}`, async () => {
          return await getDocumentSummary(doc.articleText, doc.title);
        });
      }),
    );

    // Persist new transcripts to the documents table
    const inserted = await step.run("insert-documents", async () => {
      const values = candidatesWithTranscripts.map((doc, index) => ({
        source: "MacroVoices",
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

    // Kick off takeaway generation for each inserted transcript
    await Promise.all(
      inserted.map(async (doc) => {
        await step.sendEvent(`generate-takeaways-${doc.id}`, {
          name: "app/generate-takeaways",
          data: {
            documentId: doc.id,
            takeawayPrompt: macroVoicesTakeawayPrompt,
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
