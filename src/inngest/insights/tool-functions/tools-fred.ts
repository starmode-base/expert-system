import {
  fetchFredObservations,
  fetchFredSeriesInfo,
  fredSeriesDescriptions,
  type FredAggregationMethod,
  type FredFrequency,
  type FredObservation,
  type FredSeriesId,
  type FredSeriesInfo,
  type FredUnit,
} from "~/server/fred-data-api/fred-api";

// Rate-limit helper – FRED allows 120 requests / minute on free keys.
const RATE_LIMIT_MS = 600;

/**
 * Fetch the latest N observations for a FRED series.
 *
 * Returns observations in reverse chronological order (newest first)
 * so the caller sees the most recent data at the top.
 *
 * @param seriesId      FRED series identifier (e.g. "GDPC1", "UNRATE").
 * @param lastN         Number of most recent observations to return.
 * @param units         Optional value transformation (e.g. "pch" for percent change).
 * @param frequency     Optional frequency aggregation (e.g. "q" for quarterly).
 * @param aggregationMethod  Aggregation method when changing frequency ("avg" | "sum" | "eop").
 */
export async function fetchLatestFredObservations(
  seriesId: FredSeriesId,
  lastN: number,
  units?: FredUnit,
  frequency?: FredFrequency,
  aggregationMethod?: FredAggregationMethod,
): Promise<{ seriesId: string; description: string; data: FredObservation[] }> {
  await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS));

  const response = await fetchFredObservations(seriesId, {
    sortOrder: "desc",
    limit: lastN,
    units,
    frequency,
    aggregationMethod,
  });

  // Filter out "." values that FRED uses for missing/pending observations
  const cleaned = response.observations.filter(
    (obs: FredObservation) => obs.value !== ".",
  );

  return {
    seriesId,
    description: fredSeriesDescriptions[seriesId],
    data: cleaned,
  };
}

/**
 * Fetch observations for a FRED series over a specific date range.
 *
 * @param seriesId           FRED series identifier.
 * @param observationStart   Start date (YYYY-MM-DD).
 * @param observationEnd     End date (YYYY-MM-DD).
 * @param units              Optional value transformation.
 * @param frequency          Optional frequency aggregation.
 * @param aggregationMethod  Aggregation method when changing frequency.
 */
export async function fetchFredObservationsByDateRange(
  seriesId: FredSeriesId,
  observationStart: string,
  observationEnd: string,
  units?: FredUnit,
  frequency?: FredFrequency,
  aggregationMethod?: FredAggregationMethod,
): Promise<{ seriesId: string; description: string; data: FredObservation[] }> {
  await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS));

  const response = await fetchFredObservations(seriesId, {
    observationStart,
    observationEnd,
    units,
    frequency,
    aggregationMethod,
  });

  const cleaned = response.observations.filter(
    (obs: FredObservation) => obs.value !== ".",
  );

  return {
    seriesId,
    description: fredSeriesDescriptions[seriesId],
    data: cleaned,
  };
}

/**
 * Fetch metadata for a FRED series (title, units, frequency, last updated, etc.).
 *
 * @param seriesId  FRED series identifier.
 */
export async function fetchFredSeriesMetadata(
  seriesId: FredSeriesId,
): Promise<FredSeriesInfo> {
  await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS));
  return await fetchFredSeriesInfo(seriesId);
}

/**
 * Fetch multiple FRED series at once and return latest observations for each.
 *
 * Useful for building a macro dashboard snapshot across multiple indicators
 * in a single tool call.
 *
 * @param seriesIds  Array of FRED series identifiers.
 * @param lastN      Number of most recent observations per series.
 * @param units      Optional value transformation applied to all series.
 * @param frequency  Optional frequency aggregation applied to all series.
 * @param aggregationMethod  Aggregation method when changing frequency.
 */
export async function fetchMultipleFredSeries(
  seriesIds: FredSeriesId[],
  lastN: number,
  units?: FredUnit,
  frequency?: FredFrequency,
  aggregationMethod?: FredAggregationMethod,
): Promise<Record<string, { description: string; data: FredObservation[] }>> {
  const results: Record<
    string,
    { description: string; data: FredObservation[] }
  > = {};

  for (const seriesId of seriesIds) {
    const result = await fetchLatestFredObservations(
      seriesId,
      lastN,
      units,
      frequency,
      aggregationMethod,
    );
    results[seriesId] = {
      description: result.description,
      data: result.data,
    };
  }

  return results;
}
