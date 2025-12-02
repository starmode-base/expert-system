import { db } from "~/postgres/db";
import { inngest } from "../client";
import { fetchAlphaVantageEarningsTranscript } from "~/lib/earnings-transcripts";
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

            const result = await fetchAlphaVantageEarningsTranscript({
              symbol: symbol.symbol,
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

            // Map each quarter to the first month of the following quarter. For Q4, increment the year.
            const nextQuarterMapping = {
              1: { month: 4, yearOffset: 0 },
              2: { month: 7, yearOffset: 0 },
              3: { month: 10, yearOffset: 0 },
              4: { month: 1, yearOffset: 1 },
            };
            const { month, yearOffset } =
              nextQuarterMapping[quarter as 1 | 2 | 3 | 4];
            const publicationYear = year + yearOffset;
            const monthString = String(month).padStart(2, "0");
            const publicationDate = new Date(
              `${publicationYear}-${monthString}-01`,
            );
            const title = `${symbol.name} - Q${quarter} ${year} Earnings Call Transcript`;

            const articleText = result
              .map(
                (entry) =>
                  `${entry.speaker} (${entry.title}): "${entry.content}"`,
              )
              .join("\n");

            const document = {
              source: "Earnings Calls",
              title,
              //   TODO - add earning results from Earnings Calendar API
              description: title,
              publicationDate,
              link: "",
              articleText,
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
