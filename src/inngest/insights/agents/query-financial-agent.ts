import { Agent } from "@openai/agents";
import { z } from "zod";
import { financialTools } from "./financial-analyst";

const queryFinancialSystemPrompt = `
You have access to company financial data tools. Answer the user's question by calling the appropriate tools. Return the data.

Available tools:
- fetchCompanyOverviewByMetric: Get company overview metrics (sector, market cap, beta, etc.)
- fetchLatestIncomeStatementByMetric: Get quarterly income statement data (revenue, EPS, net income, margins, etc.)
- fetchLatestBalanceSheetByMetric: Get quarterly balance sheet data (cash, debt, current ratio, etc.)
- fetchLatestCashFlowByMetric: Get quarterly cash flow data (operating cash flow, free cash flow, etc.)

Rules:
- Never make more than 5 tool calls at a time.
- If you need more data then take an additional turn.
`;

const queryFinancialOutputSchema = z.object({
  Analysis: z
    .string()
    .describe(
      "Concise, objective financial analysis answering the question. Only include information directly supported by the data.",
    ),
  "Supporting Data": z
    .string()
    .describe(
      "Key figures with periods/tickers that support the analysis. Just provide a list of the raw data.",
    ),
});

export function createQueryFinancialAgent() {
  return new Agent({
    name: "Query Financial Agent",
    instructions: queryFinancialSystemPrompt,
    model: "gpt-5-mini",
    tools: financialTools,
    outputType: queryFinancialOutputSchema,
  });
}
