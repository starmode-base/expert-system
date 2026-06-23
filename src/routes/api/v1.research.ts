import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { and, desc, eq, gte, isNotNull, lt, or } from "drizzle-orm";
import { db, schema } from "~/postgres/db";
import { authorizeApiRequest } from "~/server/quota";

const apiError = (message: string, status: number) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const APIRoute = createAPIFileRoute("/api/v1/research")({
  GET: async ({ request }) => {
    const auth = await authorizeApiRequest(request, "research");
    if (auth.type === "error") return auth.response;

    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor") ?? null;
    const limitRaw = url.searchParams.get("limit");
    const limitParam = limitRaw ? Number(limitRaw) : 4;
    if (limitRaw && isNaN(limitParam)) {
      return apiError("Invalid limit: must be a number", 400);
    }
    const limit = Math.min(Math.max(1, limitParam), 100);
    const dateParam = url.searchParams.get("date"); // YYYY-MM-DD

    let parsedCursor: { createdAt: string; id: string } | null = null;
    if (cursor) {
      try {
        const raw = JSON.parse(cursor);
        if (
          typeof raw !== "object" ||
          raw === null ||
          typeof (raw as Record<string, unknown>).createdAt !== "string" ||
          typeof (raw as Record<string, unknown>).id !== "string" ||
          isNaN(
            new Date(
              (raw as Record<string, unknown>).createdAt as string,
            ).getTime(),
          )
        ) {
          return apiError("Invalid cursor", 400);
        }
        parsedCursor = raw as { createdAt: string; id: string };
      } catch {
        return apiError("Invalid cursor", 400);
      }
    }

    let dateStart: Date | undefined;
    let dateEnd: Date | undefined;
    if (dateParam) {
      dateStart = new Date(`${dateParam}T00:00:00Z`);
      if (isNaN(dateStart.getTime())) {
        return apiError("Invalid date: expected YYYY-MM-DD", 400);
      }
      dateEnd = new Date(dateStart);
      dateEnd.setUTCDate(dateEnd.getUTCDate() + 1);
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
      columns: {
        id: true,
        title: true,
        summary: true,
        insight: true,
        research: true,
        createdAt: true,
        updatedAt: true,
      },
      with: {
        insightTakeaways: {
          columns: {},
          with: {
            takeaway: {
              columns: { id: true, title: true },
            },
          },
        },
      },
      where: and(
        isNotNull(schema.insights.insight),
        dateStart ? gte(schema.insights.createdAt, dateStart) : undefined,
        dateEnd ? lt(schema.insights.createdAt, dateEnd) : undefined,
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

    const items = pageItems.map(({ insightTakeaways, ...insight }) => ({
      ...insight,
      url: `https://expert-system.starmode.dev/insight/${insight.id}`,
      takeaways: insightTakeaways.map(({ takeaway }) => ({
        id: takeaway.id,
        title: takeaway.title,
      })),
    }));

    return json({ items, nextCursor });
  },
});
