import { db, schema } from "~/postgres/db";
import { inngest } from "../client";
import { invariant } from "@tanstack/react-router";
import { getTakeaways } from "~/lib/ai-helpers/get-takeaways";
// import { getArticleTags } from "~/lib/ai-helpers/tag-article";
import { generateEmbedding } from "~/postgres/generate-embedding";
import { getCategory } from "~/lib/ai-helpers/get-category";
import { eq } from "drizzle-orm";
import { getConcept } from "../../lib/ai-helpers/generate-concept";
import { publishNotifyUI } from "~/lib/ably";
import { NonRetriableError } from "inngest";
import { getSummary } from "~/lib/ai-helpers/get-summary";

export const generateTakeaways = inngest.createFunction(
  { id: "app/generate-takeaways" },
  { event: "app/generate-takeaways" },
  async ({ step, event }) => {
    console.log(`Generating takeaways for ${event.data.documentId}`);

    if (!event.data.documentId) {
      return "No document ID";
    }

    // BLOCK REPEAT GENERATION
    const existingTakeaways = await step.run(
      "takeaway-already-exists",
      async () => {
        const takeaways = await db.query.takeaways.findMany({
          where: (takeaways, { eq }) =>
            eq(takeaways.documentId, event.data.documentId),
        });

        if (takeaways.length > 0) {
          return takeaways;
        }

        return [];
      },
    );

    // If takeaways already exist, early return
    if (existingTakeaways.length > 0) {
      await publishNotifyUI(
        event.user.id,
        `Takeaways already exist for document ${event.data.documentId}`,
      );
      return "Takeaways already exist";
    }

    /**
     * Step 1: Generate takeaways
     */
    const takeaways = await step
      .run(`generate-takeaways-${event.data.documentId}`, async () => {
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
      })
      .catch(async () => {
        await publishNotifyUI(
          event.user.id,
          "Error: There was an error generating takeaways.",
        );
        throw new NonRetriableError(`Error generating takeaways.`);
      });

    await step.run(
      "publish-invalidate",
      publishNotifyUI,
      event.user.id,
      `Generated takeaways: ${takeaways.map((t) => t.title).join(", ")} takeaways`,
    );

    /**
     * Step 3: Generate Concepts
     */
    const takeawaysWithConcepts = await Promise.all(
      takeaways.map(async (takeaway) => {
        return await step.run(
          `generate-concepts-${event.data.documentId}`,
          async () => {
            const concept = await getConcept(takeaway.takeaway);

            return {
              ...takeaway,
              concept: concept.concept,
            };
          },
        );
      }),
    );

    /**
     * Step 2: Generate Summary
     */
    const takeawaysWithSummaries = await Promise.all(
      takeawaysWithConcepts.map(async (takeawayWithConcept) => {
        return await step.run(
          `generate-summary-${event.data.documentId}`,
          async () => {
            const summary = await getSummary(takeawayWithConcept.takeaway);
            return { ...takeawayWithConcept, summary: summary.summary };
          },
        );
      }),
    );

    /**
     * Step 3: Categorize
     */
    const takeawaysInserts = await Promise.all(
      takeawaysWithSummaries.map(async (takeaway) => {
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

            return await db.transaction(async (tx) => {
              // Insert new takeaways
              const [result] = await tx
                .insert(schema.takeaways)
                .values({
                  documentId: event.data.documentId,
                  ...takeawaysInsert,
                })
                .returning();
              invariant(result, "Failed to create takeaways");

              //Insert references
              await tx.insert(schema.takeawayReferences).values(
                takeawaysInsert.references.map((reference) => ({
                  takeawayId: result.id,
                  referenceNumber: reference.number,
                  reference: reference.reference,
                })),
              );

              return result;
            });
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
            takeawaysWrite.summary,
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
