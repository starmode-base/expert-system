import { db } from "~/postgres/db";
import { inngest } from "../client";
import { fetchEarningsTranscript } from "~/lib/earnings-transcripts";
import { saveContent } from "../steps/scrapers/save-content";
import { and } from "drizzle-orm";
import { publishNotifyUI } from "~/lib/ably";

async function transcriptExsists({
  source,
  title,
}: {
  source: string;
  title: string;
}) {
  // check if transcript exists before saveing
  const transcript = await db.query.documents.findFirst({
    where: (documents, { eq }) =>
      and(eq(documents.title, title), eq(documents.source, source)),
    columns: { id: true },
  });

  // if transcript exists, skip
  if (transcript?.id) {
    return true;
  } else {
    return false;
  }
}

export const earningsCallsScraper = inngest.createFunction(
  { id: "scraper.earnings-calls" },
  { event: "scraper/earnings-calls" },
  async ({ step, event }) => {
    console.log("Scraper started: ", event.data);
    // Scrape and save content

    // get tickers
    const symbols = await step.run("get-ticker-symbols", async () => {
      return db.query.stocks.findMany({
        columns: {
          symbol: true,
          name: true,
        },
        // TODO: Temporarily use random symbols
        orderBy: (stocks, { sql }) => sql`RANDOM()`,
        limit: 5,
      });
    });

    const documentIds = await Promise.all(
      symbols.map(async (symbol) => {
        return await step.run(
          `fetch-earnings-transcript-${symbol.symbol}`,
          async () => {
            const year = 2024;
            const quarter = 1;

            const result = await fetchEarningsTranscript({
              ticker: symbol.symbol,
              year,
              quarter,
            }).catch((error) => {
              // continue
              console.log("error", error);
              return;
            });

            if (!result) {
              return;
            }

            console.log("result", result.date);

            const document = {
              source: "Earnings Calls",
              title: `${symbol.name} - Q${quarter} ${year} Earnings Call Transcript`,
              //   TODO - add earning results from Earnings Calendar API
              description: `${symbol.name} - Q${quarter} ${year} Earnings Call Transcript`,
              pubDate: result.date,
              link: "",
              articleText: result.transcript,
              tags: [], // TODO - add tags
            };

            if (await transcriptExsists(document)) {
              console.log("Transcript already exists");
              return;
            }

            return await saveContent(document);
          },
        );
      }),
    );

    await Promise.all(
      documentIds.map(async (documentId) => {
        // If scrapeLink fails, documentId will be undefined
        if (!documentId) {
          return;
        }

        await step.sendEvent("generate-takeaways", {
          name: "app/generate-takeaways",
          data: { documentId },
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
