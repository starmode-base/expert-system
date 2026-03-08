// ---------------------------------------------------------------------------
// Query Financial Agent — lightweight natural-language → Alpha Vantage bridge.
//
// Same design as query-macro-agent: translate a question into tool calls, pass
// the raw results through. No analysis or prose — just structured data for
// machine consumers.
// ---------------------------------------------------------------------------

import { Agent } from "@openai/agents";
import { z } from "zod";
import { financialTools } from "./financial-analyst";

const queryFinancialSystemPrompt = `
You have access to company financial data tools. Translate the user's question into the appropriate tool calls, then return the raw data from those calls. Do not interpret, analyze, or editorialize — just organize the tool results into structured objects.

Available tools:
- fetchCompanyOverviewByMetric: Get company overview metrics (sector, market cap, beta, etc.)
- fetchLatestIncomeStatementByMetric: Get quarterly income statement data (revenue, EPS, net income, margins, etc.)
- fetchLatestBalanceSheetByMetric: Get quarterly balance sheet data (cash, debt, current ratio, etc.)
- fetchLatestCashFlowByMetric: Get quarterly cash flow data (operating cash flow, free cash flow, etc.)

Rules:
- Never make more than 5 tool calls at a time.
- If you need more data then take an additional turn.
`;

// See query-macro-agent.ts for rationale on why `data` is a JSON string rather
// than a native object (OpenAI structured outputs constraint).
const queryFinancialOutputSchema = z.object({
  data: z
    .string()
    .describe(
      "JSON-serialized array of result objects from tool calls. Each object should contain the raw data returned by a tool, preserving its original structure (e.g. symbol, metric, quarterly reports). Must be valid JSON.",
    ),
  tickersQueried: z
    .array(z.string())
    .describe("List of ticker symbols that were queried."),
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
