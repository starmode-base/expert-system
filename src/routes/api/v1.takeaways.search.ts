import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { authorizeApiRequest } from "~/server/quota";
import { searchTakeawayPreviews } from "~/server/public-api/research";

const apiError = (message: string, status: number) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const APIRoute = createAPIFileRoute("/api/v1/takeaways/search")({
  GET: async ({ request }) => {
    const auth = await authorizeApiRequest(request, "takeaways.search");
    if (auth.type === "error") return auth.response;

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

    return json({
      items: await searchTakeawayPreviews(query, { limit, recent }),
    });
  },
});
