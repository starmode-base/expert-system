import { db, schema } from "~/postgres/db";
import { inngest } from "../client";
import type { ResponseInput } from "openai/resources/responses/responses";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { insightTools } from "~/lib/ai-helpers/tools/tool-map";
import { executeToolCalls } from "~/lib/ai-helpers/tools/tool-handling";
import { invariant } from "@tanstack/react-router";
import { z } from "zod";
import { TakeawaySearchResult } from "~/server/searchSFs";
import { fetchTakeawayPreviews } from "~/lib/ai-helpers/tools/tools";

const client = new OpenAI();

interface TakeawayReferenceForPrompt {
  id: string;
  referenceNumber: number;
  reference: string;
}

interface TakeawayForPrompt {
  id: string;
  source: string;
  title: string;
  summary: string;
  references: TakeawayReferenceForPrompt[];
  publicationDate: string;
  takeaway: string;
}

const systemPrompt = `# Role
You are an Insight Analyst. Your job is to produce **one** high-quality, standalone business insight that is **new**, **specific**, and **actionable**, using the provided context plus optional targeted research.
# Objective
Generate exactly one clear, standalone insight based on the provided context and any additional information you independently gather using available tools.

The insight should feel like a sharp blog post written for an intelligent reader, not a report or summary.

Write for someone who wants to understand *what matters* and *why it creates opportunity or risk*.

# Thinking & Research Guidelines
- Privately generate several candidate insights based on the initial context.
- Identify the strongest initial hypothesis and treat it as provisional, not final.
- Use tools (for example, fetching takeaway previews, fetching full takeaways or external data) to test, challenge, or deepen that hypothesis. Or searching for patterns in different domains or industries.
- Be deliberate in your tool use. Only fetch the specific information that you need to support your research.
- Use the complete takeaways and their references to support your research. NOT just the previews.
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

# Insight Output Requirements
- Produce ONE insight only.
- Minimum length: 15 sentences.
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
- Use tools deliberately. Do NOT pull in information that does not serve you research in some way.`;

const insightSchema = z.object({
  insight: z.string({
    description: `Final insight output text (Markdown format).

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
  Publication Date: ${new Date(takeaway.publicationDate).toLocaleDateString("en-US")}
  Source: ${takeaway.source}
  Key Takeaway:
  ${takeaway.summary}
  `,
    )
    .join("\n------\n");
}

function buildInsightPrompt(
  takeaway: TakeawayForPrompt,
  takeawayPreviewFormatted: string,
  customPrompt: string,
): string {
  return `
# Context:
## Takeaway:
    ${takeaway.title}
    Publication Date: ${takeaway.publicationDate}
    Source: ${takeaway.source}
    Key Takeaway:
    ${takeaway.takeaway},
    Takeaway ID: ${takeaway.id}
    Takeaway References: ${takeaway.references.map((reference) => `${reference.referenceNumber}. (reference_id: ${reference.id}) ${reference.reference}`).join("\n")}

## Similar Takeaway (summaries):
    ${takeawayPreviewFormatted}

## Reader Profile
Assume the reader is:
- In technology or adjacent industries
- Actively interested in markets, macro trends, business strategy, trading, and wealth creation
- Comfortable with nuance, but impatient with fluff

## User Prompt:
    ${customPrompt}`;
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

    const takeawayPreviewFormatted = await step.run(
      `get-similar-takeaways-${event.data.insightId}`,
      async () => {
        return await fetchTakeawayPreviews({
          query: takeaway.summary,
          timeWeighted: true,
          count: 10,
        });
      },
    );

    const initialConversation = [
      {
        role: "system",
        type: "message",
        content: systemPrompt,
      },
      {
        role: "user",
        type: "message",
        content: buildInsightPrompt(
          takeaway,
          takeawayPreviewFormatted,
          event.data.insightPrompt,
        ),
      },
    ] as ResponseInput;

    const model = "gpt-5.2";

    const agentParameters = {
      model,
      reasoning: { effort: "high" as const },
      // reasoning: { effort: "high", summary: "auto" }, **** Organization must be verified to generate reasoning summaries
      tools: insightTools,
      tool_choice: "auto" as const,
      parallel_tool_calls: false as const,
    };

    let insightResponse = await step.run(
      `first-insight-iteration`,
      async () => {
        const response = await client.responses.parse({
          input: initialConversation,
          ...agentParameters,
          text: {
            format: zodTextFormat(insightSchema, "insight"),
          },
        });

        return {
          response,
          hasFunctionCalls: response.output.some(
            (item) => item.type === "function_call",
          ),
          stepNumber: 0,
        };
      },
    );

    while (insightResponse.hasFunctionCalls) {
      insightResponse = await step.run(
        `generate-insight-${event.data.insightId}-step-${insightResponse.stepNumber}`,
        async () => {
          // ######

          const functionCalls = insightResponse.response.output.filter(
            (item) => item.type === "function_call",
          );

          const functionCallResponse = await executeToolCalls(functionCalls);

          console.log(
            "##### FUNCTION CALL RESPONSE #####",
            functionCallResponse.outputs,
          );

          const response = await client.responses.parse({
            ...agentParameters,
            previous_response_id: insightResponse.response.id,
            input: functionCallResponse.outputs,
            text: {
              format: zodTextFormat(insightSchema, "insight"),
            },
          });

          return {
            response,
            hasFunctionCalls: response.output.some(
              (item) => item.type === "function_call",
            ),
            stepNumber: insightResponse.stepNumber + 1,
          };
        },
      );
    }

    await step.run(`save-insight-${event.data.insightId}`, async () => {
      console.log(
        "##### INSIGHT RESPONSE PARSED #####",
        insightResponse.response.output_parsed,
      );
      // ######
      await db
        .update(schema.insights)
        .set({
          insight:
            insightResponse.response.output_parsed?.insight ??
            insightResponse.response.output_text,
        })
        .where(eq(schema.insights.id, event.data.insightId));
    });

    await step.run(
      `save-insight-references-${event.data.insightId}`,
      async () => {
        const references =
          insightResponse.response.output_parsed?.references ?? [];

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

    return insightResponse;

    // < END FUNCTION >
  },
);
