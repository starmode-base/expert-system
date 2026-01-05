import { db, schema } from "~/postgres/db";
import { inngest } from "../client";
import type {
  ResponseFunctionToolCall,
  Response,
} from "openai/resources/responses/responses";

import { invariant } from "@tanstack/react-router";

import {
  vectorConceptSearchTimeWeighted,
  vectorTakeawaySearchTimeWeighted,
} from "~/server/vector-queries";
import { publishNotifyUI } from "~/lib/ably";
import { buildTakeawayPreviews } from "./insight-prompts";
import { getConcept } from "../takeaways/helpers/generate-concept";
import { runInsightAgent } from "./agents/insight-agent";

export interface InsightLoopState {
  response: Response;
  continue: boolean;
  functionCalls: ResponseFunctionToolCall[];
  stepNumber: number;
}

// ------------------------------------------------------------
// FUNCTION
// ------------------------------------------------------------
export const generateInsight = inngest.createFunction(
  { id: "app/generate-insight" },
  { event: "app/generate-insight" },
  async ({ step, event }) => {
    console.log(`Generating insight for ${event.data.seedText}`);

    // Step 1: Load the seed takeaway (the one we are writing an insight about)

    // get recent insights to feed into the prompt
    const recentInsights = await step.run(`get-recent-insights`, async () => {
      const insights = await db.query.insights.findMany({
        where: (insights, { and, eq }) =>
          and(eq(insights.userId, event.user.id)),
        orderBy: (insights, { desc }) => [desc(insights.createdAt)],
        limit: 15,
      });

      return insights
        .map(
          (insight) => `
        - ${insight.summary ?? insight.title}
        `,
        )
        .join("\n");
    });

    // Step 2: Gather context (similar takeaways and concept-neighbors) to ground the agent’s first pass
    const {
      takeawayPreviewFormatted,
      takeawayConceptsPreviewFormatted,
      takeawayAndConceptIds,
    } = await step.run(`get-similar-takeaways-and-concepts`, async () => {
      const similarTakeaways = await vectorTakeawaySearchTimeWeighted(
        event.data.seedText,
        {
          limit: 10,
          halfLifeDays: 90, // 3 months relevance half life
        },
      );

      const seedConcept = await getConcept(event.data.seedText);
      const similarConceptCandidates = await vectorConceptSearchTimeWeighted(
        seedConcept.concept,
        {
          limit: 10,
          halfLifeDays: 90, // 3 months relevance half life
        },
      );

      const takeawayIds = new Set(similarTakeaways.map((t) => t.id));
      const similarConcepts = similarConceptCandidates.filter(
        (concept) => !takeawayIds.has(concept.id),
      );

      const takeawayAndConceptIds = [
        ...Array.from(takeawayIds).map((id) => {
          return { id, type: "takeaway" };
        }),
        ...similarConcepts.map((c) => {
          return { id: c.id, type: "concept" };
        }),
      ];

      return {
        takeawayPreviewFormatted: buildTakeawayPreviews(similarTakeaways),
        takeawayConceptsPreviewFormatted:
          buildTakeawayPreviews(similarConcepts),
        takeawayAndConceptIds,
      };
    });

    const finalInsight = await step.run(`run-insight-agent`, async () => {
      return await runInsightAgent({
        takeawayPreviewFormatted,
        takeawayConceptsPreviewFormatted,
        recentInsights,
        insightPrompt: event.data.insightPrompt,
      });
    });

    // Step 6: Save the final insight text
    const insightId = await step.run(`save-insight`, async () => {
      console.log("##### INSIGHT RESPONSE PARSED #####");

      const references = finalInsight.references;

      const uniqueReferences = Array.from(
        new Map(
          references.map((reference) => [reference.reference_id, reference]),
        ).values(),
      );

      const insightId = await db.transaction(async (tx) => {
        const [result] = await tx
          .insert(schema.insights)
          .values({
            userId: event.user.id,
            title: finalInsight.title,
            insight: finalInsight.insight,
            summary: finalInsight.core_insight_statement,
            seedText: event.data.seedText,
            insightPrompt: event.data.insightPrompt,
          })
          .returning();
        invariant(result, "Failed to create insight");

        await tx.insert(schema.insightTakeaways).values(
          takeawayAndConceptIds.map(({ id, type }) => ({
            insightId: result.id,
            takeawayId: id,
            type: type as "takeaway" | "concept",
          })),
        );

        if (uniqueReferences.length > 0) {
          await tx.insert(schema.insightReferences).values(
            uniqueReferences.map((reference) => ({
              insightId: result.id,
              referenceId: reference.reference_id,
              insightReferenceNumber: reference.insight_reference_number,
            })),
          );
        }

        return result.id;
      });

      invariant(insightId, "Failed to create insight");

      return insightId;
    });

    // Step 8: Notify the UI that the insight has been generated
    await step.run(
      `notify-ui`,
      publishNotifyUI,
      event.user.id,
      `Insight generated for id: ${insightId}`,
    );

    return finalInsight;
  },
);
