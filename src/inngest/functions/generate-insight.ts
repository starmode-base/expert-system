import { db, schema } from "~/postgres/db";
import { inngest } from "../client";
import type {
  ResponseFunctionToolCall,
  ResponseInput,
  Response,
} from "openai/resources/responses/responses";
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
import { publishNotifyUI } from "~/lib/ably";

const client = new OpenAI();

const agentParameters = {
  model: "gpt-5.2",
  reasoning: { effort: "high" as const },
  parallel_tool_calls: true as const,
};

interface InsightLoopState {
  response: Response;
  continue: boolean;
  functionCalls: ResponseFunctionToolCall[];
  stepNumber: number;
}

const systemPrompt = `# Role
You are an Business and Technology Analyst and Blogger. Your job is to produce **one** high-quality, standalone business insight that is **new**, **specific**, and **actionable**, using the provided context plus optional targeted research.
# Objective
Generate exactly one clear, standalone insight based on the provided context and any additional information you independently gather using available tools.
The insight should feel like a interesting and entertaining blog post written for an intelligent reader, not a report or summary.
Write for someone who wants to understand *what matters* and *why it creates opportunity or risk*.

Takeaways are key ideas from some source document (Public earnings calls, news articles, research reports, etc.).
You are provided initial context including:
-- summaries of recent insights that have been generated for the user
-- summaries of takeaways from recent published research, articles, blogs or public earnings calls
To read more about the takeaways, use the tools to fetch the full takeaways.
Generate an insight in on a different topic than the listed recent insights.

# Thinking & Research Guidelines
- Use the takeaway summaries generate several candidate insights.
- Identify the strongest initial hypothesis and treat it as provisional, not final.
- Use tools (e.g. fetching full takeaways or external data) to gather additional information to test, challenge, or deepen that hypothesis. Or searching for patterns in different domains or industries.
- Be deliberate in your tool use. Only fetch the specific information that you need to support your research or exploration.
- Use the complete takeaways and their references to support your research. NOT just the summaries.
- If newly fetched information suggests a more important, more surprising, or more defensible insight, abandon the original idea and pivot.
- Search for patterns and relationships between the different takeaways and information you gather and include them in the insight.
- Use at least 2 distinct sources to support the insight.
- Continue this process until additional information no longer meaningfully improves or changes the insight. You should iterate multiple times using different tools.
- Stop once a single insight clearly dominates in explanatory power and implications.
- Only retain evidence that directly supports the final insight; discard paths that did not survive iteration.
- The final output must reflect synthesis, causal reasoning, and judgment - not a catalogue of facts or sources.

# Framing Expectations
- The insight should be novel, non-obvious, and synthesizing multiple signals.
- It should explain not just *what is happening*, but *why now* and *what this unlocks or breaks*.
- Aim for something that would make a sharp reader pause and rethink their assumptions.
- Include patterns and analogies from different domains and industries to support the insight where relevant. But be sure not to reach to far.
- The insight should be written for the reader profile described.
`;

const insightSchema = z.object({
  insight: z.string({
    description: `Final insight output text (Markdown format).

# Objective
Produce ONE compelling, standalone insight that teaches the reader something non-obvious about the world. The primary goal is **clarity, explanation, and engagement**. Facts and references exist to *support* the insight, not to drive or dominate it.

# Insight Output Requirements
- Produce ONE insight only.
- Length: 10-15 sentences or bullet points.
- The insight must fully stand on its own for a reader with general business knowledge.
- Explain the idea clearly and intuitively, as if you are teaching a smart reader something new.
- Be concrete and opinionated where appropriate.
- Write to be read, not indexed: prioritize narrative flow and understanding over completeness.
- Avoid deep industry jargon. If unavoidable, explain it plainly in the moment.
- Avoid acronyms unless they are spelled out on first use.
- No fluff, no hedging, no generic statements.

# Core Priority (Very Important)
- The insight should be driven by **reasoning, analogy, and cause-and-effect**, not by listing facts.
- References are **supporting evidence only**. Use them sparingly and only when they materially strengthen credibility or anchor a key claim.
- Do NOT force citations. If a sentence is explanatory or conceptual, it does not need a reference.

# Rules
- Do NOT start with phrases like “The insight is…”
- Do NOT include meta commentary about the process.
- Do NOT present multiple insights.
- Do NOT summarize or restate source takeaways.
- Do NOT include titles, headers, or labeled sections.
- Do NOT do NOT include em dashes (—) anywhere in the insight.

# Opening Requirement
- Begin immediately with a **bolded core insight statement** on its own line.
- This statement should:
  - Use different phrasing than previous recent insights.
  - Be clear and decisive
  - Be easy to understand
  - Be slightly provocative or memorable
  - Be strong enough to pull the reader forward
  - Include a recognizable name (business, person, event, etc.)
  - Hint at the actionable takeaway from the insight.

# Development Guidance
After the opening insight:
- Unpack *why* it is true using clear logic and intuitive examples.
- Show how different forces interact (cause → effect → consequence).
- Use short, well-placed facts or quotes only where they sharpen the point.
- Focus on implications for how people think, decide, or allocate money.
- End with some practical advice or action item for the reader.
- Prefer explanation over evidence density.

# Reference Citing Requirements:
- When making a reference to a fact, quote or data, cite you source from the Takeaway References.
- Issue a new reference number in the insight text e.g.  "(ref 1)". Starting at 1 and incrementing for each additional reference.
- Then record the newly issued insight_reference_number and reference_id (alphanumeric string e.g. p7LmQ4ZxN1tV8aCjR0uHkS9y) for each cited reference in the references array.


# Writing Style
- Markdown format.
- Natural flow, like a strong blog post.
- Clear, human, slightly entertaining.
- Write like Morgan Housel: simple language, sharp ideas, calm confidence.`,
  }),
  title: z.string({
    description:
      "The title of the insight. Include a nod to the domain. Should be short, several words to capture the essence of the insight. Return text, not markdown.",
  }),
  core_insight_statement: z.string({
    description:
      "The core insight statement. This should be the same as the core insight statement (at beginning of insight text) in the insight text. Return text, not markdown.",
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
  const dateFormatter = new Intl.DateTimeFormat("en-US");

  return takeaways
    .map(
      (takeaway) => `
  ${takeaway.title}
  Takeaway ID: ${takeaway.id}
  Publication Date: ${dateFormatter.format(new Date(takeaway.publicationDate))}
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
  recentInsights: string,
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
## Takeaways:
    ${takeawayConceptsPreviewFormatted}
    ${takeawayPreviewFormatted}

## Recent Insights:
    ${recentInsights}

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

async function executeToolCallsForResponse(
  functionCalls: ResponseFunctionToolCall[],
) {
  const { outputs } = await executeToolCalls(functionCalls);
  return outputs;
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
        10,
      );

      const similarConceptCandidates = await vectorConceptSearchTimeWeighted(
        event.data.seedText,
        10,
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

      if (!references.length) return;

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

        await tx.insert(schema.insightReferences).values(
          uniqueReferences.map((reference) => ({
            insightId: result.id,
            referenceId: reference.reference_id,
            insightReferenceNumber: reference.insight_reference_number,
          })),
        );

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
      `Insight generated for id ${insightId ?? "unknown"}`,
    );

    return finalInsight;
  },
);
