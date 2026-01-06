//--------------------------------
// Tools
//--------------------------------

import { Agent, tool, type FunctionTool } from "@openai/agents";
import { z } from "zod";
import {
  fetchCompanyOverviewByMetric,
  fetchLatestBalanceSheetByMetric,
  fetchLatestCashFlowByMetric,
  fetchLatestIncomeStatementByMetric,
  fetchLatestTreasuryYield,
} from "../tool-functions/tools-financial";
import {
  balanceSheetReportMetrics,
  cashFlowReportMetrics,
  companyOverviewMetrics,
  incomeStatementReportMetrics,
} from "~/server/financial-data-api/alpha-vantage-api";

const treasuryYieldIntervalOptions = ["daily", "weekly", "monthly"] as const;

const treasuryYieldMaturityOptions = [
  "3month",
  "2year",
  "5year",
  "7year",
  "10year",
  "30year",
] as const;

const fetchCompanyOverviewByMetricParams = z.object({
  symbol: z.string().describe("Ticker symbol to look up"),
  metric: z
    .enum(companyOverviewMetrics)
    .describe("Company overview metric key to return"),
});

const fetchCompanyOverviewByMetricTool: FunctionTool<
  unknown,
  typeof fetchCompanyOverviewByMetricParams,
  Awaited<ReturnType<typeof fetchCompanyOverviewByMetric>>
> = tool({
  name: "fetchCompanyOverviewByMetric",
  description:
    "Fetch a single company overview metric for the provided ticker symbol",
  parameters: fetchCompanyOverviewByMetricParams,
  strict: true,
  execute: async (args: z.infer<typeof fetchCompanyOverviewByMetricParams>) => {
    return await fetchCompanyOverviewByMetric(args.symbol, args.metric);
  },
});

const fetchLatestIncomeStatementByMetricParams = z.object({
  symbol: z.string().describe("Ticker symbol to look up"),
  lastNQuarters: z
    .number()
    .int()
    .min(1)
    .describe("Number of most recent quarters to include"),
  metrics: z
    .array(z.enum(incomeStatementReportMetrics))
    .min(1)
    .describe(
      "Income statement metric keys to extract from the quarterly reports",
    ),
});

const fetchLatestIncomeStatementByMetricTool: FunctionTool<
  unknown,
  typeof fetchLatestIncomeStatementByMetricParams,
  Awaited<ReturnType<typeof fetchLatestIncomeStatementByMetric>>
> = tool({
  name: "fetchLatestIncomeStatementByMetric",
  description:
    "Fetch recent quarterly income statement metrics keyed by fiscal period end date",
  parameters: fetchLatestIncomeStatementByMetricParams,
  strict: true,
  execute: async (
    args: z.infer<typeof fetchLatestIncomeStatementByMetricParams>,
  ) => {
    return await fetchLatestIncomeStatementByMetric(
      args.symbol,
      args.lastNQuarters,
      args.metrics,
    );
  },
});

const fetchLatestBalanceSheetByMetricParams = z.object({
  symbol: z.string().describe("Ticker symbol to look up"),
  lastNQuarters: z
    .number()
    .int()
    .min(1)
    .describe("Number of most recent quarters to include"),
  metrics: z
    .array(z.enum(balanceSheetReportMetrics))
    .min(1)
    .describe(
      "Balance sheet metric keys to extract from the quarterly reports",
    ),
});

const fetchLatestBalanceSheetByMetricTool: FunctionTool<
  unknown,
  typeof fetchLatestBalanceSheetByMetricParams,
  Awaited<ReturnType<typeof fetchLatestBalanceSheetByMetric>>
> = tool({
  name: "fetchLatestBalanceSheetByMetric",
  description:
    "Fetch recent quarterly balance sheet metrics keyed by fiscal period end date",
  parameters: fetchLatestBalanceSheetByMetricParams,
  strict: true,
  execute: async (
    args: z.infer<typeof fetchLatestBalanceSheetByMetricParams>,
  ) => {
    return await fetchLatestBalanceSheetByMetric(
      args.symbol,
      args.lastNQuarters,
      args.metrics,
    );
  },
});

const fetchLatestCashFlowByMetricParams = z.object({
  symbol: z.string().describe("Ticker symbol to look up"),
  lastNQuarters: z
    .number()
    .int()
    .min(1)
    .describe("Number of most recent quarters to include"),
  metrics: z
    .array(z.enum(cashFlowReportMetrics))
    .min(1)
    .describe("Cash flow metric keys to extract from the quarterly reports"),
});

const fetchLatestCashFlowByMetricTool: FunctionTool<
  unknown,
  typeof fetchLatestCashFlowByMetricParams,
  Awaited<ReturnType<typeof fetchLatestCashFlowByMetric>>
> = tool({
  name: "fetchLatestCashFlowByMetric",
  description:
    "Fetch recent quarterly cash flow metrics keyed by fiscal period end date",
  parameters: fetchLatestCashFlowByMetricParams,
  strict: true,
  execute: async (args: z.infer<typeof fetchLatestCashFlowByMetricParams>) => {
    return await fetchLatestCashFlowByMetric(
      args.symbol,
      args.lastNQuarters,
      args.metrics,
    );
  },
});

const fetchLatestTreasuryYieldParams = z.object({
  interval: z
    .enum(treasuryYieldIntervalOptions)
    .describe("Frequency of the treasury yield data points"),
  maturity: z
    .enum(treasuryYieldMaturityOptions)
    .describe("Maturity of the treasury yield to retrieve"),
  lastNPoints: z
    .number()
    .int()
    .min(1)
    .describe("Number of most recent data points to include"),
});

const fetchLatestTreasuryYieldTool: FunctionTool<
  unknown,
  typeof fetchLatestTreasuryYieldParams,
  Awaited<ReturnType<typeof fetchLatestTreasuryYield>>
> = tool({
  name: "fetchLatestTreasuryYield",
  description:
    "Fetch the most recent treasury yield data points for the given maturity and interval",
  parameters: fetchLatestTreasuryYieldParams,
  strict: true,
  execute: async (args: z.infer<typeof fetchLatestTreasuryYieldParams>) => {
    return await fetchLatestTreasuryYield(
      args.interval,
      args.maturity,
      args.lastNPoints,
    );
  },
});

export const financialTools = [
  fetchCompanyOverviewByMetricTool,
  fetchLatestIncomeStatementByMetricTool,
  fetchLatestBalanceSheetByMetricTool,
  fetchLatestCashFlowByMetricTool,
  fetchLatestTreasuryYieldTool,
];

//--------------------------------
// Agent
//--------------------------------

const financialAnalysisSystemPrompt = `
You are a financial analysis agent. Follow this process:
1) Read the request and the objective. Identify the tickers, timeframe, and specific questions to answer.
2) Use:
   - fetchCompanyOverviewByMetric for static company facts (e.g., sector, market cap, beta).
   - fetchLatestIncomeStatementByMetric for quarterly P&L metrics (e.g., revenue, EPS, net income, margins).
   - fetchLatestBalanceSheetByMetric for balance sheet strength (e.g., cash, debt, current ratio).
   - fetchLatestCashFlowByMetric for cash generation (e.g., operating cash flow, free cash flow).
   - fetchLatestTreasuryYield for risk-free rate context (set interval/maturity appropriately).
3) Keep queries tight.
4) When unsure which metrics matter, default to revenue, net income, EPS, gross/operating margin, operating cash flow, free cash flow, total debt, cash, interest expense, and relevant treasury yields.
5) After gathering data, synthesize how the numbers relate to the objective (trend direction, growth, liquidity, leverage, cash generation). If data is unavailable, state that clearly.

Rules:
- Never make more than 5 tool calls at a time.
- If you need more data then take an additional turn to gather the data.
`;

const financialAnalysisSchema = z.object({
  Analysis: z
    .string()
    .describe(
      "Concise, objective financial analysis answering the request. DO NOT include any other text or commentary that is not directly related to or supported by the data.",
    ),
  "Supporting Data": z
    .string()
    .describe(
      "Key figures with periods/tickers that support the analysis. Just provide a list of the raw data.",
    ),
});

export function createFinancialAnalysisAgent() {
  return new Agent({
    name: "Financial Analysis Agent",
    instructions: financialAnalysisSystemPrompt,
    model: "gpt-5.2",
    tools: financialTools,
    outputType: financialAnalysisSchema,
  });
}
