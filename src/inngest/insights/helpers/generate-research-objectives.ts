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
            "A distinct 1-2 sentence research question pointing toward a non-obvious, surprising, or counterintuitive insight. Should connect multiple ideas and challenge conventional thinking.",
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
          "You are a research director for a discovery-oriented insight engine. Your job is to propose research questions that surface non-obvious, surprising, and consequential ideas about how the world is changing. Optimize for novelty, cross-domain connections, and the potential to shift mental models.",
      },
      {
        role: "user",
        type: "message",
        content: `Given the recent takeaway summaries and recent insights below, generate exactly 3 distinct research objectives for the insight generator.

      Output rules (strict):
      - Each objective must be phrased as a single concrete research question (end with a "?").
      - 1–2 sentences per objective (no bullets, no colons, no sub-questions).

      Quality bar:
      - Non-obvious: connects at least two ideas from different sources or domains in a way that reveals something hidden or counterintuitive.
      - Consequential: if the answer is "yes," it changes how we should think about a company, sector, technology, or economic dynamic.
      - Testable: there is some observable evidence that would confirm or refute this.
      - Surprising: a smart generalist would say "I hadn't thought of that" or "that's counterintuitive."

      What makes a research objective interesting:
      - It challenges a widely-held assumption
      - It connects two things people don't usually connect
      - It identifies an emerging pattern before it's obvious
      - It explains something confusing or counterintuitive
      - It reveals a hidden constraint or bottleneck
      - It surfaces a second-order effect of a known trend

      What is NOT interesting:
      - Restating what the takeaways already say
      - Obvious trend extrapolation ("AI will keep growing")
      - Generic sector analysis ("cloud is competitive")
      - Questions with obvious answers

      Novelty constraints:
      - Do not overlap with the recent insights. Avoid the same central claim, same primary entities, or same mechanism.
      - Each of the 3 objectives must target a different topic cluster and different primary entities.

      Style constraints:
      - Do not restate or quote the takeaways.
      - Do not hedge (avoid words like "may", "might", "could").
      - Write like you're pointing an analyst toward something genuinely surprising that deserves investigation.

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
