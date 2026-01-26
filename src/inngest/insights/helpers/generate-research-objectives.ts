import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { invariant } from "@tanstack/react-router";

const openAiClient = new OpenAI();

export async function generateResearchObjectives(
  takeaways: { id: string; summary: string }[],
  recentInsights: {
    id: string;
    title: string;
    summary: string | null;
  }[],
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
          "You are a research director for an investing-oriented insight engine. Your job is to propose research questions that are falsifiable, decision-relevant, and likely to surface non-obvious winners/losers. Optimize for novelty, specificity, and the ability to be supported with evidence.",
      },
      {
        role: "user",
        type: "message",
        content: `Given the recent takeaway summaries and recent insights below, generate exactly 3 distinct research objectives for the insight generator.

      Output rules (strict):
      - Each objective must be phrased as a single concrete research question (end with a “?”).
      - 1–2 sentences per objective (no bullets, no colons, no sub-questions).

      Quality bar:
      - Falsifiable: it should be possible to be wrong, and the objective should imply what evidence would confirm/disconfirm.
      - Investment-relevant: it should point to a tradeable implication (winner/loser, margin/volatility shift, multiple re-rating, or structural demand/supply shift).
      - Specific: include (a) a clear unit of analysis (company/sector/value-chain node), (b) at least 1 measurable outcome (e.g., pricing, margins, adoption, CAC, churn, capex, yields, utilization), and (c) a time horizon.
      - Novel: it should not be a generic trend; it should connect at least two ideas from the takeaways into a non-obvious mechanism.

      Novelty constraints:
      - Do not overlap with the recent insights. Avoid the same central claim, same primary entities, or same mechanism.
      - Each of the 3 objectives must target a different topic cluster and different primary entities.

      Style constraints:
      - Do not restate or quote the takeaways.
      - Do not hedge (avoid words like “may”, “might”, “could”).
      - Do not ask for a literature review.
      - Write like you expect an analyst to go gather evidence and publish a decisive take.

      Takeaway summaries:
      ${takeaways.map((takeaway) => `- ${takeaway.summary}`).join("\n")}

      Recent insights (avoid overlap):
      ${recentInsights
        .map((insight) =>
          [
            `- ${insight.title}`,
            insight.summary ? `  Summary: ${insight.summary}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n")}`,
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
