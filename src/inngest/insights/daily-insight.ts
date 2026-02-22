import { and, desc, eq, gte, notInArray } from "drizzle-orm";
import { db, schema } from "~/postgres/db";

import { inngest } from "../client";
import { generateResearchThemes } from "./helpers/generate-research-objectives";

/**
 * Generate daily insights for each user based on takeaways created in the last 3 days.
 * Runs daily at 7 AM Phoenix time.
 */
const trigger =
  process.env.NODE_ENV === "production"
    ? ({ cron: "TZ=America/Phoenix 0 7 * * *" } as const)
    : ({ event: "dev/scheduler.daily-insight.manual" } as const);

export const dailyInsight = inngest.createFunction(
  { id: "scheduler.daily-insight" },
  trigger,
  async ({ step }) => {
    // Hardcoded for now to send to to only generate insights for ME
    const users = await step.run("get-all-users", async () => {
      const rows = await db.query.users.findMany({
        where: (users, { eq }) =>
          eq(users.email, "spencer.g.smith6+dev@gmail.com"),
        columns: { id: true, email: true },
      });

      return rows;
    });

    const takeaways = await step.run("get-takeaways-last-5d", async () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

      const usedInLast3Days = db
        .selectDistinct({ id: schema.insightTakeaways.takeawayId })
        .from(schema.insightTakeaways)
        .innerJoin(
          schema.insights,
          eq(schema.insightTakeaways.insightId, schema.insights.id),
        )
        .where(gte(schema.insights.createdAt, fiveDaysAgo));

      const rows = await db
        .select({
          id: schema.takeaways.id,
          summary: schema.takeaways.summary,
        })
        .from(schema.takeaways)
        .where(
          and(
            gte(schema.takeaways.createdAt, fiveDaysAgo),
            notInArray(schema.takeaways.id, usedInLast3Days),
          ),
        )
        .orderBy(desc(schema.takeaways.createdAt))
        .limit(20);

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

    // If there are fewer than five takeaways, do not proceed and return a summary
    if (takeaways.length < 5) {
      return {
        users: users.length,
        takeaways: takeaways.length,
        sent: 0,
        reason: "Not enough takeaways to generate insights",
      };
    }

    const researchThemes = await step.run(
      "get-generate-insight-prompts",
      async () => {
        return await generateResearchThemes(takeaways, recentInsights);
      },
    );

    // If no seed texts, don't send any insights
    if (researchThemes.length === 0)
      return {
        users: users.length,
        takeaways: takeaways.length,
        sent: 0,
      };

    // Send all user/prompt combinations in parallel
    const sendCounts = await Promise.all(
      users.map((user) =>
        Promise.all(
          researchThemes.map((researchTheme, promptIndex) =>
            step.sendEvent(`generate-insight-${user.id}-${promptIndex}`, {
              name: "app/generate-insight",
              data: {
                seedText: researchTheme,
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
      insightPrompts: researchThemes,
    };
  },
);
