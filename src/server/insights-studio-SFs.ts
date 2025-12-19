import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { authMiddleware } from "~/middleware/auth-middleware";
import { db, schema } from "~/postgres/db";
import { sendEventGenerateInsightSF } from "./inggest";

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
  .handler(async ({ context, data: { takeawayId } }) => {
    const title = `New Insight: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\/|\.|\s/g, "/")}`;
    const [insight] = await db
      .insert(schema.insights)
      .values({
        userId: context.viewer.id,
        title,
      })
      .returning({ id: schema.insights.id });

    if (!insight?.id) {
      throw new Error("Failed to create insight");
    }

    try {
      await db
        .insert(schema.insightTakeaways)
        .values({ insightId: insight.id, takeawayId });
    } catch (error) {
      await db
        .delete(schema.insights)
        .where(eq(schema.insights.id, insight.id));
      throw error;
    }

    void sendEventGenerateInsightSF({
      data: { insightId: insight.id, insightPrompt: "" },
    });

    return { insightId: insight.id };
  });

export const removeTakeawayFromInsightSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ insightId: z.string(), takeawayId: z.string() }))
  .handler(async ({ data: { insightId, takeawayId } }) => {
    await db
      .delete(schema.insightTakeaways)
      .where(
        and(
          eq(schema.insightTakeaways.insightId, insightId),
          eq(schema.insightTakeaways.takeawayId, takeawayId),
        ),
      );
  });

export const getInsightTakeawaysSF = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ insightId: z.string() }))
  .handler(async ({ data: { insightId } }) => {
    const takeaways = await db.query.insightTakeaways.findMany({
      with: {
        takeaway: {
          with: { category: true, document: true, takeawayReferences: true },
        },
      },
      where: eq(schema.insightTakeaways.insightId, insightId),
    });

    return takeaways.map((takeaway) => ({
      id: takeaway.takeaway.id,
      title: takeaway.takeaway.title,
      publicationDate: takeaway.takeaway.document.publicationDate,
      takeaway: takeaway.takeaway.takeaway,
      concept: takeaway.takeaway.concept,
      category: takeaway.takeaway.category?.name,
      summary: takeaway.takeaway.summary,
      references: takeaway.takeaway.takeawayReferences,
      documentTitle: takeaway.takeaway.document.title,
      documentSource: takeaway.takeaway.document.source,
    }));
  });
