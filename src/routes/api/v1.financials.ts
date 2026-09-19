import { createAPIFileRoute } from "@tanstack/react-start/api";
import { batchFinancialMetrics } from "~/server/public-api/financial-operations";
import { jsonInput, runRestOperation } from "~/server/public-api/rest";

export const APIRoute = createAPIFileRoute("/api/v1/financials")({
  POST: ({ request }) =>
    runRestOperation(request, batchFinancialMetrics, () => jsonInput(request)),
});
