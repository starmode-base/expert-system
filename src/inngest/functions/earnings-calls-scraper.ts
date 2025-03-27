import { db } from "~/postgres/db";
import { inngest } from "../client";
import { fetchEarningsTranscript } from "~/lib/earnings-transcripts";
import { saveContent } from "../steps/scrapers/save-content";

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
      });
    });

    const documentIds = await Promise.all(
      symbols.slice(0, 10).map(async (symbol) => {
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
  },
);

// // Generate takeaways
// await Promise.all(
//   documentIds.map(async (documentId) => {
//     // If scrapeLink fails, documentId will be undefined
//     if (!documentId) {
//       return;
//     }

//     const takeaways = await step.run(
//       `generate-takeaways-${documentId}`,
//       async () => {
//         const articleText = await db.query.documents.findFirst({
//           where: (documents, { eq }) => eq(documents.id, documentId),
//           columns: { articleText: true },
//         });

//         invariant(articleText?.articleText, "No article text");

//         // ######
//         console.log(`Generating takeaways for document ${documentId}`);

//         const takeaways = await getTakeaways(articleText.articleText);

//         const [result] = await db
//           .insert(schema.takeaways)
//           .values({
//             documentId,
//             ...takeaways,
//           })
//           .returning();
//         invariant(result, "Failed to create takeaways");

//         return result;
//       },
//     );

//     await step.run("save-embedding-${documentId}", async () => {
//       // ######
//       console.log(`Saving embedding for document ${documentId}`);

//       const takeawayEmbedding = await generateEmbedding(takeaways.takeaway);

//       await db.insert(schema.takeawayEmbeddings).values({
//         takeawayId: takeaways.id,
//         embedding: takeawayEmbedding,
//       });

//       const conceptEmbedding = await generateEmbedding(takeaways.concept);

//       await db.insert(schema.conceptEmbeddings).values({
//         takeawayId: takeaways.id,
//         embedding: conceptEmbedding,
//       });
//     });
//   }),
// );

//   },
// );
