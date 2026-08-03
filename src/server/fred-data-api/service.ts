import {
  fetchFredObservations,
  type FredAggregationMethod,
  type FredFrequency,
  type FredObservationsResponse,
  type FredSeriesId,
  type FredUnit,
} from "./fred-api";
import { getFredSeriesMetadata, type FredNativeFrequency } from "./catalog";

const FRED_RATE_LIMIT_MS = 600;

const frequencyNames: Record<FredFrequency, string> = {
  d: "daily",
  w: "weekly",
  bw: "biweekly",
  m: "monthly",
  q: "quarterly",
  sa: "semiannual",
  a: "annual",
};

const frequencyRanks: Record<FredFrequency | FredNativeFrequency, number> = {
  daily: 0,
  d: 0,
  weekly: 1,
  w: 1,
  bw: 2,
  monthly: 3,
  m: 3,
  quarterly: 4,
  q: 4,
  sa: 5,
  a: 6,
};

export interface FredObservationRequest {
  id: FredSeriesId;
  lastN?: number;
  startDate?: string;
  endDate?: string;
  units?: FredUnit;
  frequency?: FredFrequency;
  aggregationMethod?: FredAggregationMethod;
}

interface PublicFredObservation {
  date: string;
  value: number;
}

export interface FredObservationItem {
  seriesId: FredSeriesId;
  description: string;
  sourceUrl: string;
  nativeFrequency: FredNativeFrequency;
  returnedFrequency: string;
  nativeUnits: string;
  transformation: FredUnit;
  aggregationMethod?: FredAggregationMethod;
  observations: PublicFredObservation[];
}

export interface FredObservationError {
  seriesId: FredSeriesId;
  code: "INVALID_FREQUENCY" | "FRED_UNAVAILABLE";
  message: string;
}

export interface FredObservationBatchResult {
  asOf: string;
  items: FredObservationItem[];
  errors: FredObservationError[];
}

interface FredServiceOptions {
  rateLimitMs?: number;
  fetchObservations?: typeof fetchFredObservations;
}

export function getInvalidFrequencyMessage(
  request: FredObservationRequest,
): string | null {
  if (!request.frequency) return null;

  const metadata = getFredSeriesMetadata(request.id);
  if (
    frequencyRanks[request.frequency] < frequencyRanks[metadata.nativeFrequency]
  ) {
    return `${request.id} cannot be upsampled from ${metadata.nativeFrequency} to ${frequencyNames[request.frequency]}`;
  }

  return null;
}

function cleanObservations(
  response: FredObservationsResponse,
): PublicFredObservation[] {
  return response.observations.flatMap((observation) => {
    if (observation.value === ".") return [];
    const value = Number(observation.value);
    return Number.isFinite(value) ? [{ date: observation.date, value }] : [];
  });
}

function providerErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "FRED request failed";
}

async function wait(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function getFredObservationBatch(
  requests: FredObservationRequest[],
  options: FredServiceOptions = {},
): Promise<FredObservationBatchResult> {
  const items: FredObservationItem[] = [];
  const errors: FredObservationError[] = [];
  const fetchObservations = options.fetchObservations ?? fetchFredObservations;
  const rateLimitMs = options.rateLimitMs ?? FRED_RATE_LIMIT_MS;
  let providerRequestCount = 0;

  for (const request of requests) {
    const metadata = getFredSeriesMetadata(request.id);
    const invalidFrequencyMessage = getInvalidFrequencyMessage(request);
    if (invalidFrequencyMessage) {
      errors.push({
        seriesId: request.id,
        code: "INVALID_FREQUENCY",
        message: invalidFrequencyMessage,
      });
      continue;
    }

    if (providerRequestCount > 0) await wait(rateLimitMs);
    providerRequestCount += 1;

    const transformation = request.units ?? "lin";
    const aggregationMethod = request.frequency
      ? (request.aggregationMethod ?? "avg")
      : undefined;

    try {
      const response = await fetchObservations(request.id, {
        observationStart: request.startDate,
        observationEnd: request.endDate,
        frequency: request.frequency,
        units: transformation,
        aggregationMethod,
        sortOrder: request.startDate ? "asc" : "desc",
        limit: request.startDate ? undefined : (request.lastN ?? 12),
      });

      items.push({
        seriesId: request.id,
        description: metadata.description,
        sourceUrl: metadata.sourceUrl,
        nativeFrequency: metadata.nativeFrequency,
        returnedFrequency: request.frequency
          ? frequencyNames[request.frequency]
          : metadata.nativeFrequency,
        nativeUnits: metadata.nativeUnits,
        transformation,
        ...(aggregationMethod ? { aggregationMethod } : {}),
        observations: cleanObservations(response),
      });
    } catch (error) {
      errors.push({
        seriesId: request.id,
        code: "FRED_UNAVAILABLE",
        message: providerErrorMessage(error),
      });
    }
  }

  return { asOf: new Date().toISOString(), items, errors };
}
