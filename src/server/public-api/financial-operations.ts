import { z } from "zod";
import {
  FINANCIAL_CATALOG_VERSION,
  getPublicFinancialCatalog,
  isFinancialMetricId,
} from "~/server/financials/catalog";
import {
  FinancialApiError,
  invalidFinancialRequest,
} from "~/server/financials/errors";
import {
  getBatchFinancialMetrics,
  getCompanyFinancialCatalog,
  getSingleFinancialMetric,
} from "~/server/financials/service";
import {
  financialBatchSchema,
  financialLimitSchema,
  financialPeriodSchema,
} from "./financial-schema";
import { issueMessage, result, type Operation } from "./operation";

const limitSchema = z.coerce.number().pipe(financialLimitSchema);

function financialQuery(input: Record<string, unknown>, full = false) {
  const period = financialPeriodSchema.safeParse(input.period ?? "quarterly");
  if (!period.success)
    throw invalidFinancialRequest("period must be quarterly or annual");
  let limit = 8;
  if (full && input.limit !== undefined) {
    const parsed = limitSchema.safeParse(input.limit);
    if (!parsed.success)
      throw invalidFinancialRequest("limit must be an integer from 1 to 40");
    limit = parsed.data;
  }
  if (full && input.include !== undefined && input.include !== "provenance")
    throw invalidFinancialRequest("include must be provenance");
  return {
    period: period.data,
    limit,
    includeProvenance: full && input.include === "provenance",
  };
}
function symbolInput(input: Record<string, unknown>): string {
  if (typeof input.symbol !== "string")
    throw invalidFinancialRequest("symbol must be a string");
  return input.symbol;
}
function metricInput(value: unknown) {
  if (typeof value !== "string" || !isFinancialMetricId(value)) {
    throw new FinancialApiError(
      "METRIC_NOT_FOUND",
      `Unknown financial metric: ${String(value)}`,
      404,
    );
  }
  return value;
}
export const financialCatalog: Operation = {
  endpoint: "financials",
  structuredErrors: true,
  prepare: () => () =>
    result({
      catalogVersion: FINANCIAL_CATALOG_VERSION,
      metrics: getPublicFinancialCatalog(),
    }),
};
export const companyFinancialCatalog: Operation = {
  endpoint: "financials",
  structuredErrors: true,
  prepare(input) {
    const { period } = financialQuery(input);
    const symbol = symbolInput(input);
    return async () => result(await getCompanyFinancialCatalog(symbol, period));
  },
};
export const singleFinancialMetric: Operation = {
  endpoint: "financials",
  structuredErrors: true,
  prepare(input) {
    const metric = metricInput(input.metric);
    const options = financialQuery(input, true);
    const symbol = symbolInput(input);
    return async () =>
      result(await getSingleFinancialMetric(symbol, metric, options));
  },
};
export const batchFinancialMetrics: Operation = {
  endpoint: "financials",
  structuredErrors: true,
  prepare(input) {
    const parsed = financialBatchSchema.safeParse(input.body);
    if (!parsed.success)
      throw invalidFinancialRequest(issueMessage(parsed.error));
    const metrics = parsed.data.metrics.map(metricInput);
    return async () =>
      result(
        await getBatchFinancialMetrics(parsed.data.symbol, metrics, {
          period: parsed.data.period,
          limit: parsed.data.limit,
          includeProvenance: parsed.data.include === "provenance",
        }),
      );
  },
};
