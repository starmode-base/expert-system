import { createAPIFileRoute } from "@tanstack/react-start/api";
import { documents } from "~/server/public-api/research-operations";
import { queryInput, runRestOperation } from "~/server/public-api/rest";

export const APIRoute = createAPIFileRoute("/api/v1/documents")({
  GET: ({ request }) =>
    runRestOperation(request, documents, () => queryInput(request)),
});
