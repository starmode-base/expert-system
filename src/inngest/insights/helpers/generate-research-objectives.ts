import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { invariant } from "@tanstack/react-router";

const openAiClient = new OpenAI();

export async function generateResearchThemes(
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
            "A distinct 1-2 sentence research question pointing toward a non-obvious, surprising, or counterintuitive insight. Should connect multiple ideas and challenge conventional thinking.",
          ),
      )
      .length(2),
  });

  const response = await openAiClient.responses.parse({
    model: "gpt-5.2",
    reasoning: { effort: "low" },
    input: [
      {
        role: "system",
        type: "message",
        content:
          "You are a research director for a discovery-oriented insight engine. Your job is to propose research questions that surface non-obvious, surprising, and consequential ideas about how the world is changing. Optimize for novelty, cross-domain connections, and the potential to shift mental models.",
      },
      {
        role: "user",
        type: "message",
        content: `SYSTEM PROMPT: RESEARCH THEME GENERATION

Objective:
Given recent takeaway summaries and recent insights, generate exactly 2 distinct research themes that will guide a research agent to discover relevant documents from a large corpus. These themes are inputs to downstream insight generation and must maximize novelty, optionality, and second-order discovery.

Output rules (strict):
- Output exactly 2 research themes.
- Each theme must be phrased as a short research framing statement, not a question.
- 1–2 sentences per theme.
- No bullets, no numbering, no headings, no colons.
- Plain text only.

Novelty constraints (critical):
- Do NOT overlap with recent insights in central claim, primary entities, or core mechanism.
- Each theme must target a different topic cluster and a different set of primary actors or systems.
- Themes should be broad enough to pull diverse documents, but sharp enough to exclude generic material.
- Penalize obvious continuations of known narratives or consensus views.

Quality bar for a strong research theme:
- Connects at least two different domains (e.g., technology + regulation, incentives + infrastructure, labor + capital).
- Challenges a widely-held assumption or exposes a hidden constraint, bottleneck, or second-order effect.
- Points toward an explanation for something confusing, unstable, or contradictory in the current landscape.
- If explored deeply, could plausibly produce an investable or strategic insight.

What makes a theme weak (avoid):
- Restating or slightly generalizing existing takeaways.
- Obvious trend extrapolation or surface-level macro narratives.
- Company-specific diligence questions.
- Themes that imply an answer rather than opening a line of inquiry.

Style constraints:
- Favor structural forces, incentives, and mechanisms over events or announcements.

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
