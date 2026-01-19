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
      "A 1 sentence summary of the text. This will be used to determine if the takeaway is relevant to a research question. If it is then it will be retrieved for additional analysis.",
    ),
});
const responseFormat = zodTextFormat(schema, "response");

export async function getSummary(text: string) {
  const response = await client.responses.parse({
    model: "gpt-5-mini",
    input: [
      {
        role: "user",
        content: `Provide a 1-2 sentence summary of the text.
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
