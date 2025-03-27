import { db, schema } from "~/postgres/db";
import { inngest } from "../client";
import { invariant } from "@tanstack/react-router";
import { getTakeaways } from "~/lib/ai-helpers/get-takeaways";
// import { getArticleTags } from "~/lib/ai-helpers/tag-article";
import { generateEmbedding } from "~/postgres/generate-embedding";
import { getCategory } from "~/lib/ai-helpers/get-category";

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

        return await getTakeaways(articleText.articleText);
      },
    );

    /**
     * Step 2: Categorize
     */
    const category = await step.run(
      `get-category-${event.data.documentId}`,
      async () => {
        console.log(`Getting category for document ${event.data.documentId}`);

        return await getCategory(takeaways.takeaway); // TODO
      },
    );
    // const tags = await getArticleTags(takeaways.takeaway);

    /**
     * Step 3: Save takeaways
     */
    const takeawayId = await step.run(
      `save-takeaways-${event.data.documentId}`,
      async () => {
        // ######
        console.log(`Saving takeaways for document ${event.data.documentId}`);
        const takeawaysInsert = {
          ...takeaways,
          categoryId: category.categoryId,
        };
        const [result] = await db
          .insert(schema.takeaways)
          .values({
            documentId: event.data.documentId,
            ...takeawaysInsert,
          })
          // Allows generalization for new takeaways and updating existing takeaways
          .onConflictDoUpdate({
            target: schema.takeaways.documentId,
            set: takeawaysInsert,
          })
          .returning({ id: schema.takeaways.id });
        invariant(result, "Failed to create takeaways");

        return result;
      },
    );

    await step.run("save-embedding-${documentId}", async () => {
      // ######
      console.log(`Saving embedding for document ${event.data.documentId}`);

      const takeawayEmbedding = await generateEmbedding(takeaways.takeaway);

      await db
        .insert(schema.takeawayEmbeddings)
        .values({
          takeawayId: takeawayId.id,
          embedding: takeawayEmbedding,
        })
        .onConflictDoUpdate({
          target: schema.takeawayEmbeddings.takeawayId,
          set: { embedding: takeawayEmbedding },
        });

      const conceptEmbedding = await generateEmbedding(takeaways.concept);

      await db
        .insert(schema.conceptEmbeddings)
        .values({
          takeawayId: takeawayId.id,
          embedding: conceptEmbedding,
        })
        .onConflictDoUpdate({
          target: schema.conceptEmbeddings.takeawayId,
          set: { embedding: conceptEmbedding },
        });
    });
  },
);
