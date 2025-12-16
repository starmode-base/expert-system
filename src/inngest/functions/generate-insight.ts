import { db, schema } from "~/postgres/db";
import { inngest } from "../client";
import type { ResponseInput } from "openai/resources/responses/responses";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import { insightTools } from "~/lib/ai-helpers/tools/tool-map";
import { executeToolCalls } from "~/lib/ai-helpers/tools/tool-handling";
import { invariant } from "@tanstack/react-router";
import { vectorTakeawaySearch } from "~/server/vector-queries";

const client = new OpenAI();

interface TakeawayReferenceForPrompt {
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

interface SimilarTakeawayForPrompt {
  id: string;
  title: string;
  publicationDate: string;
  source: string;
  summary: string;
}

function buildInsightPrompt(
  takeaway: TakeawayForPrompt,
  similarTakeaways: SimilarTakeawayForPrompt[],
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
    References: ${takeaway.references.map((reference) => `${reference.referenceNumber}. ${reference.reference}`).join("\n")}

## Similar Takeaway (summaries):
    ${similarTakeaways
      .map(
        (similarTakeaway) => `ID: ${similarTakeaway.id}
        Title: ${similarTakeaway.title}
        Publication Date: ${similarTakeaway.publicationDate}
        Source: ${similarTakeaway.source}
        Summary: ${similarTakeaway.summary}
        `,
      )
      .join("\n------\n")}



# Role
You are an Insight Analyst. Your job is to produce **one** high-quality, standalone business insight that is **new**, **specific**, and **actionable**, using the provided context plus optional targeted research.
# Objective
Generate exactly one clear, standalone insight based on the provided context and any additional information you independently gather using available tools.

The insight should feel like a sharp blog post written for an intelligent reader, not a report or summary.

# Reader Profile
Assume the reader is:
- In technology or adjacent industries
- Actively interested in markets, macro trends, business strategy, trading, and wealth creation
- Comfortable with nuance, but impatient with fluff

Write for someone who wants to understand *what matters* and *why it creates opportunity or risk*.

# Thinking & Research Guidelines
- Privately generate several candidate insights based on the initial context.
- Identify the strongest initial hypothesis and treat it as provisional, not final.
- Use tools (for example, fetching full takeaways or external data) to test, challenge, or deepen that hypothesis.
- Be deliberate in your tool use. Only fetch the specific information that you need to support your research.
- If newly fetched information suggests a more important, more surprising, or more defensible insight, abandon the original idea and pivot.
- Continue this process until additional information no longer meaningfully improves or changes the insight.
- Stop once a single insight clearly dominates in explanatory power and implications.
- Only retain evidence that directly supports the final insight; discard paths that did not survive iteration.
- The final output must reflect synthesis, causal reasoning, and judgment—not a catalogue of facts or sources.

# Output Requirements
- Produce ONE insight only.
- Minimum length: 10 sentences.
- The insight must be complete and stand on its own for a reader with general business knowledge.
- Do NOT summarize or restate the source takeaways; use them implicitly as evidence.
- Do NOT use industry jargon or technical language. If unavoidable, explain terms plainly.
- Avoid acronyms unless they are spelled out.
- Be direct, concrete, and opinionated where appropriate.
- No fluff, no hedging, no generic statements.

# Writing Style & Structure
- Do NOT label sections (e.g., no “Why this matters”, “What this changes”).
- The piece should naturally flow, like a well-written blog post.
- Begin immediately with the insight itself — no throat-clearing.
- After stating the insight, develop it through:
  - Clear reasoning
  - Evidence, data points, or short quotes where relevant
  - Cause-and-effect logic
  - High-level implications for decision-makers, markets, or money
- You may use light formatting (short paragraphs, bullets) if it improves clarity, but avoid rigid structure.
- Use bullets if it improves clarity.

# Framing Expectations
- The insight should be novel, non-obvious, and synthesizing multiple signals.
- It should explain not just *what is happening*, but *why now* and *what this unlocks or breaks*.
- Aim for something that would make a sharp reader pause and rethink their assumptions.

# Rules
- Do NOT start with phrases like “The insight is…”
- Do NOT include meta commentary about the process.
- Do NOT present multiple insights.
- Do NOT write a summary or list of takeaways.
- Use tools deliberately. Do NOT pull in information that does not serve you research in some way.
    ${customPrompt}`;
}

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

    const similarTakeaways = await step.run(
      `get-similar-takeaways-${event.data.insightId}`,
      async () => {
        const similarTakeaways = await vectorTakeawaySearch(
          takeaway.summary,
          10,
        );

        return similarTakeaways.map((similarTakeaway) => ({
          id: similarTakeaway.id,
          title: similarTakeaway.title,
          publicationDate:
            similarTakeaway.publicationDate.toLocaleDateString("en-US"),
          source: similarTakeaway.source,
          summary: similarTakeaway.summary,
        }));
      },
    );

    const initialConversation = [
      {
        role: "system",
        type: "message",
        content:
          "You are an expert researcher. Your job is to create meaningful insights from a set of summarized research takeaways.",
      },
      {
        role: "user",
        type: "message",
        content: buildInsightPrompt(
          takeaway,
          similarTakeaways,
          event.data.insightPrompt,
        ),
      },
    ] as ResponseInput;

    const model = event.data.model ?? "gpt-5.2";

    let insightResponse = await step.run(
      `first-insight-iteration`,
      async () => {
        const response = await client.responses.create({
          model,
          reasoning: { effort: "high" },
          // reasoning: { effort: "high", summary: "auto" }, **** Organization must be verified to generate reasoning summaries
          tools: insightTools,
          tool_choice: "auto",
          input: initialConversation,
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
          const response = await client.responses.create({
            model,
            reasoning: { effort: "high" },
            // reasoning: { effort: "high", summary: "auto" }, **** Organization must be verified to generate reasoning summaries
            tools: insightTools,
            tool_choice: "auto",
            previous_response_id: insightResponse.response.id,
            input: functionCallResponse.outputs,
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
      // ######
      await db
        .update(schema.insights)
        .set({ insight: insightResponse.response.output_text })
        .where(eq(schema.insights.id, event.data.insightId));
    });

    return insightResponse;

    // < END FUNCTION >
  },
);
