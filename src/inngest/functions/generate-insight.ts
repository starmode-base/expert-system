import { db, schema } from "~/postgres/db";
import { inngest } from "../client";
import type { ResponseInput } from "openai/resources/responses/responses";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import { insightTools } from "~/lib/ai-helpers/tools/tools";
import { executeToolCalls } from "~/lib/ai-helpers/tools/tool-handling";
import { invariant } from "@tanstack/react-router";

const client = new OpenAI();

interface Takeaway {
  id: string;
  source: string;
  title: string;
  publicationDate: string;
  takeaway: string;
  documentText: string;
}

function buildInsightPrompt(
  takeaways: Takeaway[],
  customPrompt: string,
): string {
  return `
Context:
        ${takeaways
          .map(
            (takeaway) => `${takeaway.title}
Publication Date: ${takeaway.publicationDate}
Source: ${takeaway.source}
Key Takeaway:
          ${takeaway.takeaway}`,
          )
          .join("\n------\n")}

Instructions
    - The insight should be very detailed and complete. It should be a fully formed, stand alone thought. Use at least 10 sentences to articulate the insight.
    - Think very carfully about the context provided. Look for patterns and relationships between the takeaways.
    - The Insight should be novel and insightful
    - Do not use industry jargon or technical terms. Spell out acronyms and abbreviations. This insight should be approachable to most smart people.
    - Be concise but thorough. No fluff.
    - Be imaginative about the high level implications of the insight.
    - In your response do not summarize the takeaways. Use them as a foundation to build your insight.
    - Do NOT start with "The insight is"... or other such fluff.
    - Write the insight in a compelling way that is easy to read. Use bullet points and other formatting to make it easy to read.
    - Start with the insight, then provide well reasoned supporting arguments with evidence, quotes and data.
    - This insight should be able to stand completely alone with a basic understanding on business. Provide the necessary context and background for the insight.
    ${customPrompt}`;
}

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
        content: buildInsightPrompt(takeaways, event.data.insightPrompt),
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
