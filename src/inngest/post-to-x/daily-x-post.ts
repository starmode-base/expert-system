import { invariant } from "@tanstack/react-router";
import { inngest } from "../client";
import { postToX } from "~/lib/post-to-x";
import { db } from "~/postgres/db";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const openAiClient = new OpenAI();

const pickInsightSchema = z.object({
  insightId: z.string(),
});

interface InsightCandidate {
  id: string;
  title: string;
  insight: string;
  createdAt: Date;
}

/**
 * Choose the most interesting insight from the last 24h and post to X between
 * 7:30-8:30 AM AZ.
 */
export const dailyXPost = inngest.createFunction(
  { id: "scheduler.daily-x-post" },
  { cron: "TZ=America/Phoenix 30 7 * * *" },
  async ({ step }) => {
    const jitterMinutes = Math.floor(Math.random() * 60);
    if (jitterMinutes > 0) {
      console.log(`Sleeping for ${jitterMinutes} minutes`);
      //   await step.sleep("post-jitter", jitterMinutes * 60 * 1000);
    }

    const insights = await step.run("fetch-insights-last-24h", async () => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const rows = await db.query.insights.findMany({
        columns: { id: true, title: true, insight: true, createdAt: true },
        where: (insights, { and, gte, isNotNull }) =>
          and(gte(insights.createdAt, cutoff), isNotNull(insights.insight)),
        orderBy: (insights, { desc }) => [desc(insights.createdAt)],
        limit: 25,
      });

      return rows
        .filter((row): row is InsightCandidate => Boolean(row.insight))
        .map((row) => ({
          ...row,
          title: row.title,
          insight: row.insight,
        }));
    });

    if (insights.length === 0) {
      return { posted: false, reason: "no-insights" };
    }

    const chosenInsightId = await step.run(
      "pick-most-interesting-insight",
      async () => {
        const res = await openAiClient.responses.parse({
          model: "gpt-5-mini",
          input: [
            {
              role: "system",
              content:
                "Select the single most interesting insight to post to X. Prefer novelty, clarity, and broad appeal.",
            },
            {
              role: "user",
              content: insights
                .map((insight, index) => {
                  const createdAtIso = new Date(
                    insight.createdAt,
                  ).toISOString();
                  return `#${index + 1} id=${insight.id}\ncreated=${createdAtIso}\ntitle=${insight.title}\ntext=${insight.insight}`;
                })
                .join("\n---\n"),
            },
          ],
          text: { format: zodTextFormat(pickInsightSchema, "pick_insight") },
        });

        const parsed = res.output_parsed;
        invariant(parsed, "No LLM selection");
        return parsed.insightId;
      },
    );

    const chosenInsight = insights.find(
      (insight) => insight.id === chosenInsightId,
    );

    if (!chosenInsight) {
      return { posted: false, reason: "chosen-insight-missing" };
    }

    const tweetText = await step.run("format-insight-for-x", async () => {
      const res = await openAiClient.responses.create({
        model: "gpt-5-mini",
        input: [
          {
            role: "system",
            content: `Remove markdown formatting and break the text into shorter paragraphs with newlines for readability.
            Otherwise keep all text exactly the same including references e.g. (ref 1).`,
          },
          {
            role: "user",
            content: `Text:
            ${chosenInsight.insight}`,
          },
        ],
      });

      const text = res.output_text;
      invariant(text, "No tweet text");
      return text;
    });

    const replyLink = `https://expert-system.starmode.dev/insight/${chosenInsight.id}`;

    const postResult = await step.run("post-to-x", async () => {
      return await postToX(tweetText, replyLink);
    });

    return {
      posted: true,
      jitterMinutes,
      insightId: chosenInsight.id,
      tweetId: postResult.post.id,
      replyId: postResult.reply.id,
    };
  },
);
