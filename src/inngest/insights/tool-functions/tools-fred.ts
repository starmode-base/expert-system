import {
  type FredAggregationMethod,
  type FredFrequency,
  type FredSeriesId,
  type FredUnit,
} from "~/server/fred-data-api/fred-api";
import {
  getFredSeriesMetadata,
  type PublicFredSeries,
} from "~/server/fred-data-api/catalog";
import {
  getFredObservationBatch,
  type FredObservationItem,
} from "~/server/fred-data-api/service";

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
): Promise<{
  seriesId: string;
  description: string;
  data: FredObservationItem["observations"];
}> {
  const result = await getFredObservationBatch([
    { id: seriesId, lastN, units, frequency, aggregationMethod },
  ]);
  const item = result.items[0];
  if (!item)
    throw new Error(result.errors[0]?.message ?? "FRED request failed");
  return {
    seriesId,
    description: item.description,
    data: item.observations,
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
): Promise<{
  seriesId: string;
  description: string;
  data: FredObservationItem["observations"];
}> {
  const result = await getFredObservationBatch([
    {
      id: seriesId,
      startDate: observationStart,
      endDate: observationEnd,
      units,
      frequency,
      aggregationMethod,
    },
  ]);
  const item = result.items[0];
  if (!item)
    throw new Error(result.errors[0]?.message ?? "FRED request failed");
  return {
    seriesId,
    description: item.description,
    data: item.observations,
  };
}

/**
 * Fetch metadata for a FRED series (title, units, frequency, last updated, etc.).
 *
 * @param seriesId  FRED series identifier.
 */
export function fetchFredSeriesMetadata(
  seriesId: FredSeriesId,
): PublicFredSeries {
  return getFredSeriesMetadata(seriesId);
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
): Promise<
  Record<
    string,
    { description: string; data: FredObservationItem["observations"] }
  >
> {
  const batch = await getFredObservationBatch(
    seriesIds.map((id) => ({
      id,
      lastN,
      units,
      frequency,
      aggregationMethod,
    })),
  );
  if (batch.errors.length > 0) {
    throw new Error(batch.errors.map((error) => error.message).join("; "));
  }

  return Object.fromEntries(
    batch.items.map((item) => [
      item.seriesId,
      { description: item.description, data: item.observations },
    ]),
  );
}
