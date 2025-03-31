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
    - You can use analogies or metaphors to ensure clarity and tranferability.`,
  }),
  noveltyScore: z
    .number({
      description: `
Score the novelty of the article takeaway from 0–10.
- 0 = Completely unoriginal, widely known, or already covered extensively.
- 5 = Somewhat new, a different take on a known concept or a less common perspective.
- 10 = Groundbreaking, highly original, or introduces a novel concept, insight, or idea not widely seen before.
Focus on how fresh or surprising the core takeaway is, regardless of how important or useful it is.
    `,
    })
    .int(),

  importanceScore: z
    .number({
      description: `
Score the importance of the article takeaway from 0–10.
- 0 = Trivial, irrelevant, or has minimal consequences if ignored.
- 5 = Moderately useful or interesting, relevant to a niche or smaller audience.
- 10 = Critically important, with broad implications for society, economy, technology, or health.
This measures the **impact** of the takeaway, regardless of whether it’s new or monetizable.
    `,
    })
    .int(),

  monetizationScore: z
    .number({
      description: `
Score the monetization potential of the article takeaway from 0–10.
- 0 = No foreseeable way to turn this into a business or generate revenue.
- 5 = Some potential for indirect monetization, e.g., leads to content engagement or niche products.
- 10 = Strong potential for direct monetization (e.g., product ideas, services, SaaS tools, content with high commercial value).
This measures the **commercial potential** of the insight, idea, or trend mentioned in the takeaway.
    `,
    })
    .int(),
});

const responseFormat = zodResponseFormat(schema, "response");

export async function getConcept(takeaway: string) {
  const completion = await client.beta.chat.completions.parse({
    model: "gpt-4o",
    response_format: responseFormat,
    messages: [
      {
        role: "user",
        content: `

        Instructions
        - All Scores must be a integer, no decimals
        - The concept should articulate higher level ideas that can be applied to various contexts.
        - Be very concise but thorough. No fluff.
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
