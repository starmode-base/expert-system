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
      "One decisive sentence capturing the non-obvious, surprising claim. This is the 'aha' moment. Plain text, no markdown.",
    ),
  post: z.string().describe(
    `A post that makes the reader stop and think "I never considered that."

    The goal is not to summarize—it's to make someone reconsider their assumptions.

    # Rules
    - Do not add new facts or claims.
    - Preserve the causal logic and conclusions.
    - Avoid hedging (may/might/could).
    - No title or headings inside the post.

    # Structure
    - Lead with the surprising part, not the setup. Open with the non-obvious insight or counterintuitive observation.
    - Use a concrete example, company, or anecdote to make it tangible.
    - Explain the mechanism briefly—why this is happening.
    - End with the implication: what changes if this is true?

    # Guidelines
    - Assume the reader is intelligent but not an expert in the domain. Provide context for specialized knowledge.
    - Use recognizable names (companies, people, products) to anchor abstract ideas.
    - Don't just rewrite the research—distill it into the most interesting version of itself.
    - make it brief. Just a few paragraphs.

    # Writing Style
    - Short paragraphs, bolded key phrases, occasional bullets for clarity.
    - Write like you're telling a smart friend something you just figured out.
    - Simple language, sharp ideas, calm confidence.
    - If the insight is genuinely surprising, let it speak for itself—don't oversell.
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
        content: `You are a sharp editor who distills research into its most interesting, non-obvious form.

Based on the research below, create:
1) A short title that hints at the surprising insight (not a generic topic label).
2) A single-sentence core insight statement—the "aha" moment that makes someone stop and think.
3) A post that makes the reader reconsider their assumptions.

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
