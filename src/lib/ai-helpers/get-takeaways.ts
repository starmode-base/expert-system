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
        description: `
        # Content Requirements:
        - Prioritize Novelty: Focus on the most interesting, new, or important insights. Ignore generic updates.
        - For each takeaway, you must capture three distinct dimensions:
            1. The Context: What is the situation, problem, or environment?
            2. The Mechanism: What specific action, strategy, or biological process caused the result? (Crucial: Be specific about *how* it works).
            3. The Outcome: What was the measurable result or insight?

        # Style & Formatting Constraints:
        - Standalone Thoughts: Each takeaway must be completely self-contained. The reader should require zero context from the original text or other takeaways to understand it.
        - Deep & Dense: Write 6-12 sentences per takeaway. Be very thorough but concise (no fluff). Every sentence must add value.
        - Factual Accuracy: Prioritize truths and facts over emotions or opinions. Do not embellish.
        - Neutral Tone: Strictly avoid promotional language (e.g., "groundbreaking," "revolutionary").
        - Direct Start: Do not start with "The takeaway is..." or "This article discusses...". Jump straight into the facts.
        - Independence: Each takeaway must be unique and unrelated to the others. Do not reference previous points.`,
      }),
    }),
  ),
});

const responseFormat = zodResponseFormat(schema, "response");

export async function getTakeaways(
  articleText: string,
  takeawayInstructions?: string,
  model = "gpt-5.1",
) {
  const completion = await client.beta.chat.completions.parse({
    model,
    response_format: responseFormat,
    messages: [
      {
        role: "user",
        content: `
        # Role
        You are a Lead Systems Analyst. Your job is to compress raw information into high-signal takeaways. You are processing a mix of Financial News, Earnings Transcripts, and Scientific Research.

        Text:
        ${articleText}

        Create a structured list of the 1-3 most novel and important takeaways from the text below.
        It is better to have less takeaways, if they are not unique and unrelated.`,
      },
    ],
  });

  invariant(completion.choices[0]?.message.parsed, "No content");

  const takeaways = completion.choices[0].message.parsed.takeaways;

  const takeawaysReturn = await Promise.all(
    takeaways.map(async (takeaway) => {
      const title = await getTakeawayTitle(takeaway.takeaway);
      return { ...takeaway, title };
    }),
  );

  return takeawaysReturn;
}

async function getTakeawayTitle(takeaway: string) {
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: `

  Text:
        ${takeaway}

Create a one line summary that distills the main takeaway of this excerpt.
  - return in title case
  - No other text.
  - dont use quotes or colons
  - Dont use hyperbolic language
`,
      },
    ],
  });

  invariant(completion.choices[0]?.message.content, "No content");
  return completion.choices[0].message.content;
}
