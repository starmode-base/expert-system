import { inngest } from "../client";
import { fetchAndSaveTranscript } from "../steps/scrapers/save-content";
import { publishNotifyUI } from "~/lib/ably";
import { generateTakeaways } from "./generate-takeaways";

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
            console.log("error", error);
            await publishNotifyUI(
              event.user.id,
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
        await publishNotifyUI(event.user.id, `Complete`);
      });

      return;
    }

    await step.run(
      "publish-invalidate",
      publishNotifyUI,
      event.user.id,
      `Scrape Complete. Generating takeways for ${documentIds.length} Transcripts`,
    );

    await Promise.all(
      documentIds.map(async (documentId) => {
        // If scrapeLink fails, documentId will be undefined
        if (!documentId) {
          return;
        }

        await step.invoke("generate-takeaways", {
          function: generateTakeaways,
          data: {
            documentId,
            takeawayPrompt:
              "Focus on articulating the most notable insight that can be drawn about markets, the economy, new technologies, consumer demand or the business environment at large. Only include financial performance of the company to the extent that it supports insights about any of the afore mentioned themes.",
            model: "gpt-5.1",
          },
          user: event.user,
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
      event.user.id,
      "Complete",
    );
  },
);
