import { invariant } from "@tanstack/react-router";
import OpenAI from "openai";

const client = new OpenAI();

/**
 * Generate a brief summary of a document using OpenAI gpt-5-min.
 * Used to create descriptions for imported documents.
 *
 * @param articleText - The full text of the article to summarize
 * @param title - The title of the article (provides context)
 * @returns A brief 2-3 sentence summary
 */
export async function getDocumentSummary(
  articleText: string,
  title: string,
): Promise<string> {
  // Truncate very long articles to avoid token limits
  const maxChars = 15000;
  const truncatedText =
    articleText.length > maxChars
      ? articleText.slice(0, maxChars) + "..."
      : articleText;

  const response = await client.responses.create({
    model: "gpt-5-mini",
    input: [
      {
        role: "system",
        content:
          "You are a helpful assistant that creates brief, informative summaries of articles and documents.",
      },
      {
        role: "user",
        content: `Summarize the following article in 2-3 sentences. Focus on the main topic and key insights.

Title: ${title}

Article:
${truncatedText}`,
      },
    ],
  });

  const text = response.output_text;
  invariant(text, "No summary generated");

  return text;
}
