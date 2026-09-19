import { createAPIFileRoute } from "@tanstack/react-start/api";
import { documentContent } from "~/server/public-api/research-operations";
import { queryInput, runRestOperation } from "~/server/public-api/rest";

export const APIRoute = createAPIFileRoute(
  "/api/v1/documents/$documentId/content",
)({
  GET: ({ request, params }) =>
    runRestOperation(request, documentContent, () => ({
      ...queryInput(request),
      documentId: params.documentId,
    })),
});
