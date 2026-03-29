import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "~/postgres/db";
import { authorizeApiRequest } from "~/server/quota";

const apiError = (message: string, status: number) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const APIRoute = createAPIFileRoute("/api/v1/takeaways/recent")({
  GET: async ({ request }) => {
    const auth = await authorizeApiRequest(request, "takeaways.recent");
    if (auth.type === "error") return auth.response;

    const url = new URL(request.url);
    const limitRaw = url.searchParams.get("limit");
    const limitParam = limitRaw ? Number(limitRaw) : 10;
    if (limitRaw && isNaN(limitParam)) {
      return apiError("Invalid limit: must be a number", 400);
    }
    const limit = Math.min(Math.max(1, limitParam), 100);

    const idRows = await db
      .select({
        id: schema.takeaways.id,
      })
      .from(schema.takeaways)
      .innerJoin(
        schema.documents,
        eq(schema.takeaways.documentId, schema.documents.id),
      )
      .orderBy(
        desc(schema.documents.publicationDate),
        desc(schema.takeaways.id),
      )
      .limit(limit);

    if (idRows.length === 0) {
      return json({ items: [] });
    }

    const ids = idRows.map((r) => r.id);
    const takeaways = await db.query.takeaways.findMany({
      columns: { id: true, documentId: true, title: true, summary: true },
      where: (t, { inArray }) => inArray(t.id, ids),
    });

    const orderMap = new Map(ids.map((id, i) => [id, i]));
    takeaways.sort(
      (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
    );

    return json({ items: takeaways });
  },
});
