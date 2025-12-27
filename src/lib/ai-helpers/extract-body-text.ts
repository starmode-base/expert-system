import { invariant } from "@tanstack/react-router";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import fetch from "node-fetch";

const client = new OpenAI();

const outputSchema = z.object({
  text: z
    .string()
    .describe("The extracted main body text as plain text with paragraphs"),
});

function getBodyHtml(html: string): string {
  const match = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  return match?.[1] ?? html;
}

function stripHeavyTags(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, "");
}

function truncateForModel(html: string): string {
  // Limit payload size to avoid model/context issues on very large pages
  const maxChars = 200_000;
  if (html.length <= maxChars) {
    return html;
  }

  return html.slice(0, maxChars);
}

export async function extractBodyTextFromHtml(html: string): Promise<string> {
  const bodyHtml = truncateForModel(stripHeavyTags(getBodyHtml(html)));

  const response = await client.responses.parse({
    model: "gpt-5-nano",
    input: [
      {
        role: "system",
        content:
          "You extract the main article/document body text from HTML. Return only the Title, author, publication date, primary content text and any text relevent to the reader. Exclude navigation, headers/footers, sidebars, cookie banners, subscription prompts, ads, related links, and comments. Preserve paragraph breaks with blank lines. Do not add or paraphrase any content; only extract what is present. If there is no clear main body content, return an empty string.",
      },
      {
        role: "user",
        content: `Extract the main body text from this HTML:\n\n${bodyHtml}`,
      },
    ],
    text: { format: zodTextFormat(outputSchema, "extracted_body_text") },
  });

  invariant(response.output_parsed?.text !== undefined, "No extracted text");
  return response.output_parsed.text.trim();
}

export async function extractBodyTextFromUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const html = await res.text();
  return extractBodyTextFromHtml(html);
}
