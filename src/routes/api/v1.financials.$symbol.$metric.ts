import { createAPIFileRoute } from "@tanstack/react-start/api";
import {
  companyFinancialCatalog,
  singleFinancialMetric,
} from "~/server/public-api/financial-operations";
import { queryInput, runRestOperation } from "~/server/public-api/rest";

export const APIRoute = createAPIFileRoute(
  "/api/v1/financials/$symbol/$metric",
)({
  GET: ({ request, params }) =>
    // TanStack Start 1.114.x ranks by segment count: keep the reserved catalog
    // segment here because the dynamic route wins over an equally deep static route.
    runRestOperation(
      request,
      params.metric === "metrics"
        ? companyFinancialCatalog
        : singleFinancialMetric,
      () => ({ ...queryInput(request), ...params }),
    ),
});
