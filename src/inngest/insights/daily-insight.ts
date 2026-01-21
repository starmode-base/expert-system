import { db } from "~/postgres/db";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { invariant } from "@tanstack/react-router";
import { inngest } from "../client";

interface DailyInsightUser {
  id: string;
  email: string;
}

interface TakeawaySummary {
  id: string;
  summary: string;
}

const openAiClient = new OpenAI();
/**
 * Generate daily insights for each user based on takeaways created in the last 24 hours.
 * Runs daily at 7 AM Phoenix time.
 */
export const dailyInsight = inngest.createFunction(
  { id: "scheduler.daily-insight" },
  { cron: "TZ=America/Phoenix 0 7 * * *" },
  async ({ step }) => {
    const users = await step.run("get-all-users", async () => {
      const rows = await db.query.users.findMany({
        where: (users, { eq }) => eq(users.email, "spencer@starmode.app"),
        columns: { id: true, email: true },
      });

      return rows satisfies DailyInsightUser[];
    });

    const takeaways = await step.run("get-takeaways-last-24h", async () => {
      const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      const rows = await db.query.takeaways.findMany({
        columns: { id: true, summary: true },
        where: (takeaways, { gte }) => gte(takeaways.createdAt, cutoff),
      });

      return rows satisfies TakeawaySummary[];
    });

    const insightPrompts = await step.run(
      "get-generate-insight-prompts",
      async () => {
        return await generateResearchObjectives(takeaways);
      },
    );

    // If no seed texts, don't send any insights
    if (insightPrompts.length === 0)
      return {
        users: users.length,
        takeaways: takeaways.length,
        sent: 0,
      };

    // Send all user/prompt combinations in parallel
    const sendCounts = await Promise.all(
      users.map((user) =>
        Promise.all(
          insightPrompts.map((insightPrompt, promptIndex) =>
            step.sendEvent(`generate-insight-${user.id}-${promptIndex}`, {
              name: "app/generate-insight",
              data: {
                insightPrompt,
                user: { id: user.id, email: user.email },
              },
            }),
          ),
        ).then((results) => results.length),
      ),
    );

    const totalInsightsSent = sendCounts.reduce(
      (total, count) => total + count,
      0,
    );

    return {
      users: users.length,
      takeaways: takeaways.length,
      totalInsightsSent,
      insightPrompts,
    };
  },
);

async function generateResearchObjectives(
  takeaways: TakeawaySummary[],
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
