import { createAPIFileRoute } from "@tanstack/react-start/api";
import { financialCatalog } from "~/server/public-api/financial-operations";
import { queryInput, runRestOperation } from "~/server/public-api/rest";

export const APIRoute = createAPIFileRoute("/api/v1/financials/metrics")({
  GET: ({ request }) =>
    runRestOperation(request, financialCatalog, () => queryInput(request)),
});
