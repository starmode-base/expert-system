import { createAPIFileRoute } from "@tanstack/react-start/api";
import {
  parseFinancialQuery,
  runFinancialRoute,
} from "~/server/financials/http";
import { getCompanyFinancialCatalog } from "~/server/financials/service";

export const APIRoute = createAPIFileRoute(
  "/api/v1/financials/$symbol/metrics",
)({
  GET: ({ request, params }) =>
    runFinancialRoute(request, async () => {
      const { period } = parseFinancialQuery(request);
      return getCompanyFinancialCatalog(params.symbol, period);
    }),
});
