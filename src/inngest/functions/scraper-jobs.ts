import { scrapeScienceDaily } from "../steps/scrapers/scientific-daily";
import { inngest } from "../client";
import { getTakeaways } from "~/lib/ai-helpers/get-takeaways";
import { db, schema } from "~/postgres/db";
import { invariant } from "@tanstack/react-router";
import { generateEmbedding } from "~/postgres/generate-embedding";

export const dailyScraper = inngest.createFunction(
  { id: "daily.scraper" },
  { cron: "TZ=America/Phoenix 0 7 * * *" },
  async ({ step }) => {
    // Scrape and save content
    const documentIds = await step.run("science-daily-tech", async () => {
      // ######
      console.log("Scraping Science Daily");

      return scrapeScienceDaily(
        "https://www.sciencedaily.com/rss/top/technology.xml",
      );
    });

    // Generate takeaways
    await Promise.all(
      documentIds.map(async (documentId) => {
        const takeaways = await step.run(
          `generate-takeaways-${documentId}`,
          async () => {
            const articleText = await db.query.documents.findFirst({
              where: (documents, { eq }) => eq(documents.id, documentId),
              columns: { articleText: true },
            });

            invariant(articleText?.articleText, "No article text");

            // ######
            console.log(`Generating takeaways for document ${documentId}`);

            const takeaways = await getTakeaways(articleText.articleText);

            const [result] = await db
              .insert(schema.takeaways)
              .values({
                documentId,
                ...takeaways,
              })
              .returning();
            invariant(result, "Failed to create takeaways");

            return result;
          },
        );

        await step.run("save-embedding-${documentId}", async () => {
          // ######
          console.log(`Saving embedding for document ${documentId}`);

          const takeawayEmbedding = await generateEmbedding(takeaways.takeaway);

          await db.insert(schema.takeawayEmbeddings).values({
            takeawayId: takeaways.id,
            embedding: takeawayEmbedding,
          });

          const conceptEmbedding = await generateEmbedding(takeaways.concept);

          await db.insert(schema.conceptEmbeddings).values({
            takeawayId: takeaways.id,
            embedding: conceptEmbedding,
          });
        });
      }),
    );
  },
);
