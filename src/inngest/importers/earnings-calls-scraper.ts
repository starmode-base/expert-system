import { publishNotifyUI } from "~/lib/ably";
import { AlphaVantageRateLimitError } from "~/inngest/importers/scrapers/earnings-transcripts";
import { earningsCallTakeawayPrompt } from "./scheduled/process-earnings-jobs";
import { inngest } from "../client";
import { fetchAndSaveTranscript } from "./scrapers/save-content";

interface ScraperResult {
  status: "success" | "error";
  documentId: string | null;
  error: string | null;
}

export const earningsCallsScraper = inngest.createFunction(
  { id: "scraper.earnings-calls" },
  { event: "scraper/earnings-calls" },
  async ({ step, event }) => {
    console.log("Scraper started: ", event.data);
    // Scrape and save content

    const symbols = event.data.symbols;

    const documentIdsResult: ScraperResult[] = [];

    for (const symbol of symbols) {
      const result = await step.run(
        `fetch-earnings-transcript-${symbol.symbol}`,
        async () => {
          const year = event.data.year;
          const quarter = event.data.quarter;

          try {
            const documentId = await fetchAndSaveTranscript({
              symbol: symbol.symbol,
              name: symbol.name,
              year,
              quarter,
            });

            return {
              status: "success",
              error: null,
              documentId,
            } as ScraperResult;
          } catch (error) {
            if (error instanceof AlphaVantageRateLimitError) {
              throw error;
            }

            console.log("error", error);
            await publishNotifyUI(
              event.data.user.id,
              `There was an Error fetching ${symbol.symbol} transcript`,
            );

            return {
              status: "error",
              error: error instanceof Error ? error.message : "Unknown error",
              documentId: null,
            } as ScraperResult;
          }
        },
      );
      documentIdsResult.push(result);
      await step.sleep("sleep-1-second", 1000);
    }

    const documentIds = documentIdsResult
      .filter((r) => r.status === "success")
      .map((r) => r.documentId);

    if (documentIds.length === 0 && symbols.length > 0) {
      await step.run("publish-invalidate", async () => {
        await publishNotifyUI(event.data.user.id, `Complete`);
      });

      return;
    }

    await step.run(
      "publish-invalidate",
      publishNotifyUI,
      event.data.user.id,
      `Scrape Complete. Generating takeways for ${documentIds.length} Transcripts`,
    );

    await Promise.all(
      documentIds.map(async (documentId) => {
        // If scrapeLink fails, documentId will be undefined
        if (!documentId) {
          return;
        }

        await step.sendEvent(`generate-takeaways-${documentId}`, {
          name: "app/generate-takeaways",
          data: {
            documentId,
            takeawayPrompt: earningsCallTakeawayPrompt,
            model: "gpt-5.2",
            user: event.data.user,
          },
        });
      }),
    );

    /**
     * Step 3: Publish to the Ably channel
     * NOTE: Scrape is complete but not all takeaways have been generated
     */
    await step.run(
      "publish-invalidate",
      publishNotifyUI,
      event.data.user.id,
      "Complete",
    );
  },
);
