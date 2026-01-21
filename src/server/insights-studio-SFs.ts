import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { authMiddleware } from "~/middleware/auth-middleware";
import { db, schema } from "~/postgres/db";
import type { InsightsItem } from "~/server/queries";
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

export const listInsightsSF = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return await db.query.insights.findMany({
      where: eq(schema.insights.userId, context.viewer.id),
      columns: { id: true, title: true, insight: true },
      orderBy: (insights, { desc }) => [desc(insights.createdAt)],
    });
  });

export const getInsightsSF = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.string()) // insightId
  .handler(
    async ({ context, data: insightId }): Promise<InsightsItem | null> => {
      const row = await db.query.insights.findFirst({
        where: and(
          eq(schema.insights.userId, context.viewer.id),
          eq(schema.insights.id, insightId),
        ),
        with: {
          insightReferences: {
            with: {
              takeawayReference: {
                with: { takeaway: { with: { document: true } } },
              },
            },
            orderBy: (insightReferences, { asc }) => [
              asc(insightReferences.insightReferenceNumber),
            ],
          },
        },
      });

      if (!row) {
        return null;
      }

      const { insightReferences, ...insight } = row;
      return {
        insight,
        insightReferences: insightReferences.map((refRow) => ({
          insightReferenceNumber: refRow.insightReferenceNumber,
          referenceId: refRow.referenceId,
          reference: refRow.takeawayReference.reference,
          documentTitle: refRow.takeawayReference.takeaway.document.title,
          documentSource: refRow.takeawayReference.takeaway.document.source,
          documentLink: refRow.takeawayReference.takeaway.document.link,
          documentPublicationDate:
            refRow.takeawayReference.takeaway.document.publicationDate,
        })),
      };
    },
  );

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
      data: { insightPrompt: takeaway.summary },
    });
  });
