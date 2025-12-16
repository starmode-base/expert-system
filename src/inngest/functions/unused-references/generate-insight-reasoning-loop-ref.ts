import { db, schema } from "~/postgres/db";
import { inngest } from "../../client";
import type {
  ResponseOutputMessage,
  ResponseInput,
} from "openai/resources/responses/responses";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import { insightTools } from "~/lib/ai-helpers/tools/tool-map";
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

export function toChatMessage(m: ResponseOutputMessage) {
  return {
    role: m.role,
    type: m.type,
    content: m.content
      .map((p) => (p.type === "output_text" ? p.text : ""))
      .join(""),
  };
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

    let stepNumber = 0;
    let generatedInsight: {
      insight: string;
      conversation: ResponseInput;
      hasMore: boolean;
    } = {
      insight: "",
      conversation: initialConversation,
      hasMore: true,
    };

    while (generatedInsight.hasMore) {
      generatedInsight = await step.run(
        `generate-insight-${event.data.insightId}-step-${stepNumber}`,
        async () => {
          // ######

          const model = event.data.model ?? "gpt-5.2";
          const conversation = generatedInsight.conversation;

          const response = await client.responses.create({
            model,
            reasoning: { effort: "high" },
            // reasoning: { effort: "high", summary: "auto" }, **** Organization must be verified to generate reasoning summaries
            tools: insightTools,
            tool_choice: "auto",
            input: conversation,
          });

          const outputItems = response.output;

          const reasoningItems = outputItems.filter(
            (item) => item.type === "reasoning",
          );
          const messageItems = outputItems.filter(
            (item) => item.type === "message",
          );
          const functionCalls = outputItems.filter(
            (item) => item.type === "function_call",
          );

          if (reasoningItems.length > 0) {
            conversation.push(...reasoningItems);
          }

          if (functionCalls.length > 0) {
            const { fullOutputContext } = await executeToolCalls(functionCalls);

            conversation.push(...fullOutputContext);
          }

          // Might not be necessary. If the model is using tools, I dont think it will return a message.
          if (messageItems.length > 0) {
            conversation.push(
              ...messageItems.map((item) => toChatMessage(item)),
            );
          }

          return {
            insight: response.output_text,
            conversation,
            hasMore: functionCalls.length > 0, // True if function calls are present
          };
        },
      );

      stepNumber = stepNumber + 1;
    }

    await step.run(`save-insight-${event.data.insightId}`, async () => {
      // ######
      await db
        .update(schema.insights)
        .set({ insight: generatedInsight.insight })
        .where(eq(schema.insights.id, event.data.insightId));
    });

    return generatedInsight;

    // < END FUNCTION >
  },
);
