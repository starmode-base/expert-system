import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { and, desc, eq, isNotNull, lt, or } from "drizzle-orm";
import { db, schema } from "~/postgres/db";
import { authenticate } from "~/server/api-keys";
import type { InsightSelect } from "~/postgres/schema";

export const APIRoute = createAPIFileRoute("/api/v1/insights")({
  GET: async ({ request }) => {
    const userId = await authenticate(request);
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor") ?? null;
    const limitRaw = url.searchParams.get("limit");
    const limitParam = limitRaw ? Number(limitRaw) : 20;
    const limit = Math.min(Math.max(1, limitParam), 100);

    let parsedCursor: { createdAt: string; id: string } | null = null;
    if (cursor) {
      try {
        parsedCursor = JSON.parse(cursor) as { createdAt: string; id: string };
      } catch {
        return new Response("Invalid cursor", { status: 400 });
      }
    }

    const cursorCondition = parsedCursor
      ? or(
          lt(schema.insights.createdAt, new Date(parsedCursor.createdAt)),
          and(
            eq(schema.insights.createdAt, new Date(parsedCursor.createdAt)),
            lt(schema.insights.id, parsedCursor.id),
          ),
        )
      : undefined;

    const rows = await db.query.insights.findMany({
      where: and(
        eq(schema.insights.userId, userId),
        isNotNull(schema.insights.insight),
        cursorCondition,
      ),
      orderBy: [desc(schema.insights.createdAt), desc(schema.insights.id)],
      limit: limit + 1,
    });

    const hasMore = rows.length > limit;
    const pageItems = hasMore ? rows.slice(0, limit) : rows;
    const lastItem = pageItems[pageItems.length - 1];
    const nextCursor =
      hasMore && lastItem
        ? JSON.stringify({
            createdAt: lastItem.createdAt.toISOString(),
            id: lastItem.id,
          })
        : null;

    return json({ items: pageItems as InsightSelect[], nextCursor });
  },
});
