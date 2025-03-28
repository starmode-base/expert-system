import { invariant } from "@tanstack/react-router";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const client = new OpenAI();

/**
 * JSON schema for OpenAI structured output
 */
const schema = z.object({
  takeaways: z.array(
    z.object({
      takeaway: z.string({
        description:
          "Explain the most novel and important takeaway from the document in 10-15 sentences. Prioritize truths and facts over emotions and opinions.",
      }),
      concept: z.string({
        description: `Analyze the article's key takeaway and articulate its core generalized concept in 4-8 sentences.
      This should be an articulation of a high-level, general idea that can be applied to various contexts.
      You can use analogies or metaphors to ensure clarity and tranferability.`,
      }),
      novelty: z.string({
        description: "Score the novelty of the article takeaway 0-10",
      }),
      importance: z.string({
        description: "Score the importance of the article takeaway 0-10",
      }),
      monetization: z.string({
        description:
          "Score the monetization potential of the article takeaway 0-10",
      }),
    }),
  ),
});

const responseFormat = zodResponseFormat(schema, "response");

export async function getTakeaways(
  articleText: string,
  takeawayInstructions?: string,
  model = "gpt-4o",
) {
  const completion = await client.beta.chat.completions.parse({
    model,
    response_format: responseFormat,
    messages: [
      {
        role: "user",
        content: `
        Create a list of the 1-3 most novel and important takeaways from the text below.

        Instructions
        - Be very concise but thorough. No fluff.
        - Be factual and accurate.
        - Do not embelish or overdramatize. Don't use promotional words like revolutionary, or groundbreaking.
        - Dont start with "The primary takeaway of the article"... or other such fluff.

        Specific Instructions:
        ${takeawayInstructions?.trim() ?? ""}

        Text:
        ${articleText}`,
      },
    ],
  });

  invariant(completion.choices[0]?.message.parsed, "No content");

  return completion.choices[0].message.parsed.takeaways;
}
