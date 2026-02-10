import { ensureEnv } from "~/lib/env";
import { z } from "zod";

const FRED_API_BASE_URL = "https://api.stlouisfed.org/fred";
const FRED_API_KEY = ensureEnv("FRED_API_KEY");

// ---------------------------------------------------------------------------
// Series ID registry – the 10 most important macro indicators
// ---------------------------------------------------------------------------

export const fredSeriesIds = [
  "GDPC1", // Real GDP (quarterly, seasonally adjusted annual rate)
  "CPIAUCSL", // CPI – All Urban Consumers (monthly, seasonally adjusted)
  "UNRATE", // Unemployment Rate (monthly, seasonally adjusted)
  "FEDFUNDS", // Effective Federal Funds Rate (monthly)
  "PAYEMS", // Total Nonfarm Payrolls (monthly, seasonally adjusted)
  "DGS10", // 10-Year Treasury Constant Maturity Rate (daily)
  "PCEPI", // PCE Price Index (monthly, seasonally adjusted)
  "INDPRO", // Industrial Production Index (monthly, seasonally adjusted)
  "HOUST", // Housing Starts (monthly, seasonally adjusted annual rate)
  "UMCSENT", // University of Michigan Consumer Sentiment (monthly)
] as const;

export type FredSeriesId = (typeof fredSeriesIds)[number];

export const fredSeriesDescriptions: Record<FredSeriesId, string> = {
  GDPC1: "Real Gross Domestic Product (billions of chained 2017 dollars, SAAR)",
  CPIAUCSL:
    "Consumer Price Index for All Urban Consumers: All Items (1982-84=100)",
  UNRATE: "Civilian Unemployment Rate (%)",
  FEDFUNDS: "Effective Federal Funds Rate (%)",
  PAYEMS: "All Employees, Total Nonfarm (thousands of persons)",
  DGS10: "Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity (%)",
  PCEPI: "Personal Consumption Expenditures: Chain-type Price Index (2017=100)",
  INDPRO: "Industrial Production: Total Index (2017=100)",
  HOUST: "New Privately-Owned Housing Units Started (thousands of units, SAAR)",
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
// Zod schemas – Series metadata
// ---------------------------------------------------------------------------

const FredSeriesInfoSchema = z
  .object({
    id: z.string(),
    realtime_start: z.string(),
    realtime_end: z.string(),
    title: z.string(),
    observation_start: z.string(),
    observation_end: z.string(),
    frequency: z.string(),
    frequency_short: z.string(),
    units: z.string(),
    units_short: z.string(),
    seasonal_adjustment: z.string(),
    seasonal_adjustment_short: z.string(),
    last_updated: z.string(),
    popularity: z.number(),
    notes: z.string().optional(),
  })
  .loose();

const FredSeriesResponseSchema = z
  .object({
    seriess: z.array(FredSeriesInfoSchema),
  })
  .loose();

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type FredObservation = z.infer<typeof FredObservationSchema>;
export type FredObservationsResponse = z.infer<
  typeof FredObservationsResponseSchema
>;
export type FredSeriesInfo = z.infer<typeof FredSeriesInfoSchema>;

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
    api_key: FRED_API_KEY,
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

/**
 * Fetch metadata for a FRED series.
 *
 * @param seriesId  FRED series identifier.
 * @returns         Parsed series metadata.
 */
export async function fetchFredSeriesInfo(
  seriesId: string,
): Promise<FredSeriesInfo> {
  const json = await fetchFredJson("series", { series_id: seriesId });
  const parsed = FredSeriesResponseSchema.parse(json);
  const series = parsed.seriess[0];
  if (!series) {
    throw new Error(`No series info returned for ${seriesId}`);
  }
  return series;
}
