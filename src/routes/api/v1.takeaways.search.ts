import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { authenticate } from "~/server/api-keys";
import {
  vectorTakeawaySearch,
  vectorTakeawaySearchTimeWeighted,
} from "~/server/vector-queries";

const apiError = (message: string, status: number) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const APIRoute = createAPIFileRoute("/api/v1/takeaways/search")({
  GET: async ({ request }) => {
    const userId = await authenticate(request);
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const url = new URL(request.url);
    const query = url.searchParams.get("query");
    if (!query) {
      return apiError("Missing required parameter: query", 400);
    }

    const limitRaw = url.searchParams.get("limit");
    const limitParam = limitRaw ? Number(limitRaw) : 10;
    if (limitRaw && isNaN(limitParam)) {
      return apiError("Invalid limit: must be a number", 400);
    }
    const limit = Math.min(Math.max(1, limitParam), 100);

    const recent = url.searchParams.get("recent") === "true";

    const results = recent
      ? await vectorTakeawaySearchTimeWeighted(query, { limit })
      : await vectorTakeawaySearch(query, limit);

    const items = results.map((result) => ({
      id: result.id,
      documentId: result.documentId,
      title: result.title,
      summary: result.summary,
    }));

    return json({ items });
  },
});
