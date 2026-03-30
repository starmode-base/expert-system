import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { db } from "~/postgres/db";
import { authorizeApiRequest } from "~/server/quota";

const MAX_IDS = 50;

const apiError = (message: string, status: number) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const APIRoute = createAPIFileRoute("/api/v1/documents")({
  GET: async ({ request }) => {
    const auth = await authorizeApiRequest(request, "documents");
    if (auth.type === "error") return auth.response;

    const url = new URL(request.url);
    const idsParam = url.searchParams.get("ids");
    if (!idsParam) {
      return apiError("Missing required parameter: ids", 400);
    }

    const ids = idsParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      return apiError("No valid IDs provided", 400);
    }

    if (ids.length > MAX_IDS) {
      return apiError(`Maximum ${MAX_IDS} IDs per request`, 400);
    }

    const documents = await db.query.documents.findMany({
      where: (d, { inArray }) => inArray(d.id, ids),
    });

    // Preserve request order
    const orderMap = new Map(ids.map((id, i) => [id, i]));
    documents.sort(
      (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
    );

    return json({ items: documents });
  },
});
