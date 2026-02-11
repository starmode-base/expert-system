import { invariant } from "@tanstack/react-router";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const client = new OpenAI();

/**
 * JSON schema for OpenAI structured output
 */
const schema = z.object({
  takeaways: z.array(
    z.object({
      takeaway: z.string().describe(`
        # Content Requirements:
        - Prioritize Novelty: Focus on the most interesting, new, or important insights. Ignore generic updates.
        - For each takeaway, you must capture three distinct dimensions:
            1. The Context: What is the situation, problem, or environment?
            2. The Mechanism: What specific action, strategy, or biological process caused the result? (Crucial: Be specific about *how* it works).
            3. The Outcome: What was the measurable result or insight?

        # Style & Formatting Constraints:
        - Standalone Thoughts: Each takeaway must be completely self-contained. The reader should require zero context from the original text or other takeaways to understand it.
        - Deep & Dense: “Max 140–220 words per takeaway”. Be very thorough but concise (no fluff). Every sentence must add value.
        - Factual Accuracy: Prioritize truths and facts over emotions or opinions. Do not embellish. No outside knowledge. Use only articleText.
        - Neutral Tone: Strictly avoid promotional language (e.g., "groundbreaking," "revolutionary").
        - Direct Start: Do not start with "The takeaway is..." or "This article discusses...". Jump straight into the facts.
        - References:
          - when making a claim, provide a reference number and the relevant fact, quote or data to support the claim. e.g.  "(ref 1)"
          - For direct quotes, include the exact excerpt from the text and attribute the quote to the person.
          - If no direct quote exists, cite the exact sentence(s) that state the fact (still verbatim). Don’t invent a quote.
          - Start at 1 and increment for each reference.
          - References should only be used for the current takeaway.
          - Do not use the same reference across takeaways.
        - Independence: Each takeaway must be unique and unrelated to the others. Do not reference previous points.`),
      references: z.array(
        z.object({
          number: z.number().describe(`The number of the reference.
            -Start at 1 and increment for each reference.
            -References should only be used for the current takeaway.
            -Do not use the same reference across takeaways.`),
          reference: z.string()
            .describe(`Relevant facts, quotes and data to support the takeaway.
              - When quoting, provide the attribution in the following format: '"[text]" - <Author/Speaker/Source Name>' (Ideally we are quoting a person, but sources are also valid.)
              - The reference should be an exact excerpt from the text. Never use a summary of the text.
              - The reference should be able to stand alone, such that it could be reused in a different context.
              - Err on over referencing to ensure the takeaways are well supported by the text.
              - use '...' for split quotes`),
        }),
      ),
    }),
  ),
});

export async function getTakeaways(
  articleText: string,
  takeawayInstructions?: string,
  model = "gpt-5.2",
  sourceAttribution?: string,
) {
  const response = await client.responses.parse({
    model,
    text: { format: zodTextFormat(schema, "takeaways") },
    input: [
      {
        role: "user",
        type: "message",
        content: `
        # Role
        You are a Lead Systems Analyst. Your job is to compress raw information into high-signal and evidence-backed findings. You are processing a mix of Financial News, Earnings Transcripts, and Scientific Research.

        ${
          sourceAttribution
            ? `# Source Attribution
        This document is from: ${sourceAttribution}
        When attributing quotes or claims, this source can be usedfor correct attribution.`
            : ""
        }

        Document Text:
        ${articleText}

        ${
          takeawayInstructions
            ? `Instructions:
        ${takeawayInstructions}`
            : ""
        }

        Create a structured list of the 1-5 most novel and important findings from the document.
          - Novelty = contradicts consensus / non-obvious second-order effect / new quantified datapoint / new mechanism / changes expected distribution.
        Make sure to heavily reference the text to support the facts, quotes, claims and data.
        Better to have more references to support the findings.
        It is better to have less findings, if they are not unique and unrelated.
        `,
      },
    ],
  });

  const parsed = response.output_parsed;
  invariant(parsed?.takeaways, "No content");

  const takeaways = parsed.takeaways;

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
