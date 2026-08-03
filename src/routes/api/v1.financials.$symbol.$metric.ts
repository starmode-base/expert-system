import { createAPIFileRoute } from "@tanstack/react-start/api";
import { isFinancialMetricId } from "~/server/financials/catalog";
import { FinancialApiError } from "~/server/financials/errors";
import {
  parseFinancialQuery,
  runFinancialRoute,
} from "~/server/financials/http";
import {
  getCompanyFinancialCatalog,
  getSingleFinancialMetric,
} from "~/server/financials/service";

export const APIRoute = createAPIFileRoute(
  "/api/v1/financials/$symbol/$metric",
)({
  GET: ({ request, params }) =>
    runFinancialRoute(request, async () => {
      // TanStack Start 1.114.x ranks API routes only by segment count, so the
      // dynamic `$metric` route wins over the equally deep static `/metrics`
      // route. Treat `metrics` as a reserved path segment here to preserve the
      // documented company-catalog endpoint until route specificity is fixed.
      if (params.metric === "metrics") {
        const { period } = parseFinancialQuery(request);
        return getCompanyFinancialCatalog(params.symbol, period);
      }

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
