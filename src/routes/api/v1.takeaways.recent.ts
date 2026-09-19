import { createAPIFileRoute } from "@tanstack/react-start/api";
import { recentTakeaways } from "~/server/public-api/research-operations";
import { queryInput, runRestOperation } from "~/server/public-api/rest";

export const APIRoute = createAPIFileRoute("/api/v1/takeaways/recent")({
  GET: ({ request }) =>
    runRestOperation(request, recentTakeaways, () => queryInput(request)),
});
