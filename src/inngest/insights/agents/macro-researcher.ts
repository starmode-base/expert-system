import { Agent, tool, type FunctionTool } from "@openai/agents";
import { z } from "zod";
import {
  fetchLatestFredObservations,
  fetchFredObservationsByDateRange,
  fetchFredSeriesMetadata,
  fetchMultipleFredSeries,
} from "../tool-functions/tools-fred";
import {
  fredSeriesIds,
  fredUnits,
  fredFrequencies,
  fredAggregationMethods,
} from "~/server/fred-data-api/fred-api";

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const fetchLatestFredObservationsParams = z.object({
  seriesId: z
    .enum(fredSeriesIds)
    .describe("FRED series identifier (e.g. GDPC1, UNRATE, CPIAUCSL)"),
  lastN: z
    .number()
    .int()
    .min(1)
    .describe("Number of most recent observations to return"),
  units: z
    .enum(fredUnits)
    .optional()
    .describe(
      "Value transformation: lin (levels), chg (change), pch (percent change), pc1 (% change from year ago), etc.",
    ),
  frequency: z
    .enum(fredFrequencies)
    .optional()
    .describe(
      "Aggregate to lower frequency: d (daily), w (weekly), m (monthly), q (quarterly), a (annual)",
    ),
  aggregationMethod: z
    .enum(fredAggregationMethods)
    .optional()
    .describe(
      "Aggregation method when changing frequency: avg (average), sum, eop (end of period)",
    ),
});

const fetchLatestFredObservationsTool: FunctionTool<
  unknown,
  typeof fetchLatestFredObservationsParams,
  Awaited<ReturnType<typeof fetchLatestFredObservations>>
> = tool({
  name: "fetchLatestFredObservations",
  description:
    "Fetch the latest N observations for a single FRED macro series (e.g. GDP, CPI, unemployment rate). Returns data newest-first.",
  parameters: fetchLatestFredObservationsParams,
  strict: true,
  execute: async (
    args: z.infer<typeof fetchLatestFredObservationsParams>,
  ) => {
    return await fetchLatestFredObservations(
      args.seriesId,
      args.lastN,
      args.units,
      args.frequency,
      args.aggregationMethod,
    );
  },
});

const fetchFredObservationsByDateRangeParams = z.object({
  seriesId: z
    .enum(fredSeriesIds)
    .describe("FRED series identifier (e.g. GDPC1, UNRATE, CPIAUCSL)"),
  observationStart: z
    .string()
    .describe("Start date in YYYY-MM-DD format"),
  observationEnd: z
    .string()
    .describe("End date in YYYY-MM-DD format"),
  units: z
    .enum(fredUnits)
    .optional()
    .describe(
      "Value transformation: lin (levels), chg (change), pch (percent change), pc1 (% change from year ago), etc.",
    ),
  frequency: z
    .enum(fredFrequencies)
    .optional()
    .describe(
      "Aggregate to lower frequency: d (daily), w (weekly), m (monthly), q (quarterly), a (annual)",
    ),
  aggregationMethod: z
    .enum(fredAggregationMethods)
    .optional()
    .describe(
      "Aggregation method when changing frequency: avg (average), sum, eop (end of period)",
    ),
});

const fetchFredObservationsByDateRangeTool: FunctionTool<
  unknown,
  typeof fetchFredObservationsByDateRangeParams,
  Awaited<ReturnType<typeof fetchFredObservationsByDateRange>>
> = tool({
  name: "fetchFredObservationsByDateRange",
  description:
    "Fetch FRED macro series observations within a specific date range. Use this when you need data for a precise time window.",
  parameters: fetchFredObservationsByDateRangeParams,
  strict: true,
  execute: async (
    args: z.infer<typeof fetchFredObservationsByDateRangeParams>,
  ) => {
    return await fetchFredObservationsByDateRange(
      args.seriesId,
      args.observationStart,
      args.observationEnd,
      args.units,
      args.frequency,
      args.aggregationMethod,
    );
  },
});

const fetchFredSeriesMetadataParams = z.object({
  seriesId: z
    .enum(fredSeriesIds)
    .describe("FRED series identifier to get metadata for"),
});

const fetchFredSeriesMetadataTool: FunctionTool<
  unknown,
  typeof fetchFredSeriesMetadataParams,
  Awaited<ReturnType<typeof fetchFredSeriesMetadata>>
> = tool({
  name: "fetchFredSeriesMetadata",
  description:
    "Fetch metadata for a FRED series including title, units, frequency, seasonal adjustment, and last updated date.",
  parameters: fetchFredSeriesMetadataParams,
  strict: true,
  execute: async (args: z.infer<typeof fetchFredSeriesMetadataParams>) => {
    return await fetchFredSeriesMetadata(args.seriesId);
  },
});

const fetchMultipleFredSeriesParams = z.object({
  seriesIds: z
    .array(z.enum(fredSeriesIds))
    .min(1)
    .describe(
      "Array of FRED series identifiers to fetch (e.g. [\"GDPC1\", \"UNRATE\", \"CPIAUCSL\"])",
    ),
  lastN: z
    .number()
    .int()
    .min(1)
    .describe("Number of most recent observations per series"),
  units: z
    .enum(fredUnits)
    .optional()
    .describe("Value transformation applied to all series"),
  frequency: z
    .enum(fredFrequencies)
    .optional()
    .describe("Frequency aggregation applied to all series"),
  aggregationMethod: z
    .enum(fredAggregationMethods)
    .optional()
    .describe("Aggregation method when changing frequency"),
});

const fetchMultipleFredSeriesTool: FunctionTool<
  unknown,
  typeof fetchMultipleFredSeriesParams,
  Awaited<ReturnType<typeof fetchMultipleFredSeries>>
> = tool({
  name: "fetchMultipleFredSeries",
  description:
    "Fetch latest observations for multiple FRED series at once. Use this to build a macro dashboard snapshot across GDP, inflation, employment, rates, and other indicators in a single call.",
  parameters: fetchMultipleFredSeriesParams,
  strict: true,
  execute: async (args: z.infer<typeof fetchMultipleFredSeriesParams>) => {
    return await fetchMultipleFredSeries(
      args.seriesIds,
      args.lastN,
      args.units,
      args.frequency,
      args.aggregationMethod,
    );
  },
});

export const fredTools = [
  fetchLatestFredObservationsTool,
  fetchFredObservationsByDateRangeTool,
  fetchFredSeriesMetadataTool,
  fetchMultipleFredSeriesTool,
];

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

const macroResearcherSystemPrompt = `
You are a macroeconomic research agent with access to FRED (Federal Reserve Economic Data). Follow this process:

1) Read the request and the objective. Identify the macro indicators, timeframe, and specific questions to answer.
2) Use these tools strategically:
   - fetchLatestFredObservations for recent data points on a single series (e.g. latest 12 months of CPI).
   - fetchFredObservationsByDateRange when you need data for a specific period (e.g. Q1 2020 to Q4 2023).
   - fetchMultipleFredSeries to pull a snapshot across several indicators at once (e.g. GDP + unemployment + inflation together).
   - fetchFredSeriesMetadata when you need to confirm units, frequency, or last-updated date.

3) Available series by category:

   GROWTH / REAL ECONOMY
   - GDPC1: Real GDP (quarterly) – overall economic output
   - INDPRO: Industrial Production Index (monthly) – manufacturing/output strength
   - TCU: Capacity Utilization (monthly) – how much productive capacity is in use
   - PCEC96: Real Personal Consumption Expenditures (monthly) – consumer spending in real terms
   - PNFIC1: Real Business Fixed Investment (quarterly) – nonresidential capex

   LABOR MARKET
   - UNRATE: Unemployment Rate (monthly) – labor market slack
   - CIVPART: Labor Force Participation Rate (monthly) – share of working-age population in labor force
   - EMRATIO: Employment-Population Ratio (monthly) – share of working-age population employed
   - PAYEMS: Nonfarm Payrolls (monthly) – job creation
   - ICSA: Initial Jobless Claims (weekly) – new unemployment filings
   - CCSA: Continuing Jobless Claims (weekly) – ongoing unemployment
   - JTSJOR: Job Openings Rate (monthly) – labor demand
   - JTSQUR: Quits Rate (monthly) – voluntary separations / worker confidence

   INFLATION / PRICES
   - CPIAUCSL: CPI All Items (monthly) – headline consumer inflation
   - CPILFESL: Core CPI ex Food & Energy (monthly) – underlying consumer inflation
   - PCEPI: PCE Price Index (monthly) – broad price measure
   - PCEPILFE: Core PCE ex Food & Energy (monthly) – Fed's preferred inflation gauge
   - PCETRIM1M158SFRBDAL: Trimmed Mean PCE (monthly) – Dallas Fed, strips outliers
   - MEDCPIM158SFRBCLE: Median CPI (monthly) – Cleveland Fed, median price change

   WAGES / INCOME
   - CES0500000003: Average Hourly Earnings (monthly) – wage growth
   - ECIALLCIV: Employment Cost Index (quarterly) – total compensation costs
   - DSPIC96: Real Disposable Personal Income (monthly) – after-tax purchasing power

   MONETARY POLICY / LIQUIDITY
   - FEDFUNDS: Fed Funds Rate, monthly average – policy rate
   - EFFR: Effective Federal Funds Rate, daily – overnight interbank rate
   - IORB: Interest on Reserve Balances (daily) – rate Fed pays on bank reserves
   - WALCL: Fed Total Assets (weekly) – balance sheet size
   - WRESBAL: Reserve Balances at Fed (weekly) – banking system liquidity
   - RRPONTSYD: Overnight Reverse Repo (daily) – money-market liquidity facility usage
   - M2SL: M2 Money Supply (monthly) – broad money

   RATES / YIELD CURVE
   - DGS2: 2-Year Treasury Yield (daily) – short-term rate expectations
   - DGS10: 10-Year Treasury Yield (daily) – long-term rate expectations
   - T10Y2Y: 10Y–2Y Treasury Spread (daily) – yield curve slope / recession signal
   - THREEFYTP10: 10-Year Term Premium (daily) – compensation for duration risk
   - T10YIE: 10-Year Breakeven Inflation Rate (daily) – market inflation expectations

   CREDIT / FINANCIAL STRESS
   - BAA10Y: Baa Corporate Spread over 10Y Treasury (daily) – investment-grade credit risk
   - BAMLH0A0HYM2: ICE BofA High Yield OAS (daily) – below-investment-grade credit risk
   - DRTSCILM: Senior Loan Officer Survey (quarterly) – bank lending standards
   - NFCI: Chicago Fed Financial Conditions Index (weekly) – financial stress composite
   - TOTBKCR: Bank Credit, All Commercial Banks (weekly) – total lending volume

   HOUSING
   - HOUST: Housing Starts (monthly) – new residential construction
   - PERMIT: Building Permits (monthly) – forward-looking construction indicator
   - EXHOSLUSM495S: Existing Home Sales (monthly) – resale market activity
   - CSUSHPINSA: Case-Shiller Home Price Index (monthly) – national home prices
   - MORTGAGE30US: 30-Year Fixed Mortgage Rate (weekly) – borrowing cost for homebuyers

   SENTIMENT
   - UMCSENT: Consumer Sentiment (monthly) – household confidence

4) Use the "units" parameter to request transformations:
   - "pch" for month-over-month or quarter-over-quarter percent change
   - "pc1" for year-over-year percent change
   - "lin" for raw levels (default)
5) After gathering data, synthesize how the numbers relate to the objective (trend direction, inflection points, divergences between indicators, policy implications). If data is unavailable, state that clearly.

Rules:
- Never make more than 5 tool calls at a time.
- If you need more data then take an additional turn to gather the data.
- Use fetchMultipleFredSeries when comparing indicators side-by-side to minimize tool calls.
- When analyzing inflation, prefer comparing headline vs core measures and checking trimmed mean / median for signal.
- When assessing labor market, compare UNRATE with CIVPART and EMRATIO for a fuller picture.
- When evaluating financial conditions, combine yield curve (T10Y2Y), credit spreads (BAA10Y, BAMLH0A0HYM2), and NFCI.
`;

const macroAnalysisSchema = z.object({
  Analysis: z
    .string()
    .describe(
      "Concise, objective macroeconomic analysis answering the request. DO NOT include any other text or commentary that is not directly related to or supported by the data.",
    ),
  "Supporting Data": z
    .string()
    .describe(
      "Key figures with periods and series identifiers that support the analysis. Just provide a list of the raw data.",
    ),
});

export function createMacroResearcherAgent() {
  return new Agent({
    name: "Macro Research Agent",
    instructions: macroResearcherSystemPrompt,
    model: "gpt-5.2",
    tools: fredTools,
    outputType: macroAnalysisSchema,
  });
}
