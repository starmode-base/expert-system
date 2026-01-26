import { db, schema } from "~/postgres/db";
import { inngest } from "../client";
import type {
  ResponseFunctionToolCall,
  Response,
} from "openai/resources/responses/responses";

import { invariant } from "@tanstack/react-router";
import { publishNotifyUI } from "~/lib/ably";
import { runInsightAgent } from "./agents/insight-agent";
import { getInsightSummary } from "./helpers/get-insight-summary";
import { createResearcherAgent } from "./agents/researcher";
import { run } from "@openai/agents";

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
    // Step 1: Load the seed takeaway (the one we are writing an insight about)

    // get recent insights to feed into the prompt
    const recentInsights = await step.run(`get-recent-insights`, async () => {
      const insights = await db.query.insights.findMany({
        where: (insights, { and, eq }) =>
          and(eq(insights.userId, event.data.user.id)),
        orderBy: (insights, { desc }) => [desc(insights.createdAt)],
        limit: 15,
      });

      return insights
        .map((insight) => `- ${insight.summary ?? insight.title}`)
        .join("\n");
    });

    // Step 2: Gather context (similar takeaways and concept-neighbors) to ground the agent’s first pass
    const { takeawayPreviewFormatted } = await step.run(
      `get-similar-takeaways-and-concepts`,
      async () => {
        const researcher = createResearcherAgent();

        const output = await run(
          researcher,
          `## Research Objective
        ${event.data.insightPrompt}

        return 20 takeaways`,
        );

        invariant(output.finalOutput, "No final output");

        return {
          takeawayPreviewFormatted: output.finalOutput,
        };
      },
    );

    const finalInsight = await step.run(`run-insight-agent`, async () => {
      return await runInsightAgent({
        takeawayPreviewFormatted,
        recentInsights,
        insightPrompt: event.data.insightPrompt,
      });
    });

    // Summarize the final insight
    const summarizedInsight = await step.run(`summarize-insight`, async () => {
      return await getInsightSummary(finalInsight.insight);
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
            userId: event.data.user.id,
            title: summarizedInsight.title,
            insight: summarizedInsight.post,
            research: finalInsight.insight,
            summary: summarizedInsight.core_insight_statement,
            insightPrompt: event.data.insightPrompt,
          })
          .returning();
        invariant(result, "Failed to create insight");

        // TODO: fine a solution to store the takeaways and concepts used in the insight

        // await tx.insert(schema.insightTakeaways).values(
        //   takeawayAndConceptIds.map(({ id, type }) => ({
        //     insightId: result.id,
        //     takeawayId: id,
        //     type: type as "takeaway" | "concept",
        //   })),
        // );

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
      event.data.user.id,
      `Insight generated for id: ${insightId}`,
    );

    return {
      ...finalInsight,
      title: summarizedInsight.title,
      core_insight_statement: summarizedInsight.core_insight_statement,
      insight: summarizedInsight.post,
    };
  },
);
