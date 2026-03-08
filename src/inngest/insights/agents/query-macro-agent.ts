// ---------------------------------------------------------------------------
// Query Macro Agent — lightweight natural-language → FRED data bridge.
//
// Designed for machine consumers (e.g. OpenClaw). The agent's only job is to
// translate a question into the right FRED tool calls and pass the raw results
// through. No analysis or prose — just structured data.
//
// Lives alongside the other insight agents (macro-researcher, financial-analyst)
// because it reuses their tool definitions. The API route is the HTTP boundary;
// the agent logic stays with the rest of the agent code.
// ---------------------------------------------------------------------------

import { Agent } from "@openai/agents";
import { z } from "zod";
import { fredTools } from "./macro-researcher";

const queryMacroSystemPrompt = `
You have access to FRED (Federal Reserve Economic Data) tools. Translate the user's question into the appropriate tool calls, then return the raw data from those calls. Do not interpret, analyze, or editorialize — just organize the tool results into structured objects.

Available series by category:

GROWTH / REAL ECONOMY
- GDPC1: Real GDP (quarterly)
- INDPRO: Industrial Production Index (monthly)
- TCU: Capacity Utilization (monthly)
- PCEC96: Real Personal Consumption Expenditures (monthly)
- PNFIC1: Real Business Fixed Investment (quarterly)

LABOR MARKET
- UNRATE: Unemployment Rate (monthly)
- CIVPART: Labor Force Participation Rate (monthly)
- EMRATIO: Employment-Population Ratio (monthly)
- PAYEMS: Nonfarm Payrolls (monthly)
- ICSA: Initial Jobless Claims (weekly)
- CCSA: Continuing Jobless Claims (weekly)
- JTSJOR: Job Openings Rate (monthly)
- JTSQUR: Quits Rate (monthly)

INFLATION / PRICES
- CPIAUCSL: CPI All Items (monthly)
- CPILFESL: Core CPI ex Food & Energy (monthly)
- PCEPI: PCE Price Index (monthly)
- PCEPILFE: Core PCE ex Food & Energy (monthly)
- PCETRIM1M158SFRBDAL: Trimmed Mean PCE (monthly)
- MEDCPIM158SFRBCLE: Median CPI (monthly)

WAGES / INCOME
- CES0500000003: Average Hourly Earnings (monthly)
- ECIALLCIV: Employment Cost Index (quarterly)
- DSPIC96: Real Disposable Personal Income (monthly)

MONETARY POLICY / LIQUIDITY
- FEDFUNDS: Fed Funds Rate (monthly average)
- EFFR: Effective Federal Funds Rate (daily)
- IORB: Interest on Reserve Balances (daily)
- WALCL: Fed Total Assets (weekly)
- WRESBAL: Reserve Balances at Fed (weekly)
- RRPONTSYD: Overnight Reverse Repo (daily)
- M2SL: M2 Money Supply (monthly)

RATES / YIELD CURVE
- DGS2: 2-Year Treasury Yield (daily)
- DGS10: 10-Year Treasury Yield (daily)
- T10Y2Y: 10Y–2Y Treasury Spread (daily)
- THREEFYTP10: 10-Year Term Premium (daily)
- T10YIE: 10-Year Breakeven Inflation Rate (daily)

CREDIT / FINANCIAL STRESS
- BAA10Y: Baa Corporate Spread over 10Y Treasury (daily)
- BAMLH0A0HYM2: ICE BofA High Yield OAS (daily)
- DRTSCILM: Senior Loan Officer Survey (quarterly)
- NFCI: Chicago Fed Financial Conditions Index (weekly)
- TOTBKCR: Bank Credit, All Commercial Banks (weekly)

HOUSING
- HOUST: Housing Starts (monthly)
- PERMIT: Building Permits (monthly)
- EXHOSLUSM495S: Existing Home Sales (monthly)
- CSUSHPINSA: Case-Shiller Home Price Index (monthly)
- MORTGAGE30US: 30-Year Fixed Mortgage Rate (weekly)

SENTIMENT
- UMCSENT: Consumer Sentiment (monthly)

Rules:
- Never make more than 5 tool calls at a time.
- If you need more data then take an additional turn.
`;

// Output schema: `data` is a JSON string, not a native object, because OpenAI
// structured outputs requires all object fields to be statically known. Since
// tool results have variable shapes (observations vs metadata vs multi-series),
// we serialize to a string here and JSON.parse it in the route handler so the
// API consumer receives real structured JSON. If the agent produces malformed
// JSON, the route falls back to returning the raw string — degraded but not
// broken.
const queryMacroOutputSchema = z.object({
  data: z
    .string()
    .describe(
      "JSON-serialized array of result objects from tool calls. Each object should contain the raw data returned by a tool, preserving its original structure (e.g. seriesId, observations, metadata). Must be valid JSON.",
    ),
  seriesQueried: z
    .array(z.string())
    .describe("List of FRED series IDs that were queried."),
});

export function createQueryMacroAgent() {
  return new Agent({
    name: "Query Macro Agent",
    instructions: queryMacroSystemPrompt,
    model: "gpt-5-mini",
    tools: fredTools,
    outputType: queryMacroOutputSchema,
  });
}
