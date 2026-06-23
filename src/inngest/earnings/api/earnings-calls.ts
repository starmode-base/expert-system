import { z } from "zod";
import { ensureEnv } from "~/lib/env";

const BASE_URL = "https://earningscalls.dev/api/v1";
const REQUEST_TIMEOUT_MS = 15_000;

const companyCallSchema = z.object({
  id: z.number().int(),
  transcript_title: z.string(),
  event_type: z.string(),
  event_date_time: z.string(),
});

const companyHistorySchema = z.object({
  company_name: z.string(),
  stock_symbol: z.string(),
  company_ticker: z.string(),
  sector: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  exchange: z.string(),
  country: z.string(),
  mic: z.string(),
  earnings_calls: z.array(companyCallSchema),
});

const recentCallSchema = z.object({
  earnings_call_id: z.number().int(),
  added_at: z.string(),
  company_name: z.string(),
  company_ticker: z.string(),
  stock_symbol: z.string(),
  sector: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  exchange: z.string(),
  country: z.string(),
  event_date_time: z.string(),
  event_type: z.string(),
  duration_seconds: z.number().int().nullable().optional(),
  mic: z.string(),
});

const recentResponseSchema = z.object({
  data: z.array(recentCallSchema),
  pagination: z.object({
    has_more: z.boolean(),
    next_after_id: z.number().int(),
  }),
});

const transcriptSchema = z.object({
  earnings_call_id: z.number().int(),
  company_name: z.string(),
  transcript_title: z.string(),
  event_type: z.string(),
  event_date_time: z.string(),
  sector: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  company_ticker: z.string(),
  duration_seconds: z.number().int().nullable().optional(),
  full_transcript_text: z.string().min(1),
});

const transcriptResponseSchema = z.object({ data: transcriptSchema });

export interface EarningsCallMetadata {
  providerCallId: number;
  companyName: string;
  symbol: string;
  exchange: string;
  mic: string;
  country: string;
  transcriptTitle: string;
  eventType: string;
  eventDateTime: Date;
  providerAddedAt: Date;
  sector: string | null;
  industry: string | null;
  durationSeconds: number | null;
}

export interface EarningsTranscript {
  providerCallId: number;
  companyName: string;
  symbol: string;
  transcriptTitle: string;
  eventType: string;
  eventDateTime: Date;
  sector: string | null;
  industry: string | null;
  durationSeconds: number | null;
  text: string;
}

export class EarningsCallsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "EarningsCallsApiError";
  }

  get retryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

function parseDate(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${field} returned by earningscalls.dev`);
  }
  return date;
}

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  searchParams?: URLSearchParams,
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (searchParams) {
    url.search = searchParams.toString();
  }

  const response = await fetch(url, {
    headers: { "X-API-Key": ensureEnv("EARNINGSCALLS_API_KEY") },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: unknown;
    } | null;
    const detail = typeof body?.message === "string" ? `: ${body.message}` : "";
    throw new EarningsCallsApiError(
      `earningscalls.dev request failed (${String(response.status)})${detail}`,
      response.status,
    );
  }

  return schema.parse(await response.json());
}

export async function fetchLatestCall(
  symbol: string,
): Promise<EarningsCallMetadata> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const data = await request(
    `/companies/ticker/${encodeURIComponent(normalizedSymbol)}`,
    z.object({ data: companyHistorySchema }),
    new URLSearchParams({ country: "US" }),
  );
  const latestEarningsCall = data.data.earnings_calls.find(
    (call) => call.event_type.toLowerCase() === "earnings",
  );

  if (!latestEarningsCall) {
    throw new EarningsCallsApiError(
      `No US earnings calls found for ${normalizedSymbol}`,
      404,
    );
  }

  return {
    providerCallId: latestEarningsCall.id,
    companyName: data.data.company_name,
    symbol: data.data.company_ticker.toUpperCase(),
    exchange: data.data.exchange,
    mic: data.data.mic,
    country: data.data.country,
    transcriptTitle: latestEarningsCall.transcript_title,
    eventType: latestEarningsCall.event_type,
    eventDateTime: parseDate(
      latestEarningsCall.event_date_time,
      "event_date_time",
    ),
    providerAddedAt: new Date(),
    sector: data.data.sector ?? null,
    industry: data.data.industry ?? null,
    durationSeconds: null,
  };
}

export async function fetchRecentCalls(params?: {
  afterId?: number;
  limit?: number;
}): Promise<{
  calls: EarningsCallMetadata[];
  hasMore: boolean;
  nextAfterId: number;
}> {
  const searchParams = new URLSearchParams({
    limit: String(params?.limit ?? 100),
  });
  if (params?.afterId !== undefined) {
    searchParams.set("after_id", String(params.afterId));
  }

  const data = await request(
    "/transcripts/recent",
    recentResponseSchema,
    searchParams,
  );

  return {
    calls: data.data
      .filter((call) => call.event_type.toLowerCase() === "earnings")
      .map((call) => ({
        providerCallId: call.earnings_call_id,
        companyName: call.company_name,
        symbol: call.company_ticker.toUpperCase(),
        exchange: call.exchange,
        mic: call.mic,
        country: call.country,
        transcriptTitle: `${call.company_name} — ${call.event_type}`,
        eventType: call.event_type,
        eventDateTime: parseDate(call.event_date_time, "event_date_time"),
        providerAddedAt: parseDate(call.added_at, "added_at"),
        sector: call.sector ?? null,
        industry: call.industry ?? null,
        durationSeconds: call.duration_seconds ?? null,
      })),
    hasMore: data.pagination.has_more,
    nextAfterId: data.pagination.next_after_id,
  };
}

export async function fetchTranscript(
  providerCallId: number,
): Promise<EarningsTranscript> {
  const data = await request(
    `/transcripts/${String(providerCallId)}`,
    transcriptResponseSchema,
  );

  return {
    providerCallId: data.data.earnings_call_id,
    companyName: data.data.company_name,
    symbol: data.data.company_ticker.toUpperCase(),
    transcriptTitle: data.data.transcript_title,
    eventType: data.data.event_type,
    eventDateTime: parseDate(data.data.event_date_time, "event_date_time"),
    sector: data.data.sector ?? null,
    industry: data.data.industry ?? null,
    durationSeconds: data.data.duration_seconds ?? null,
    text: data.data.full_transcript_text,
  };
}
