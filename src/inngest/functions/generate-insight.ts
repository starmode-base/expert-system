import { db, schema } from "~/postgres/db";
import { inngest } from "../client";
import { invariant } from "@tanstack/react-router";
import { getInsightSimple } from "~/lib/ai-helpers/generate-insight-simple";
import { eq } from "drizzle-orm";

export const generateInsight = inngest.createFunction(
  { id: "app/generate-insight" },
  { event: "app/generate-insight" },
  async ({ step, event }) => {
    console.log(`Generating insight for ${event.data.insightId}`);

    const takeaways = await step.run(
      `get-takeaways-${event.data.insightId}`,
      async () => {
        // ######
        const insight = await db.query.insights.findFirst({
          where: (insights, { eq }) => eq(insights.id, event.data.insightId),
          with: {
            insightTakeaways: {
              with: {
                takeaway: {
                  with: {
                    document: true,
                  },
                },
              },
            },
          },
        });

        invariant(insight, "No insights");

        return insight.insightTakeaways.map((insightTakeaway) => ({
          id: insightTakeaway.takeaway.id,
          title: insightTakeaway.takeaway.title,
          takeaway: insightTakeaway.takeaway.takeaway,
          source: insightTakeaway.takeaway.document.source,
          publicationDate: new Date(
            insightTakeaway.takeaway.document.publicationDate,
          ).toLocaleDateString("en-US"),
          documentText: insightTakeaway.takeaway.document.articleText,
        }));
        //   < END STEP>
      },
    );

    const generatedInsight = await step.run(
      `generate-insight-${event.data.insightId}`,
      async () => {
        // ######
        return getInsightSimple(takeaways, event.data.insightPrompt ?? "");
      },
    );

    await step.run(`save-insight-${event.data.insightId}`, async () => {
      // ######
      await db
        .update(schema.insights)
        .set({ insight: generatedInsight })
        .where(eq(schema.insights.id, event.data.insightId));
    });

    return generatedInsight;

    // < END FUNCTION >
  },
);
