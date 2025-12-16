import { invariant } from "@tanstack/react-router";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const client = new OpenAI();

/**
 * JSON schema for OpenAI structured output
 */
const schema = z.object({
  summary: z.string({
    description:
      "A 1-2 sentence summary of the text. This will be used to determine if the takeaway is relevant to a research question. If it is then it will be retrieved for additional analysis.",
  }),
});
const responseFormat = zodResponseFormat(schema, "response");

export async function getSummary(text: string) {
  const completion = await client.beta.chat.completions.parse({
    model: "gpt-5-mini",
    response_format: responseFormat,
    messages: [
      {
        role: "user",
        content: `Provide a 1-2 sentence summary of the text.
        Text:
        ${text}`,
      },
    ],
  });

  invariant(completion.choices[0]?.message.parsed, "No content");

  return completion.choices[0].message.parsed;
}
