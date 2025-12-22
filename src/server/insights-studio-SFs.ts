import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { authMiddleware } from "~/middleware/auth-middleware";
import { db, schema } from "~/postgres/db";
import { sendEventGenerateInsightSF } from "./inggest";
import { invariant } from "@tanstack/react-router";

export const createInsightSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const title = `New Insight: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\/|\.|\s/g, "/")}`;
    const [insight] = await db
      .insert(schema.insights)
      .values({
        userId: context.viewer.id,
        title,
      })
      .returning({ id: schema.insights.id });

    return insight?.id ?? null;
  });

export const deleteInsightSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.string())
  .handler(async ({ data: insightId }) => {
    await db.delete(schema.insights).where(eq(schema.insights.id, insightId));
  });

export const getInsightsSF = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return await db.query.insights.findMany({
      where: eq(schema.insights.userId, context.viewer.id),
      orderBy: (insights, { desc }) => [desc(insights.createdAt)],
    });
  });

export const updateInsightTitleSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string(), title: z.string() }))
  .handler(async ({ data: { id, title } }) => {
    await db
      .update(schema.insights)
      .set({ title })
      .where(eq(schema.insights.id, id));
  });

export const createInsightWithTakeawaySF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ takeawayId: z.string() }))
  .handler(async ({ data: { takeawayId } }) => {
    const takeaway = await db.query.takeaways.findFirst({
      where: eq(schema.takeaways.id, takeawayId),
    });
    invariant(takeaway, "Takeaway not found");

    void sendEventGenerateInsightSF({
      data: { seedText: takeaway.summary, insightPrompt: "" },
    });
  });
