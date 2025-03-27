import {
  extractRssItems,
  scrapeLink,
} from "../steps/scrapers/scientific-daily";
import { inngest } from "../client";

export const scienceDailyScraper = inngest.createFunction(
  { id: "scraper.daily-science" },
  { event: "scraper/daily-science" },
  async ({ step, event }) => {
    console.log("Scraper started: ", event.user);
    // Scrape and save content
    const items = await step.run("get-rss-feed", async () => {
      // ######
      return extractRssItems(
        "https://www.sciencedaily.com/rss/top/technology.xml",
      );
    });

    const documentIds = await Promise.all(
      items.map(async (item) => {
        return await step.run("scrape-link", async () => {
          return scrapeLink(item);
        });
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

//     // Generate takeaways
//     await Promise.all(
//       documentIds.map(async (documentId) => {
//         // If scrapeLink fails, documentId will be undefined
//         if (!documentId) {
//           return;
//         }

//         const takeaways = await step.run(
//           `generate-takeaways-${documentId}`,
//           async () => {
//             const articleText = await db.query.documents.findFirst({
//               where: (documents, { eq }) => eq(documents.id, documentId),
//               columns: { articleText: true },
//             });

//             invariant(articleText?.articleText, "No article text");

//             // ######
//             console.log(`Generating takeaways for document ${documentId}`);

//             const takeaways = await getTakeaways(articleText.articleText);

//             const [result] = await db
//               .insert(schema.takeaways)
//               .values({
//                 documentId,
//                 ...takeaways,
//               })
//               .returning();
//             invariant(result, "Failed to create takeaways");

//             return result;
//           },
//         );

//         await step.run("save-embedding-${documentId}", async () => {
//           // ######
//           console.log(`Saving embedding for document ${documentId}`);

//           const takeawayEmbedding = await generateEmbedding(takeaways.takeaway);

//           await db.insert(schema.takeawayEmbeddings).values({
//             takeawayId: takeaways.id,
//             embedding: takeawayEmbedding,
//           });

//           const conceptEmbedding = await generateEmbedding(takeaways.concept);

//           await db.insert(schema.conceptEmbeddings).values({
//             takeawayId: takeaways.id,
//             embedding: conceptEmbedding,
//           });
//         });

//         /**
//          * Step 3: Publish the bedtime story to the Ably channel
//          */
//         await step.run(
//           "publish-invalidate",
//           publishNotifyUI,
//           event.user.id,
//           "Complete",
//         );
//       }),
//     );
//   },
// );
