import { createAPIFileRoute } from "@tanstack/react-start/api";
import { searchTakeaways } from "~/server/public-api/research-operations";
import { queryInput, runRestOperation } from "~/server/public-api/rest";

export const APIRoute = createAPIFileRoute("/api/v1/takeaways/search")({
  GET: ({ request }) =>
    runRestOperation(request, searchTakeaways, () => queryInput(request)),
});
