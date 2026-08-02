import { createAPIFileRoute } from "@tanstack/react-start/api";
import {
  FINANCIAL_CATALOG_VERSION,
  getPublicFinancialCatalog,
} from "~/server/financials/catalog";
import { runFinancialRoute } from "~/server/financials/http";

export const APIRoute = createAPIFileRoute("/api/v1/financials/metrics")({
  GET: ({ request }) =>
    runFinancialRoute(request, () => ({
      catalogVersion: FINANCIAL_CATALOG_VERSION,
      metrics: getPublicFinancialCatalog(),
    })),
});
