import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { authMiddleware } from "~/middleware/auth-middleware";
import { db, schema } from "~/postgres/db";

export const createInsightSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await db.insert(schema.insights).values({
      userId: context.viewer.id,
      title: `New Insight: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\/|\.|\s/g, "/")}`,
    });
    return context.viewer.email;
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

export const addTakeawayToInsightSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ insightId: z.string(), takeawayId: z.string() }))
  .handler(async ({ data: { insightId, takeawayId } }) => {
    await db.insert(schema.insightTakeaways).values({ insightId, takeawayId });
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

export interface InsightTakeaway {
  insightId: string;
  takeawayId: string;
  takeaway: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    title: string;
    documentId: string;
    takeaway: string;
    concept: string;
    novelty: string;
    importance: string;
    monetization: string;
    categoryId: string | null;
  };
}

export interface Takeaway {
  id: string;
  title: string;
  takeaway: string;
  concept: string;
  novelty: string;
  importance: string;
  monetization: string;
  category: string | undefined;
}

export const getInsightTakeawaysSF = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ insightId: z.string() }))
  .handler(async ({ data: { insightId } }) => {
    const takeaways = await db.query.insightTakeaways.findMany({
      with: { takeaway: { with: { category: true } } },
      where: eq(schema.insightTakeaways.insightId, insightId),
    });

    return takeaways.map((takeaway) => ({
      id: takeaway.takeaway.id,
      title: takeaway.takeaway.title,
      takeaway: takeaway.takeaway.takeaway,
      concept: takeaway.takeaway.concept,
      noveltyScore: takeaway.takeaway.noveltyScore,
      importanceScore: takeaway.takeaway.importanceScore,
      monetizationScore: takeaway.takeaway.monetizationScore,
      category: takeaway.takeaway.category?.name,
    }));
  });
