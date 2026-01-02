import { db, schema } from "~/postgres/db";
import { inngest } from "../client";
import type {
  ResponseFunctionToolCall,
  Response,
} from "openai/resources/responses/responses";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  researchAndCompletionTools,
  researchTools,
} from "~/inngest/insights/tools/tool-map";
import { invariant } from "@tanstack/react-router";

import {
  vectorConceptSearchTimeWeighted,
  vectorTakeawaySearchTimeWeighted,
} from "~/server/vector-queries";
import { publishNotifyUI } from "~/lib/ably";
import {
  agentParameters,
  buildInitialConversation,
  buildTakeawayPreviews,
  executeToolCallsForResponse,
  insightSchema,
} from "./insight-prompts";
import { getConcept } from "../takeaways/helpers/generate-concept";

const client = new OpenAI();

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

    // Step 3: Kick off the agent with a required tool call so it can decide what it needs next
    const initialConversation = buildInitialConversation(
      takeawayPreviewFormatted,
      takeawayConceptsPreviewFormatted,
      recentInsights,
      event.data.insightPrompt,
    );

    let insightResponse: InsightLoopState = await step.run(
      `first-insight-iteration`,
      async () => {
        const response = await client.responses.create({
          input: initialConversation,
          tool_choice: "required",
          tools: researchTools,
          stream: false,
          ...agentParameters,
        });

        const functionCalls = response.output.filter(
          (item): item is ResponseFunctionToolCall =>
            item.type === "function_call",
        );

        return {
          response,
          continue: true,
          functionCalls,
          stepNumber: 0,
        };
      },
    );

    // Step 4: Tool loop
    // Execute requested tools, feed results back into the model, and repeat until it asks to finalize
    while (insightResponse.continue && insightResponse.stepNumber < 10) {
      // Step 4a: Execute the model’s tool calls
      const functionCallOutputs = await step.run(
        `execute-tool-call-step-${insightResponse.stepNumber}`,
        async () => {
          return await executeToolCallsForResponse(
            insightResponse.functionCalls,
          );
        },
      );

      // Step 4b: Ask the model what to do next (more tools or finalize)
      insightResponse = await step.run(
        `generate-insight-step-${insightResponse.stepNumber}`,
        async () => {
          const response = await client.responses.create({
            ...agentParameters,
            previous_response_id: insightResponse.response.id,
            input: functionCallOutputs,
            tools: researchAndCompletionTools,
            tool_choice: "required",
            stream: false,
          });

          const functionCalls = response.output.filter(
            (item): item is ResponseFunctionToolCall =>
              item.type === "function_call",
          );

          return {
            response,
            continue: true,
            functionCalls,
            stepNumber: insightResponse.stepNumber + 1,
          };
        },
      );

      // Step 4c: Terminate the loop once it requests the final output
      if (
        insightResponse.functionCalls.some(
          (call) => call.name === "buildFinalInsight",
        )
      ) {
        insightResponse = {
          response: insightResponse.response,
          continue: false,
          functionCalls: insightResponse.functionCalls,
          stepNumber: insightResponse.stepNumber,
        };
      }
    }

    // Step 5: Run the final tool call(s) then parse the final structured output
    const finalInsight = await step.run(
      `build-final-insight-step-${insightResponse.stepNumber}`,
      async () => {
        const outputs = await executeToolCallsForResponse(
          insightResponse.functionCalls,
        );

        const r = await client.responses.parse({
          ...agentParameters,
          previous_response_id: insightResponse.response.id,
          input: outputs,
          text: {
            format: zodTextFormat(insightSchema, "insight"),
          },
        });

        invariant(r.output_parsed, "No output parsed");

        return r.output_parsed;
      },
    );

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
