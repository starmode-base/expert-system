import { invariant } from "@tanstack/react-router";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const client = new OpenAI();

const schema = z.object({
  title: z
    .string()
    .describe(
      "Short title that nods to the domain. 4-9 words, no markdown, no punctuation at the end.",
    ),
  core_insight_statement: z
    .string()
    .describe(
      "One decisive sentence capturing the core insight in plain text. No markdown.",
    ),
  blog_post: z.string().describe(
    `A X post for easy, entertaining reading. Use short paragraphs and light markdown. Do not include a title or headings.

    Rules:
    - Do not add new facts or claims.
    - Preserve the causal logic and conclusions.
    - Avoid hedging (may/might/could).
    - No title or headings inside the X post.

    # Guidelines
    - Assume the reader is an intelligent investor or business person, but does not have a background in the domain. So, provide context and/or definitions for the deeper domain knowledge if necessary to help them understand the insight. Keep industry specific jargon to a minimum.
    - Start with a hook that is engaging and interesting to the reader. Using reconizable names helps.
    - Dont just rewrite the research, craft a post that is worth stopping to read.

    # Writing Style
    - Use formatting (e.g. Short paragraphs, bolded text, and optionally bullet points) to make the insight more engaging and readable.
    - Clear, human and entertaining.
    - Write in simple language, sharp ideas, calm confidence.
    - Explain the core concepts in an intuitive way, that anyone can understand.
      `,
  ),
});

const responseFormat = zodTextFormat(schema, "response");

export async function getInsightSummary(researchText: string) {
  const response = await client.responses.parse({
    model: "gpt-5-mini",
    input: [
      {
        role: "user",
        content: `You are a sharp editor for an investing insights newsletter.

Based on the research below, create:
1) A short title.
2) A single-sentence core insight statement.
3) A X post that is easy and entertaining to read.

Research:
${researchText}`,
      },
    ],
    text: { format: responseFormat },
  });

  const parsed = response.output_parsed;
  invariant(parsed, "No content");

  return parsed;
}
