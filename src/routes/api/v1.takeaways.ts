import { createAPIFileRoute } from "@tanstack/react-start/api";
import { takeaways } from "~/server/public-api/research-operations";
import { queryInput, runRestOperation } from "~/server/public-api/rest";

export const APIRoute = createAPIFileRoute("/api/v1/takeaways")({
  GET: ({ request }) =>
    runRestOperation(request, takeaways, () => queryInput(request)),
});
