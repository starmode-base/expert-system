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
  concept: z.string({
    description: `Analyze the following article and extract its core abstract concept.
    Your output should distill the article's key insight into a high-level, general idea that can be applied to various contexts.
    Please illustrate this concept with one or more analogies or metaphors to ensure clarity and tranferability.`,
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
        - Do not embelish or overdramatize. Don't use promotional words like revolutionary, or groundbreaking.
        - Get to the core insight of the content.
        - Dont start with "The primary insight of the article"... or other such fluff.

        Article Text:
        ${articleText}`,
      },
    ],
  });

  invariant(completion.choices[0]?.message.parsed, "No content");

  return completion.choices[0].message.parsed;
}
