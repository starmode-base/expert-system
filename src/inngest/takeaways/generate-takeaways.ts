import { db, schema } from "~/postgres/db";
import { invariant } from "@tanstack/react-router";
import { getTakeaways } from "~/inngest/takeaways/helpers/get-takeaways";
import { generateEmbedding } from "~/postgres/generate-embedding";
import { getCategory } from "~/inngest/takeaways/helpers/get-category";
import { eq } from "drizzle-orm";
import { publishNotifyUI } from "~/lib/ably";
import { NonRetriableError } from "inngest";
import { getSummary } from "~/inngest/takeaways/helpers/get-summary";
import { inngest } from "../client";

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
        event.data.user.id,
        `Takeaways already exist for document ${event.data.documentId}`,
      );
      return "Takeaways already exist";
    }

    /**
     * Step 1: Generate takeaways
     */
    const takeaways = await step
      .run(`generate-takeaways-${event.data.documentId}`, async () => {
        const document = await db.query.documents.findFirst({
          where: (documents, { eq }) => eq(documents.id, event.data.documentId),
          columns: { articleText: true, source: true, title: true },
          with: {
            images: {
              orderBy: (images, { asc }) => [asc(images.position)],
            },
          },
        });

        invariant(document?.articleText, "No article text");

        // ######
        console.log(
          `Generating takeaways for document ${event.data.documentId}`,
        );

        const sourceAttribution = [document.source, document.title]
          .filter(Boolean)
          .join(" — ");

        const takeaways = await getTakeaways(
          document.articleText,
          event.data.takeawayPrompt,
          event.data.model,
          sourceAttribution || undefined,
          document.images,
        );

        return takeaways;
      })
      .catch(async () => {
        await publishNotifyUI(
          event.data.user.id,
          "Error: There was an error generating takeaways.",
        );
        throw new NonRetriableError(`Error generating takeaways.`);
      });

    await step.run(
      "publish-invalidate",
      publishNotifyUI,
      event.data.user.id,
      `Generated takeaways: ${takeaways.map((t) => t.title).join(", ")} takeaways`,
    );

    /**
     * Step 2: Generate Summary
     */
    const takeawaysWithSummaries = await Promise.all(
      takeaways.map(async (takeaway) => {
        return await step.run(
          `generate-summary-${event.data.documentId}`,
          async () => {
            const summary = await getSummary(takeaway.takeaway);
            return {
              ...takeaway,
              summary: summary.summary,
              retrievalSummary: summary.retrieval_summary,
            };
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
        await step.run(
          `generate-save-takeaway-embedding-${takeawaysWrite.id}`,
          async () => {
            // ######
            console.log(
              `Generating takeaway embedding for ${takeawaysWrite.id}`,
            );

            const embedding = await generateEmbedding(
              takeawaysWrite.retrievalSummary ?? takeawaysWrite.summary,
            );

            return await db.insert(schema.takeawayEmbeddings).values({
              takeawayId: takeawaysWrite.id,
              embedding,
            });
          },
        );
      }),
    );
  },
);
