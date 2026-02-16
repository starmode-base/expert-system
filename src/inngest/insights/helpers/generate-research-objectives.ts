import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { invariant } from "@tanstack/react-router";
import { models } from "~/models";

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
            "A distinct 1-2 sentence research theme. The first theme must cover AI and technology advancement. The second theme must cover business, markets, or economics with an investable angle.",
          ),
      )
      .length(2),
  });

  const response = await openAiClient.responses.parse({
    model: models.reasoning,
    reasoning: { effort: "low" },
    input: [
      {
        role: "system",
        type: "message",
        content:
          "You are a research director for a discovery-oriented insight engine. You operate across two domains: (1) the advancement of AI and technology, and (2) business, markets, and economics. Your job is to propose research themes that surface non-obvious, surprising, and consequential ideas in each domain. Optimize for novelty, cross-domain connections, and the potential to shift mental models.",
      },
      {
        role: "user",
        type: "message",
        content: `SYSTEM PROMPT: RESEARCH THEME GENERATION

Objective:
Given recent takeaway summaries and recent insights, generate exactly 2 distinct research themes that will guide a research agent to discover relevant documents from a large corpus. These themes are inputs to downstream insight generation and must maximize novelty, optionality, and second-order discovery.

Theme classes (strict — one theme per class):

Theme 1 — AI & Technology Advancement:
- Focus on the frontier of AI capabilities, infrastructure, tooling, adoption dynamics, or emergent behavior in AI systems.
- Can include adjacent technology domains (compute, semiconductors, robotics, biotech, energy) when they intersect with or are reshaped by AI progress.
- Favor themes about capability shifts, architectural changes, scaling dynamics, deployment bottlenecks, or second-order effects of AI integration into existing systems.
- Strong themes expose a tension, constraint, or counterintuitive dynamic in how AI technology is actually progressing vs. the popular narrative.

Theme 2 — Business, Markets & Economics (Investable):
- Focus on market structure, capital flows, competitive dynamics, regulatory shifts, or macroeconomic forces that create asymmetric opportunities or risks.
- Themes should point toward investable research areas — sectors, asset classes, structural trades, or emerging market dislocations that reward deeper investigation.
- Can span public equities, private markets, commodities, credit, real estate, or macro when the theme identifies a specific mechanism or catalyst.
- Strong themes reveal a mispricing, an under-appreciated structural shift, or a breakdown in consensus assumptions about economic fundamentals.

Output rules (strict):
- Output exactly 2 research themes, one per class, in order (AI/tech first, markets/economics second).
- Each theme must be phrased as a short research framing statement, not a question.
- 1–2 sentences per theme.
- No bullets, no numbering, no headings, no colons.
- Plain text only.

Novelty constraints (critical):
- Do NOT overlap with recent insights in central claim, primary entities, or core mechanism.
- Each theme must target a different topic cluster and a different set of primary actors or systems.
- Themes should be broad enough to pull diverse documents, but sharp enough to exclude generic material.
- Penalize obvious continuations of known narratives or consensus views.

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
