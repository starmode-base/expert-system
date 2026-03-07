import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { db, schema } from "~/postgres/db";
import { resolveApiKey } from "~/server/api-keys";
import type { DocumentSelect } from "~/postgres/schema";

async function authenticate(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  return (await resolveApiKey(auth.slice(7).trim()))?.userId ?? null;
}

export const APIRoute = createAPIFileRoute("/api/v1/documents")({
  GET: async ({ request }) => {
    const userId = await authenticate(request);
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor") ?? null;
    const limitParam = Number(url.searchParams.get("limit") ?? "20");
    const limit = Math.min(Math.max(1, limitParam), 100);

    const parsedCursor = cursor
      ? (JSON.parse(cursor) as { publicationDate: string; id: string })
      : null;

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
            lt(schema.documents.id, parsedCursor.id),
          ),
        ),
      );
    }

    const rows = await db.query.documents.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [
        desc(schema.documents.publicationDate),
        desc(schema.documents.id),
      ],
      limit: limit + 1,
    });

    const hasMore = rows.length > limit;
    const pageItems = hasMore ? rows.slice(0, limit) : rows;
    const lastItem = pageItems[pageItems.length - 1];
    const nextCursor =
      hasMore && lastItem
        ? JSON.stringify({
            publicationDate: lastItem.publicationDate.toISOString(),
            id: lastItem.id,
          })
        : null;

    return json({ items: pageItems as DocumentSelect[], nextCursor });
  },
});
