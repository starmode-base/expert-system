import { createAPIFileRoute } from "@tanstack/react-start/api";
import { isFinancialMetricId } from "~/server/financials/catalog";
import { FinancialApiError } from "~/server/financials/errors";
import {
  parseFinancialQuery,
  runFinancialRoute,
} from "~/server/financials/http";
import { getSingleFinancialMetric } from "~/server/financials/service";

export const APIRoute = createAPIFileRoute(
  "/api/v1/financials/$symbol/$metric",
)({
  GET: ({ request, params }) =>
    runFinancialRoute(request, async () => {
      if (!isFinancialMetricId(params.metric)) {
        throw new FinancialApiError(
          "METRIC_NOT_FOUND",
          `Unknown financial metric: ${params.metric}`,
          404,
        );
      }
      const options = parseFinancialQuery(request, {
        includeLimit: true,
        includeProvenance: true,
      });
      return getSingleFinancialMetric(params.symbol, params.metric, options);
    }),
});
