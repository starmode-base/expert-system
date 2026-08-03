import { ensureEnv } from "~/lib/env";
import { z } from "zod";

const FRED_API_BASE_URL = "https://api.stlouisfed.org/fred";

// ---------------------------------------------------------------------------
// Series ID registry – comprehensive macro indicator coverage
// ---------------------------------------------------------------------------

export const fredSeriesIds = [
  // ── Growth / Real Economy ──
  "GDPC1", // Real GDP (quarterly, SAAR)
  "INDPRO", // Industrial Production Index (monthly, SA)
  "TCU", // Capacity Utilization (monthly, SA)
  "PCEC96", // Real Personal Consumption Expenditures (monthly, SA)
  "PNFIC1", // Real Private Nonresidential Fixed Investment (quarterly, SAAR)

  // ── Labor Market ──
  "UNRATE", // Unemployment Rate (monthly, SA)
  "CIVPART", // Labor Force Participation Rate (monthly, SA)
  "EMRATIO", // Employment-Population Ratio (monthly, SA)
  "PAYEMS", // Total Nonfarm Payrolls (monthly, SA)
  "ICSA", // Initial Jobless Claims (weekly, SA)
  "CCSA", // Continuing Jobless Claims (weekly, SA)
  "JTSJOR", // Job Openings Rate (monthly, SA)
  "JTSQUR", // Quits Rate (monthly, SA)

  // ── Inflation / Prices ──
  "CPIAUCSL", // CPI All Urban Consumers (monthly, SA)
  "CPILFESL", // Core CPI ex Food & Energy (monthly, SA)
  "PCEPI", // PCE Price Index (monthly, SA)
  "PCEPILFE", // Core PCE ex Food & Energy (monthly, SA)
  "PCETRIM1M158SFRBDAL", // Trimmed Mean PCE – Dallas Fed (monthly)
  "MEDCPIM158SFRBCLE", // Median CPI – Cleveland Fed (monthly)

  // ── Wages / Income ──
  "CES0500000003", // Average Hourly Earnings, Total Private (monthly, SA)
  "ECIALLCIV", // Employment Cost Index, Total Compensation (quarterly, SA)
  "DSPIC96", // Real Disposable Personal Income (monthly, SA)

  // ── Monetary Policy / Liquidity ──
  "FEDFUNDS", // Effective Federal Funds Rate – monthly average
  "EFFR", // Effective Federal Funds Rate – daily
  "IORB", // Interest on Reserve Balances (daily)
  "WALCL", // Fed Total Assets / Balance Sheet (weekly, Wed)
  "WRESBAL", // Reserve Balances at Federal Reserve Banks (weekly)
  "RRPONTSYD", // Overnight Reverse Repo (daily)
  "M2SL", // M2 Money Supply (monthly, SA)

  // ── Rates / Yield Curve ──
  "DGS2", // 2-Year Treasury Yield (daily)
  "DGS10", // 10-Year Treasury Yield (daily)
  "T10Y2Y", // 10Y–2Y Treasury Spread (daily)
  "THREEFYTP10", // 10-Year Term Premium – Kim-Wright model (daily)
  "T10YIE", // 10-Year Breakeven Inflation Rate (daily)

  // ── Credit / Financial Stress ──
  "BAA10Y", // Baa Corporate Bond Spread over 10-Year Treasury (daily)
  "BAMLH0A0HYM2", // ICE BofA High Yield OAS (daily)
  "DRTSCILM", // Senior Loan Officer Survey: C&I Lending Standards (quarterly)
  "NFCI", // Chicago Fed National Financial Conditions Index (weekly)
  "TOTBKCR", // Bank Credit, All Commercial Banks (weekly, SA)

  // ── Housing ──
  "HOUST", // Housing Starts (monthly, SAAR)
  "PERMIT", // Building Permits (monthly, SAAR)
  "EXHOSLUSM495S", // Existing Home Sales (monthly, SAAR)
  "CSUSHPINSA", // S&P Case-Shiller National Home Price Index (monthly, NSA)
  "MORTGAGE30US", // 30-Year Fixed Rate Mortgage Average (weekly)

  // ── Sentiment ──
  "UMCSENT", // University of Michigan Consumer Sentiment (monthly)
] as const;

export type FredSeriesId = (typeof fredSeriesIds)[number];

export const fredSeriesDescriptions: Record<FredSeriesId, string> = {
  // Growth / Real Economy
  GDPC1: "Real Gross Domestic Product (billions of chained 2017 dollars, SAAR)",
  INDPRO: "Industrial Production: Total Index (2017=100)",
  TCU: "Capacity Utilization: Total Industry (%)",
  PCEC96:
    "Real Personal Consumption Expenditures (billions of chained 2017 dollars)",
  PNFIC1:
    "Real Private Nonresidential Fixed Investment (billions of chained 2017 dollars, SAAR)",

  // Labor Market
  UNRATE: "Civilian Unemployment Rate (%)",
  CIVPART: "Labor Force Participation Rate (%)",
  EMRATIO: "Employment-Population Ratio (%)",
  PAYEMS: "All Employees, Total Nonfarm (thousands of persons)",
  ICSA: "Initial Jobless Claims (persons, SA)",
  CCSA: "Continued Claims / Insured Unemployment (persons, SA)",
  JTSJOR: "Job Openings Rate: Total Nonfarm (%)",
  JTSQUR: "Quits Rate: Total Nonfarm (%)",

  // Inflation / Prices
  CPIAUCSL:
    "Consumer Price Index for All Urban Consumers: All Items (1982-84=100)",
  CPILFESL:
    "Consumer Price Index: All Items Less Food and Energy (1982-84=100)",
  PCEPI: "Personal Consumption Expenditures: Chain-type Price Index (2017=100)",
  PCEPILFE:
    "Personal Consumption Expenditures Excluding Food and Energy: Chain-type Price Index (2017=100)",
  PCETRIM1M158SFRBDAL:
    "Trimmed Mean PCE Inflation Rate – Dallas Fed (% change, annualized)",
  MEDCPIM158SFRBCLE:
    "Median Consumer Price Index – Cleveland Fed (% change, annualized)",

  // Wages / Income
  CES0500000003:
    "Average Hourly Earnings of All Employees, Total Private ($/hour)",
  ECIALLCIV:
    "Employment Cost Index: Total Compensation, All Civilian (index, Dec 2005=100)",
  DSPIC96: "Real Disposable Personal Income (billions of chained 2017 dollars)",

  // Monetary Policy / Liquidity
  FEDFUNDS: "Effective Federal Funds Rate – monthly average (%)",
  EFFR: "Effective Federal Funds Rate – daily (%)",
  IORB: "Interest Rate on Reserve Balances – IORB (%)",
  WALCL:
    "Federal Reserve Total Assets – Balance Sheet (millions of dollars, Wednesday level)",
  WRESBAL:
    "Reserve Balances with Federal Reserve Banks (billions of dollars, weekly average)",
  RRPONTSYD:
    "Overnight Reverse Repurchase Agreements: Treasury Securities Sold by Fed (billions of dollars)",
  M2SL: "M2 Money Supply (billions of dollars, SA)",

  // Rates / Yield Curve
  DGS2: "Market Yield on U.S. Treasury Securities at 2-Year Constant Maturity (%)",
  DGS10:
    "Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity (%)",
  T10Y2Y:
    "10-Year Treasury Constant Maturity Minus 2-Year Treasury Constant Maturity (%)",
  THREEFYTP10: "Term Premium on a 10-Year Zero Coupon Bond – Kim-Wright (%)",
  T10YIE: "10-Year Breakeven Inflation Rate (%)",

  // Credit / Financial Stress
  BAA10Y:
    "Moody's Baa Corporate Bond Yield Relative to 10-Year Treasury Constant Maturity (%)",
  BAMLH0A0HYM2: "ICE BofA US High Yield Index Option-Adjusted Spread (%)",
  DRTSCILM:
    "Net % of Domestic Banks Tightening Standards for C&I Loans to Large and Middle-Market Firms",
  NFCI: "Chicago Fed National Financial Conditions Index (0 = average conditions)",
  TOTBKCR: "Bank Credit, All Commercial Banks (billions of dollars, SA)",

  // Housing
  HOUST: "New Privately-Owned Housing Units Started (thousands of units, SAAR)",
  PERMIT:
    "New Privately-Owned Housing Units Authorized in Permit-Issuing Places (thousands of units, SAAR)",
  EXHOSLUSM495S: "Existing Home Sales (thousands of units, SAAR)",
  CSUSHPINSA:
    "S&P/Case-Shiller U.S. National Home Price Index (Jan 2000=100, NSA)",
  MORTGAGE30US: "30-Year Fixed Rate Mortgage Average in the United States (%)",

  // Sentiment
  UMCSENT: "University of Michigan: Consumer Sentiment (1966:Q1=100)",
};

// ---------------------------------------------------------------------------
// Zod schemas – Observations
// ---------------------------------------------------------------------------

const FredObservationSchema = z.object({
  realtime_start: z.string(),
  realtime_end: z.string(),
  date: z.string(),
  value: z.string(),
});

const FredObservationsResponseSchema = z
  .object({
    realtime_start: z.string(),
    realtime_end: z.string(),
    observation_start: z.string(),
    observation_end: z.string(),
    units: z.string(),
    output_type: z.number(),
    file_type: z.string(),
    order_by: z.string(),
    sort_order: z.string(),
    count: z.number(),
    offset: z.number(),
    limit: z.number(),
    observations: z.array(FredObservationSchema),
  })
  .loose();

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type FredObservationsResponse = z.infer<
  typeof FredObservationsResponseSchema
>;

// ---------------------------------------------------------------------------
// Unit / frequency enums (exposed for tool parameter schemas)
// ---------------------------------------------------------------------------

export const fredUnits = [
  "lin", // Levels (no transformation)
  "chg", // Change
  "ch1", // Change from Year Ago
  "pch", // Percent Change
  "pc1", // Percent Change from Year Ago
  "pca", // Compounded Annual Rate of Change
  "cch", // Continuously Compounded Rate of Change
  "cca", // Continuously Compounded Annual Rate of Change
] as const;

export type FredUnit = (typeof fredUnits)[number];

export const fredFrequencies = [
  "d", // Daily
  "w", // Weekly
  "bw", // Biweekly
  "m", // Monthly
  "q", // Quarterly
  "sa", // Semiannual
  "a", // Annual
] as const;

export type FredFrequency = (typeof fredFrequencies)[number];

export const fredAggregationMethods = ["avg", "sum", "eop"] as const;

export type FredAggregationMethod = (typeof fredAggregationMethods)[number];

// ---------------------------------------------------------------------------
// Core fetch helper
// ---------------------------------------------------------------------------

function getFredErrorMessage(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  if ("error_message" in payload && typeof payload.error_message === "string") {
    return payload.error_message;
  }

  if ("error_code" in payload) {
    return `FRED API error code: ${String(payload.error_code)}`;
  }

  return null;
}

async function fetchFredJson(
  endpoint: string,
  params: Record<string, string>,
): Promise<unknown> {
  const url = new URL(`${FRED_API_BASE_URL}/${endpoint}`);
  url.search = new URLSearchParams({
    ...params,
    api_key: ensureEnv("FRED_API_KEY"),
    file_type: "json",
  }).toString();

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(
      `FRED API request failed: ${response.status} ${response.statusText}`,
    );
  }

  const json = await response.json();
  const errorMessage = getFredErrorMessage(json);

  if (errorMessage) {
    throw new Error(`FRED API error: ${errorMessage}`);
  }

  return json;
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

/**
 * Fetch time-series observations for a FRED series.
 *
 * @param seriesId  FRED series identifier (e.g. "GDPC1", "UNRATE").
 * @param options   Optional parameters for date range, frequency, units, etc.
 * @returns         Parsed observations response.
 */
export async function fetchFredObservations(
  seriesId: string,
  options?: {
    observationStart?: string;
    observationEnd?: string;
    frequency?: FredFrequency;
    units?: FredUnit;
    aggregationMethod?: FredAggregationMethod;
    sortOrder?: "asc" | "desc";
    limit?: number;
  },
): Promise<FredObservationsResponse> {
  const params: Record<string, string> = {
    series_id: seriesId,
  };

  if (options?.observationStart)
    params.observation_start = options.observationStart;
  if (options?.observationEnd) params.observation_end = options.observationEnd;
  if (options?.frequency) params.frequency = options.frequency;
  if (options?.units) params.units = options.units;
  if (options?.aggregationMethod)
    params.aggregation_method = options.aggregationMethod;
  if (options?.sortOrder) params.sort_order = options.sortOrder;
  if (options?.limit) params.limit = String(options.limit);

  const json = await fetchFredJson("series/observations", params);
  return FredObservationsResponseSchema.parse(json);
}
