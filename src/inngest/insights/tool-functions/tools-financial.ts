// Search Ticker

import {
  companyOverviewMetrics,
  fetchBalanceSheet,
  fetchCompanyOverview,
  fetchIncomeStatement,
  IncomeStatementReport,
  incomeStatementReportMetrics,
  BalanceSheetReport,
  balanceSheetReportMetrics,
  CashFlowReport,
  fetchCashFlow,
  cashFlowReportMetrics,
} from "~/server/financial-data-api/alpha-vantage-api";

/**
 * Fetch a single company overview metric for the provided ticker symbol.
 *
 * @param symbol Ticker symbol to look up.
 * @param metric Metric key to return; constrained to `companyOverviewMetrics` derived from the Alpha Vantage company overview schema keys.
 * @returns The requested metric value from the company overview response.
 */
export async function fetchCompanyOverviewByMetric(
  symbol: string,
  metric: (typeof companyOverviewMetrics)[number],
) {
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const overview = await fetchCompanyOverview(symbol);

  if (!overview) {
    return null;
  }

  return overview[metric];
}

/**
 * Fetch the most recent income statement quarterly reports and extract selected metrics keyed by fiscal period end date.
 *
 * @param symbol Ticker symbol to look up.
 * @param lastNQuarters Number of most recent quarters to include from the API response (newest first).
 * @param metrics Metric keys to extract; see `incomeStatementReportMetrics` derived from the Alpha Vantage income statement schema keys.
 * @returns Map keyed by `fiscalDateEnding`, with each requested metric as a string or null when unavailable.
 */
export async function fetchLatestIncomeStatementByMetric(
  symbol: string,
  lastNQuarters: number,
  metrics: (typeof incomeStatementReportMetrics)[number][],
) {
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const income = await fetchIncomeStatement(symbol);

  const quarterlyReports = income.quarterlyReports.slice(0, lastNQuarters);

  return quarterlyReports.reduce<
    Record<string, Partial<IncomeStatementReport>>
  >((accumulator, report) => {
    const metricValues = metrics.reduce<
      Partial<Record<keyof IncomeStatementReport, string | null>>
    >((metricAccumulator, metric) => {
      metricAccumulator[metric] = report[metric] ?? null;
      return metricAccumulator;
    }, {});

    accumulator[report.fiscalDateEnding] = metricValues;
    return accumulator;
  }, {});
}

/**
 * Fetch the most recent balance sheet quarterly reports and extract selected metrics keyed by fiscal period end date.
 *
 * @param symbol Ticker symbol to look up.
 * @param lastNQuarters Number of most recent quarters to include from the API response (newest first).
 * @param metrics Metric keys to extract; see `balanceSheetReportMetrics` derived from the Alpha Vantage balance sheet schema keys.
 * @returns Map keyed by `fiscalDateEnding`, with each requested metric as a string or null when unavailable.
 */
export async function fetchLatestBalanceSheetByMetric(
  symbol: string,
  lastNQuarters: number,
  metrics: (typeof balanceSheetReportMetrics)[number][],
) {
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const balanceSheet = await fetchBalanceSheet(symbol);
  return balanceSheet.quarterlyReports
    .slice(0, lastNQuarters)
    .reduce<
      Record<string, Partial<BalanceSheetReport>>
    >((accumulator, report) => {
      const metricValues = metrics.reduce<
        Partial<Record<keyof BalanceSheetReport, string | null>>
      >((metricAccumulator, metric) => {
        metricAccumulator[metric] = report[metric] ?? null;
        return metricAccumulator;
      }, {});

      accumulator[report.fiscalDateEnding] = metricValues;
      return accumulator;
    }, {});
}

/**
 * Fetch the most recent cash flow quarterly reports and extract selected metrics keyed by fiscal period end date.
 *
 * @param symbol Ticker symbol to look up.
 * @param lastNQuarters Number of most recent quarters to include from the API response (newest first).
 * @param metrics Metric keys to extract; see `cashFlowReportMetrics` derived from the Alpha Vantage cash flow schema keys.
 * @returns Map keyed by `fiscalDateEnding`, with each requested metric as a string or null when unavailable.
 */
export async function fetchLatestCashFlowByMetric(
  symbol: string,
  lastNQuarters: number,
  metrics: (typeof cashFlowReportMetrics)[number][],
) {
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const cashFlow = await fetchCashFlow(symbol);
  return cashFlow.quarterlyReports
    .slice(0, lastNQuarters)
    .reduce<Record<string, Partial<CashFlowReport>>>((accumulator, report) => {
      const metricValues = metrics.reduce<
        Partial<Record<keyof CashFlowReport, string | null>>
      >((metricAccumulator, metric) => {
        metricAccumulator[metric] = report[metric] ?? null;
        return metricAccumulator;
      }, {});

      accumulator[report.fiscalDateEnding] = metricValues;
      return accumulator;
    }, {});
}
