import { db } from "~/postgres/db";

import { inngest } from "../client";
import { generateResearchObjectives } from "./helpers/generate-research-objectives";

/**
 * Generate daily insights for each user based on takeaways created in the last 3 days.
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

      return rows;
    });

    const takeaways = await step.run("get-takeaways-last-3d", async () => {
      // Query the 20 most recently created takeaways
      const rows = await db.query.takeaways.findMany({
        columns: { id: true, summary: true },
        orderBy: (takeaways, { desc }) => desc(takeaways.createdAt),
        limit: 20,
      });

      return rows;
    });

    const recentInsights = await step.run("get-recent-insights", async () => {
      const rows = await db.query.insights.findMany({
        columns: { id: true, title: true, summary: true },
        orderBy: (insights, { desc }) => desc(insights.createdAt),
        limit: 20,
      });

      return rows;
    });

    const insightPrompts = await step.run(
      "get-generate-insight-prompts",
      async () => {
        return await generateResearchObjectives(takeaways, recentInsights);
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
