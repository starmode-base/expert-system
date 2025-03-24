import { invariant } from "@tanstack/react-router";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const client = new OpenAI();

/**
 * JSON schema for OpenAI structured output
 */
const schema = z.object({
  takeaway: z.string({
    description:
      "Explain the most novel and important insight from the article.",
  }),
  novelty: z.string({
    description: "Score the novelty of the article insight 0-10",
  }),
  importance: z.string({
    description: "Score the importance of the article insight 0-10",
  }),
  monetization: z.string({
    description: "Score the monetization potential of the article insight 0-10",
  }),
});
const responseFormat = zodResponseFormat(schema, "response");

export async function getTakeaways(articleText: string) {
  const completion = await client.beta.chat.completions.parse({
    model: "gpt-4o",
    response_format: responseFormat,
    messages: [
      {
        role: "user",
        content: `Describe the most novel and important insight from the article in 10-15 sentences.
        - Be very concise but thorough. No fluff.
        - Be factual and accurate.
        - Do not embelish or overdramatize.
        - Get to the core insight of the content.

        Article Text:
        ${articleText}`,
      },
    ],
  });

  invariant(completion.choices[0]?.message.parsed, "No content");

  return completion.choices[0].message.parsed;
}
