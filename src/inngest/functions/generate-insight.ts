import { db, schema } from "~/postgres/db";
import { inngest } from "../client";
import type {
  ResponseFunctionToolCall,
  ResponseInput,
} from "openai/resources/responses/responses";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  researchAndCompletionTools,
  researchTools,
} from "~/lib/ai-helpers/tools/tool-map";
import { executeToolCalls } from "~/lib/ai-helpers/tools/tool-handling";
import { invariant } from "@tanstack/react-router";
import { z } from "zod";
import { TakeawaySearchResult } from "~/server/searchSFs";
import {
  vectorConceptSearchTimeWeighted,
  vectorTakeawaySearchTimeWeighted,
} from "~/server/vector-queries";

const client = new OpenAI();

const systemPrompt = `# Role
You are an Insight Analyst. Your job is to produce **one** high-quality, standalone business insight that is **new**, **specific**, and **actionable**, using the provided context plus optional targeted research.
# Objective
Generate exactly one clear, standalone insight based on the provided context and any additional information you independently gather using available tools.
The insight should feel like a sharp blog post written for an intelligent reader, not a report or summary.
Write for someone who wants to understand *what matters* and *why it creates opportunity or risk*.

Takeaways are key ideas from some source document (Public earnings calls, news articles, research reports, etc.).
You are provided initial context with recent summaries of similar takeaways and concepts.
If you need more information, use the tools to fetch the full takeaways.

# Thinking & Research Guidelines
- Use the takeaway summaries generate several candidate insights.
- Identify the strongest initial hypothesis and treat it as provisional, not final.
- Use tools (e.g. fetching full takeaways or external data) to gather additional information to test, challenge, or deepen that hypothesis. Or searching for patterns in different domains or industries.
- Be deliberate in your tool use. Only fetch the specific information that you need to support your research or exploration.
- Use the complete takeaways and their references to support your research. NOT just the summaries.
- If newly fetched information suggests a more important, more surprising, or more defensible insight, abandon the original idea and pivot.
- Search for patterns and relationships between the different takeaways and information you gather and include them in the insight.
    - Common patterns in different domains or industries lead to more compelling insights!
- Continue this process until additional information no longer meaningfully improves or changes the insight. You should iterate multiple times using different tools.
- Stop once a single insight clearly dominates in explanatory power and implications.
- Only retain evidence that directly supports the final insight; discard paths that did not survive iteration.
- The final output must reflect synthesis, causal reasoning, and judgment—not a catalogue of facts or sources.

# Framing Expectations
- The insight should be novel, non-obvious, and synthesizing multiple signals.
- It should explain not just *what is happening*, but *why now* and *what this unlocks or breaks*.
- Aim for something that would make a sharp reader pause and rethink their assumptions.
- The insight should be written for the reader profile described.
`;

const insightSchema = z.object({
  insight: z.string({
    description: `Final insight output text (Markdown format).

# Insight Output Requirements
- Produce ONE insight only.
- Length: 15-20 sentences or bullet points.
- The insight must be complete and stand on its own for a reader with general business knowledge.
- Do NOT summarize or restate the source takeaways; use them implicitly as evidence.
- Limit use of deep industry jargon or overly technical language. If unavoidable, explain terms plainly.
- Avoid acronyms unless they are spelled out.
- Be direct, concrete, and opinionated where appropriate.
- No fluff, no hedging, no generic statements.

# Writing Style & Structure
- Use Markdown formatting.
- Do NOT label sections (e.g., no “Why this matters”, “What this changes”).
- The piece should naturally flow, like a well-written blog post.
- Begin immediately with a clear and unequivocal insight in bold — no throat-clearing.
- After stating the insight, develop it through:
  - Clear reasoning
  - Evidence, data points, or short quotes where relevant
  - Cause-and-effect logic
  - High-level implications for decision-makers, markets, or money
- You may use light formatting (short paragraphs, bullets, bold text) if it improves clarity, but avoid rigid structure.
- Use bullets if it improves clarity.

# Rules
- Do NOT start with phrases like “The insight is…”
- Do NOT include meta commentary about the process.
- Do NOT present multiple insights.
- Do NOT write a summary or list of takeaways.

# Reference Citing Requirements:
- When making a reference to a fact, quote or data, cite you source from the Takeaway References.
- Issue a new reference number in the insight text e.g.  "(ref 1)". Starting at 1 and incrementing for each additional reference.
- Then record the newly issued insight_reference_number and reference_id (alphanumeric string e.g. p7LmQ4ZxN1tV8aCjR0uHkS9y) for each cited reference in the references array.

`,
  }),
  references: z.array(
    z.object({
      insight_reference_number: z.number({
        description: "The number of the reference cited in the insight.",
      }),
      reference_id: z.string({
        description:
          "The id (reference_id) of the reference from the Takeaway References. These will always be alphanumeric strings. e.g. p7LmQ4ZxN1tV8aCjR0uHkS9y",
      }),
    }),
  ),
});

// ------------------------------------------------------------
// Context Builders
// ------------------------------------------------------------
export function buildTakeawayPreviews(takeaways: TakeawaySearchResult[]) {
  return takeaways
    .map(
      (takeaway) => `
  ${takeaway.title}
  Takeaway ID: ${takeaway.id}
  Publication Date: ${new Date(takeaway.publicationDate).toLocaleDateString("en-US")}
  Source: ${takeaway.documentTitle} - ${takeaway.documentSource}
  Key Takeaway:
  ${takeaway.summary}
  `,
    )
    .join("\n------\n");
}

function buildInitialConversation(
  takeawayPreviewFormatted: string,
  takeawayConceptsPreviewFormatted: string,
  customPrompt: string,
): ResponseInput {
  return [
    {
      role: "system",
      type: "message",
      content: systemPrompt,
    },
    {
      role: "user",
      type: "message",
      content: `
# Context:
## Similar Takeaway (semantic similarity):
    ${takeawayPreviewFormatted}

## Similar Concept (concept similarity):
    ${takeawayConceptsPreviewFormatted}

## Reader Profile
Assume the reader is:
- In technology or adjacent industries
- Actively interested in markets, macro trends, business strategy, trading, and wealth creation
- Comfortable with nuance, but impatient with fluff

## User Prompt:
    ${customPrompt}`,
    },
  ] as ResponseInput;
}

// ------------------------------------------------------------
// FUNCTION
// ------------------------------------------------------------
export const generateInsight = inngest.createFunction(
  { id: "app/generate-insight" },
  { event: "app/generate-insight" },
  async ({ step, event }) => {
    console.log(`Generating insight for ${event.data.insightId}`);

    const takeaway = await step.run(
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
                    takeawayReferences: true,
                  },
                },
              },
            },
          },
        });

        invariant(insight, "No insights");
        invariant(insight.insightTakeaways[0]);

        return {
          id: insight.insightTakeaways[0].takeaway.id,
          title: insight.insightTakeaways[0].takeaway.title,
          takeaway: insight.insightTakeaways[0].takeaway.takeaway,
          summary: insight.insightTakeaways[0].takeaway.summary,
          concept: insight.insightTakeaways[0].takeaway.concept,
          references:
            insight.insightTakeaways[0].takeaway.takeawayReferences.map(
              (reference) => ({
                id: reference.id,
                referenceNumber: reference.referenceNumber,
                reference: reference.reference,
              }),
            ),
          source: insight.insightTakeaways[0].takeaway.document.source,
          publicationDate: new Date(
            insight.insightTakeaways[0].takeaway.document.publicationDate,
          ).toLocaleDateString("en-US"),
        };
        //   < END STEP>
      },
    );

    const { takeawayPreviewFormatted, takeawayConceptsPreviewFormatted } =
      await step.run(
        `get-similar-takeaways-and-concepts-${event.data.insightId}`,
        async () => {
          const similarTakeaways = await vectorTakeawaySearchTimeWeighted(
            takeaway.summary,
            10,
          );

          const similarConceptCandidates =
            await vectorConceptSearchTimeWeighted(takeaway.concept, 10);

          const takeawayIds = new Set(similarTakeaways.map((t) => t.id));
          const similarConcepts = similarConceptCandidates.filter(
            (concept) => !takeawayIds.has(concept.id),
          );

          return {
            takeawayPreviewFormatted: buildTakeawayPreviews(similarTakeaways),
            takeawayConceptsPreviewFormatted:
              buildTakeawayPreviews(similarConcepts),
          };
        },
      );

    const agentParameters = {
      model: "gpt-5.2",
      reasoning: { effort: "high" as const },
      parallel_tool_calls: true as const,
    };

    console.log("#### INITIAL CONVERSATION ####");
    console.log(
      buildInitialConversation(
        takeawayPreviewFormatted,
        takeawayConceptsPreviewFormatted,
        event.data.insightPrompt,
      ),
    );

    let insightResponse = await step.run(
      `first-insight-iteration`,
      async () => {
        const response = await client.responses.create({
          input: buildInitialConversation(
            takeawayPreviewFormatted,
            takeawayConceptsPreviewFormatted,
            event.data.insightPrompt,
          ),
          tool_choice: "required",
          tools: researchTools,
          ...agentParameters,
        });

        const functionCalls = response.output.filter(
          (item) => item.type === "function_call",
        );

        return {
          response,
          continue: true,
          functionCalls,
          stepNumber: 0,
        };
      },
    );

    while (insightResponse.continue) {
      // < STEP >
      // Execute tool calls
      const functionCallOutputs = await step.run(
        `execute-tool-call-step-${insightResponse.stepNumber}`,
        async () => {
          const { outputs } = await executeToolCalls(
            insightResponse.functionCalls,
          );

          return outputs;
        },
      );

      // < STEP >
      // Generate insight
      insightResponse = await step.run(
        `generate-insight-step-${insightResponse.stepNumber}`,
        async () => {
          // ######

          const response = await client.responses.create({
            ...agentParameters,
            previous_response_id: insightResponse.response.id,
            input: functionCallOutputs,
            tools: researchAndCompletionTools,
            tool_choice: "required",
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

      // Termination condition: if the last function call is "buildFinalInsight"
      if (
        insightResponse.functionCalls.some(
          (call) => call.name === "buildFinalInsight",
        )
      ) {
        console.log("### Break out of loop ###");
        insightResponse = {
          response: insightResponse.response,
          continue: false,
          functionCalls: insightResponse.functionCalls,
          stepNumber: insightResponse.stepNumber,
        };
      }
    }

    const finalInsight = await step.run(
      `build-final-insight-step-${insightResponse.stepNumber}`,
      async () => {
        console.log("### Building final insight ###");
        const { outputs } = await executeToolCalls(
          insightResponse.functionCalls,
        );

        console.log("### Final insight outputs ###", outputs);

        return await client.responses.parse({
          ...agentParameters,
          previous_response_id: insightResponse.response.id,
          input: outputs,
          text: {
            format: zodTextFormat(insightSchema, "insight"),
          },
        });
      },
    );

    await step.run(`save-insight-${event.data.insightId}`, async () => {
      console.log("##### INSIGHT RESPONSE PARSED #####");
      // ######
      await db
        .update(schema.insights)
        .set({
          insight:
            finalInsight.output_parsed?.insight ?? finalInsight.output_text,
        })
        .where(eq(schema.insights.id, event.data.insightId));
    });

    await step.run(
      `save-insight-references-${event.data.insightId}`,
      async () => {
        const references = finalInsight.output_parsed?.references ?? [];

        if (!references.length) return;

        const uniqueReferences = Array.from(
          new Map(
            references.map((reference) => [reference.reference_id, reference]),
          ).values(),
        );

        await db
          .delete(schema.insightReferences)
          .where(eq(schema.insightReferences.insightId, event.data.insightId));

        await db.insert(schema.insightReferences).values(
          uniqueReferences.map((reference) => ({
            insightId: event.data.insightId,
            referenceId: reference.reference_id,
            insightReferenceNumber: reference.insight_reference_number,
          })),
        );
      },
    );

    return finalInsight;

    // < END FUNCTION >
  },
);
