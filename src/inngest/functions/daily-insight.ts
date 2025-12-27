import { db } from "~/postgres/db";
import { inngest } from "../client";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { invariant } from "@tanstack/react-router";

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
 * Runs daily at 9 AM Phoenix time.
 */
export const dailyInsight = inngest.createFunction(
  { id: "scheduler.daily-insight" },
  { cron: "TZ=America/Phoenix 0 9 * * *" },
  async ({ step }) => {
    const users = await step.run("get-all-users", async () => {
      const rows = await db.query.users.findMany({
        where: (users, { eq }) => eq(users.email, "spencer@starmode.app"),
        columns: { id: true, email: true },
      });

      return rows satisfies DailyInsightUser[];
    });

    const takeaways = await step.run("get-takeaways-last-24h", async () => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const rows = await db.query.takeaways.findMany({
        columns: { id: true, summary: true },
        where: (takeaways, { gte }) => gte(takeaways.createdAt, cutoff),
      });

      return rows satisfies TakeawaySummary[];
    });

    const seedTexts = await step.run(
      "get-generate-insight-seed-texts",
      async () => {
        if (takeaways.length <= 3) return takeaways.map((t) => t.summary);

        return await generateTakeawaySummaries(takeaways);
      },
    );

    const sentCount = await Promise.all(
      users.flatMap((user) =>
        seedTexts.map(async (seedText, seedTextIndex) => {
          await step.sendEvent(`generate-insight-${user.id}-${seedTextIndex}`, {
            name: "app/generate-insight",
            data: {
              seedText,
              insightPrompt: "create an clear investment thesis",
            },
            user: { id: user.id, email: user.email },
          });
        }),
      ),
    );

    return {
      users: users.length,
      takeaways: takeaways.length,
      sent: sentCount,
    };
  },
);

async function generateTakeawaySummaries(
  takeaways: TakeawaySummary[],
): Promise<string[]> {
  const takeawaySummaries = takeaways
    .map((t) => t.summary)
    .filter((summary) => summary.trim().length > 0);

  if (takeawaySummaries.length === 0) return [];

  const outputSchema = z.object({
    summaries: z
      .array(
        z
          .string()
          .min(1)
          .describe(
            "A distinct 1-2 sentence summary capturing an important topic cluster",
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
          "You synthesize many short takeaway summaries into a small set of distinct, high-signal topic summaries.",
      },
      {
        role: "user",
        type: "message",
        content: `Given the takeaway summaries below, generate exactly 3 distinct summaries (each 1-2 sentences) that capture the most important or interesting topics across the set.

Rules:
- Each of the 3 summaries should cover a different topic cluster
- Be specific, not generic
- Do not quote the input directly

Takeaway summaries:
${takeawaySummaries.map((s) => `- ${s}`).join("\n")}`,
      },
    ],
    text: { format: zodTextFormat(outputSchema, "takeaway_summaries") },
  });

  invariant(response.output_parsed?.summaries, "No summaries");

  return response.output_parsed.summaries;
}
