import { createAPIFileRoute } from "@tanstack/react-start/api";
import { authorizeApiRequest } from "~/server/quota";
import { listFredSeries } from "~/server/fred-data-api/catalog";

export const APIRoute = createAPIFileRoute("/api/v1/macro/series")({
  GET: async ({ request }) => {
    const auth = await authorizeApiRequest(request, "macro.series", {
      structuredErrors: true,
    });
    if (auth.type === "error") return auth.response;

    const query = new URL(request.url).searchParams.get("query") ?? undefined;
    return Response.json({ items: listFredSeries(query) });
  },
});
