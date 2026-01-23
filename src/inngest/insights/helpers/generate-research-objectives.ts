import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { invariant } from "@tanstack/react-router";

const openAiClient = new OpenAI();

export async function generateResearchObjectives(
  takeaways: { id: string; summary: string }[],
): Promise<string[]> {
  if (takeaways.length === 0) return [];

  const outputSchema = z.object({
    researchObjectives: z
      .array(
        z
          .string()
          .describe(
            "A distinct 1-2 sentence research objective capturing an important topic cluster. This objective should be capable of producing a defensible, potentially investable insight.",
          ),
      )
      .length(3),
  });

  const response = await openAiClient.responses.parse({
    model: "gpt-5.2",
    reasoning: { effort: "low" },
    input: [
      {
        role: "system",
        type: "message",
        content:
          "You are a research director designing high-leverage research agendas for an insight generation system focused on business, technology, and investing.",
      },
      {
        role: "user",
        type: "message",
        content: `Given the recent takeaway summaries below, generate exactly 3 distinct research objectives for the insight generator.

      Each research objective should:
      - Be framed as a concrete investigation or question, not a summary
      - Focus on business and/or technology dynamics with clear investment relevance
      - Be specific and directional (not generic trend-watching)
      - Be novel or non-obvious based on the takeaways
      - Be capable of producing a defensible, potentially investable insight

      Constraints:
      - Each objective must target a different topic cluster
      - Do not restate or quote the takeaways
      - Do not hedge or list multiple sub-questions
      - Write 1–2 sentences per objective

      Takeaway summaries:
      ${takeaways.map((takeaway) => `- ${takeaway.summary}`).join("\n")}`,
      },
    ],
    text: { format: zodTextFormat(outputSchema, "research_objectives") },
  });

  invariant(
    response.output_parsed?.researchObjectives,
    "No research objectives",
  );

  return response.output_parsed.researchObjectives;
}
