import { invariant } from "@tanstack/react-router";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const client = new OpenAI();

const documentSummarySchema = z.object({
  summary: z
    .string()
    .describe("A brief 2-3 sentence summary of the article's main topic."),
  isSubstantive: z
    .boolean()
    .describe(
      "True if the article contains meaningful analysis, original insights, data, research, or technical depth. False if the article is primarily logistical (event announcements, hiring, schedule changes), self-promotional (product marketing, fundraising, company milestones), a link roundup without original commentary, or a short news recap without analysis.",
    ),
});

export type DocumentSummary = z.infer<typeof documentSummarySchema>;

const responseFormat = zodTextFormat(documentSummarySchema, "document_summary");

/**
 * Generate a brief summary of a document and assess whether it contains
 * substantive insights using OpenAI gpt-5-nano structured output.
 *
 * @param articleText - The full text of the article to summarize
 * @param title - The title of the article (provides context)
 * @returns Summary text and a flag indicating substantive content
 */
export async function getDocumentSummary(
  articleText: string,
  title: string,
): Promise<DocumentSummary> {
  // Truncate very long articles to avoid token limits
  const maxChars = 15000;
  const truncatedText =
    articleText.length > maxChars
      ? articleText.slice(0, maxChars) + "..."
      : articleText;

  const response = await client.responses.parse({
    model: "gpt-5-nano",
    input: [
      {
        role: "system",
        content:
          "You are a helpful assistant that creates brief, informative summaries of articles and documents. You also assess whether articles contain substantive analytical content versus logistical or promotional updates.",
      },
      {
        role: "user",
        content: `Summarize the following article in 2-3 sentences. Focus on the main topic and key insights. Also determine whether this article is substantive — meaning it contains original analysis, data-driven insights, research findings, technical depth, or meaningful commentary — as opposed to logistical updates, self-promotion, product announcements, or link roundups without original analysis.

Title: ${title}

Article:
${truncatedText}`,
      },
    ],
    text: { format: responseFormat },
  });

  const parsed = response.output_parsed;
  invariant(parsed, "No summary generated");

  return parsed;
}
