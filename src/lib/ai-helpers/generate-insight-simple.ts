import { invariant } from "@tanstack/react-router";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod.mjs";
import { z } from "zod";

const client = new OpenAI();

interface Takeaway {
  id: string;
  source: string;
  title: string;
  publicationDate: string;
  takeaway: string;
  documentText: string;
}

const schema = z.object({
  insight: z.string({
    description: `The insight should be very detailed and complete. It should be a fully formed, stand alone thought. Use at least 10 sentences to articulate the insight.`,
  }),
});

const responseFormat = zodResponseFormat(schema, "response");

export async function getInsightSimple(
  takeaways: Takeaway[],
  customPrompt: string,
) {
  const completion = await client.beta.chat.completions.parse({
    model: "o3-mini",
    response_format: responseFormat,
    messages: [
      {
        role: "user",
        content: `
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
        - Think vry carfully about the context provided. Look for patterns and relationships between the takeaways.
        - The Insight should be novel and insightful
        - Be concise but thorough. No fluff.
        - Be imaginative about the high level implications of the insight.
        - Do NOT start with "The insight is"... or other such fluff.
        ${customPrompt}`,
      },
    ],
  });

  invariant(completion.choices[0]?.message.parsed, "No content");

  return completion.choices[0].message.parsed;
}
