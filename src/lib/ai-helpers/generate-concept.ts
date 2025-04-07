import { invariant } from "@tanstack/react-router";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod.mjs";
import { z } from "zod";

const client = new OpenAI();

const schema = z.object({
  concept: z.string({
    description: `Analyze this key takeaway and articulate its core generalized concept in 4-8 sentences.
    - The concept will be read before the takeaway. Do not repeat the takeaway or findings in it.
    - This concept should be an articulation of a high-level, general idea that can be applied to various contexts.
    - Use analogies and/or metaphors to ensure clarity of the concept.`,
  }),
});

const responseFormat = zodResponseFormat(schema, "response");

export async function getConcept(takeaway: string) {
  const completion = await client.beta.chat.completions.parse({
    model: "o3-mini",
    response_format: responseFormat,
    messages: [
      {
        role: "user",
        content: `

        Instructions
        - All Scores must be a integer, no decimals
        - The concept should articulate higher level ideas that can be applied to various contexts.
        - Be very concise but thorough. No fluff.
        - Dont be hyperbolic
        - Be imaginative about the high level implications of the takeaway when creating the concpts.
        - Do NOT start with "The primary concept of the article"... or other such fluff.

        Takeaway:
        ${takeaway}`,
      },
    ],
  });

  invariant(completion.choices[0]?.message.parsed, "No content");

  return completion.choices[0].message.parsed;
}
