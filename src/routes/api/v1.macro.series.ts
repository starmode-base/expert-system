import { createAPIFileRoute } from "@tanstack/react-start/api";
import { macroSeries } from "~/server/public-api/macro-operations";
import { queryInput, runRestOperation } from "~/server/public-api/rest";

export const APIRoute = createAPIFileRoute("/api/v1/macro/series")({
  GET: ({ request }) =>
    runRestOperation(request, macroSeries, () => queryInput(request)),
});
