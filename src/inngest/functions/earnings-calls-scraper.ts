import { db } from "~/postgres/db";
import { inngest } from "../client";
import { fetchEarningsTranscript } from "~/lib/earnings-transcripts";
import { saveContent } from "../steps/scrapers/save-content";
import { and } from "drizzle-orm";
import { publishNotifyUI } from "~/lib/ably";
import { generateTakeaways } from "./generate-takeaways";

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

    const symbols = event.data.symbols;

    const documentIds = await Promise.all(
      symbols.map(async (symbol) => {
        return await step.run(
          `fetch-earnings-transcript-${symbol.symbol}`,
          async () => {
            const year = event.data.year;
            const quarter = event.data.quarter;

            const result = await fetchEarningsTranscript({
              ticker: symbol.symbol,
              year,
              quarter,
            }).catch(async (error) => {
              console.log("error", error);
              await publishNotifyUI(
                event.user.id,
                `There was an Error fetching ${symbol.symbol} transcript`,
              );

              return;
            });

            if (!result) {
              return;
            }

            const publicationDate = new Date(result.date);
            const title = `${symbol.name} - Q${quarter} ${year} Earnings Call Transcript`;

            const document = {
              source: "Earnings Calls",
              title,
              //   TODO - add earning results from Earnings Calendar API
              description: title,
              publicationDate,
              link: "",
              articleText: result.transcript,
              tags: [], // TODO - add tags
            };

            if (await transcriptExsists(document)) {
              console.log("Transcript already exists");
              await publishNotifyUI(
                event.user.id,
                `Error: ${title} already exists`,
              );
              return;
            }

            return await saveContent(document);
          },
        );
      }),
    );

    if (documentIds.filter(Boolean).length === 0) {
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
              "Focus on articulating the single most notable insight that can be drawn about markets, the economy, new technologies, consumer demand or the business environment at large. Include financial performance of the company to the extent that it supports insights about any of the afore mentioned themes.",
            model: "o3-mini",
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
