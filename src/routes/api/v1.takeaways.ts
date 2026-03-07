import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { db, schema } from "~/postgres/db";
import { authenticate } from "~/server/api-keys";
import type { TakeawaySelect } from "~/postgres/schema";

export const APIRoute = createAPIFileRoute("/api/v1/takeaways")({
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

    let parsedCursor: { publicationDate: string; id: string } | null = null;
    if (cursor) {
      try {
        parsedCursor = JSON.parse(cursor) as {
          publicationDate: string;
          id: string;
        };
      } catch {
        return new Response("Invalid cursor", { status: 400 });
      }
    }

    const conditions = [];
    if (parsedCursor) {
      conditions.push(
        or(
          lt(
            schema.documents.publicationDate,
            new Date(parsedCursor.publicationDate),
          ),
          and(
            eq(
              schema.documents.publicationDate,
              new Date(parsedCursor.publicationDate),
            ),
            lt(schema.takeaways.id, parsedCursor.id),
          ),
        ),
      );
    }

    const idRows = await db
      .select({
        id: schema.takeaways.id,
        publicationDate: schema.documents.publicationDate,
      })
      .from(schema.takeaways)
      .innerJoin(
        schema.documents,
        eq(schema.takeaways.documentId, schema.documents.id),
      )
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        desc(schema.documents.publicationDate),
        desc(schema.takeaways.id),
      )
      .limit(limit + 1);

    const hasMore = idRows.length > limit;
    const pageIdRows = hasMore ? idRows.slice(0, limit) : idRows;

    if (pageIdRows.length === 0) {
      return json({ items: [], nextCursor: null });
    }

    const lastRow = pageIdRows[pageIdRows.length - 1];
    const nextCursor =
      hasMore && lastRow
        ? JSON.stringify({
            publicationDate: lastRow.publicationDate.toISOString(),
            id: lastRow.id,
          })
        : null;

    const ids = pageIdRows.map((r) => r.id);
    const takeaways = await db.query.takeaways.findMany({
      where: (t, { inArray }) => inArray(t.id, ids),
    });

    // Preserve sort order from step 1
    const orderMap = new Map(ids.map((id, i) => [id, i]));
    takeaways.sort(
      (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
    );

    return json({ items: takeaways as TakeawaySelect[], nextCursor });
  },
});
