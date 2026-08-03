import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { authorizeApiRequest } from "~/server/quota";
import {
  getDocumentsByIds,
  MAX_PUBLIC_IDS,
} from "~/server/public-api/research";

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

    if (ids.length > MAX_PUBLIC_IDS) {
      return apiError(`Maximum ${MAX_PUBLIC_IDS} IDs per request`, 400);
    }

    return json({ items: await getDocumentsByIds(ids) });
  },
});
