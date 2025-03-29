import { db, schema } from "~/postgres/db";
import { inngest } from "../client";
import { invariant } from "@tanstack/react-router";
import { getTakeaways } from "~/lib/ai-helpers/get-takeaways";
// import { getArticleTags } from "~/lib/ai-helpers/tag-article";
import { generateEmbedding } from "~/postgres/generate-embedding";
import { getCategory } from "~/lib/ai-helpers/get-category";
import { eq } from "drizzle-orm";

export const generateTakeaways = inngest.createFunction(
  { id: "app/generate-takeaways" },
  { event: "app/generate-takeaways" },
  async ({ step, event }) => {
    console.log(`Generating takeaways for ${event.data.documentId}`);

    if (!event.data.documentId) {
      return;
    }

    /**
     * Step 1: Generate takeaways
     */
    const takeaways = await step.run(
      `generate-takeaways-${event.data.documentId}`,
      async () => {
        const articleText = await db.query.documents.findFirst({
          where: (documents, { eq }) => eq(documents.id, event.data.documentId),
          columns: { articleText: true },
        });

        invariant(articleText?.articleText, "No article text");

        // ######
        console.log(
          `Generating takeaways for document ${event.data.documentId}`,
        );

        const takeaways = await getTakeaways(
          articleText.articleText,
          event.data.takeawayPrompt,
          event.data.model,
        );

        return takeaways;
      },
    );

    /**
     * Step 2: Categorize
     */
    const takeawaysInserts = await Promise.all(
      takeaways.map(async (takeaway) => {
        return await step.run(
          `get-category-${event.data.documentId}`,
          async () => {
            console.log(
              `Getting category for document ${event.data.documentId}`,
            );

            const category = await getCategory(takeaway.takeaway);

            return { ...takeaway, categoryId: category.categoryId };
          },
        );
      }),
    );

    /**
     * Step 3: Delete existing takeaways
     */
    await step.run(`delete-takeaways-${event.data.documentId}`, async () => {
      // Delete existing takeaways
      await db
        .delete(schema.takeaways)
        .where(eq(schema.takeaways.documentId, event.data.documentId));
    });

    /**
     * Step 3: Save takeaways
     */
    const takeawaysWrites = await Promise.all(
      takeawaysInserts.map(async (takeawaysInsert) => {
        return await step.run(
          `save-takeaways-${event.data.documentId}`,
          async () => {
            // ######
            console.log(
              `Saving takeaways for document ${event.data.documentId}`,
            );

            // Insert new takeaways
            const [result] = await db
              .insert(schema.takeaways)
              .values({
                documentId: event.data.documentId,
                ...takeawaysInsert,
              })
              .returning();
            invariant(result, "Failed to create takeaways");

            return result;
          },
        );
      }),
    );

    await Promise.all(
      takeawaysWrites.map(async (takeawaysWrite) => {
        await step.run(`save-embedding-${takeawaysWrite.id}`, async () => {
          // ######
          console.log(`Saving embedding for document ${takeawaysWrite.id}`);

          const takeawayEmbedding = await generateEmbedding(
            takeawaysWrite.takeaway,
          );

          await db
            .insert(schema.takeawayEmbeddings)
            .values({
              takeawayId: takeawaysWrite.id,
              embedding: takeawayEmbedding,
            })
            .onConflictDoUpdate({
              target: schema.takeawayEmbeddings.takeawayId,
              set: { embedding: takeawayEmbedding },
            });

          const conceptEmbedding = await generateEmbedding(
            takeawaysWrite.concept,
          );

          await db
            .insert(schema.conceptEmbeddings)
            .values({
              takeawayId: takeawaysWrite.id,
              embedding: conceptEmbedding,
            })
            .onConflictDoUpdate({
              target: schema.conceptEmbeddings.takeawayId,
              set: { embedding: conceptEmbedding },
            });
        });
      }),
    );
  },
);
