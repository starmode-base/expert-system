// lib/fetchEarningsTranscript.ts
import { NonRetriableError } from "inngest";
import { ensureEnv } from "../../../lib/env";

const ALPHAVANTAGE_API_BASE_URL = "https://www.alphavantage.co/query";
const ALPHAVANTAGE_API_KEY = ensureEnv("ALPHAVANTAGE_API_KEY");

interface AlphaVantageTranscriptEntry {
  speaker: string;
  title: string;
  content: string;
  sentiment: string;
}

interface AlphaVantageEarningsTranscriptResponse {
  symbol: string;
  quarter: string;
  transcript: AlphaVantageTranscriptEntry[];
}

interface FetchAlphaVantageTranscriptParams {
  symbol: string;
  year: number;
  quarter: number;
}

export class AlphaVantageRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AlphaVantageRateLimitError";
  }
}

function getAlphaVantageInformationMessage(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  for (const [key, value] of Object.entries(payload)) {
    if (key.toLowerCase() === "information" && typeof value === "string") {
      return value;
    }
  }

  return null;
}

function isTranscriptResponse(
  payload: unknown,
): payload is AlphaVantageEarningsTranscriptResponse {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  if (!("symbol" in payload) || typeof payload.symbol !== "string") {
    return false;
  }

  if (!("quarter" in payload) || typeof payload.quarter !== "string") {
    return false;
  }

  if (!("transcript" in payload) || !Array.isArray(payload.transcript)) {
    return false;
  }

  return payload.transcript.length > 0;
}

export async function fetchAlphaVantageEarningsTranscript({
  symbol,
  year,
  quarter,
}: FetchAlphaVantageTranscriptParams): Promise<AlphaVantageTranscriptEntry[]> {
  const quarterString = `${year}Q${quarter}`;
  const url = `${ALPHAVANTAGE_API_BASE_URL}?function=EARNINGS_CALL_TRANSCRIPT&symbol=${encodeURIComponent(symbol)}&quarter=${encodeURIComponent(quarterString)}&apikey=${ALPHAVANTAGE_API_KEY}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new NonRetriableError(
      `Failed to fetch ${symbol} transcript from Alpha Vantage: ${response.statusText}`,
    );
  }

  console.log("response", response);

  const data = await response.json();
  const typedData = data as
    | AlphaVantageEarningsTranscriptResponse
    | Record<string, unknown>;

  const infoMessage = getAlphaVantageInformationMessage(typedData);
  if (infoMessage?.includes("1 request per second")) {
    throw new AlphaVantageRateLimitError(infoMessage);
  }

  if (!isTranscriptResponse(typedData)) {
    console.log("Typed data", typedData);
    console.log("raw data", data);

    throw new Error(
      `Alpha Vantage API response parsing error: ${JSON.stringify(typedData)}`,
    );
  }

  return typedData.transcript;
}
