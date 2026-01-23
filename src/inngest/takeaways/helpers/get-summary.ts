import { invariant } from "@tanstack/react-router";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const client = new OpenAI();

/**
 * JSON schema for OpenAI structured output
 */
const schema = z.object({
  summary: z
    .string()
    .describe(
      "A 1 sentence human readable summary of the text. This will be used to display the takeaway to the user.",
    ),
  retrieval_summary: z
    .string()
    .describe(
      "Produce a dense,  words, query-shaped summary that maximizes future semantic (embedding search) matchability. This will be used to retrieve the takeaway for additional analysis.",
    ),
});
const responseFormat = zodTextFormat(schema, "response");

export async function getSummary(text: string) {
  const response = await client.responses.parse({
    model: "gpt-5-mini",
    input: [
      {
        role: "user",
        content: `You are a helpful assistant that summarizes text. Summarize the text into two summaries: 1) for display to the user and 2) for semantic retrieval.

        Text:
        ${text}`,
      },
    ],
    text: { format: responseFormat },
  });

  const parsed = response.output_parsed;
  invariant(parsed, "No content");

  return parsed;
}
