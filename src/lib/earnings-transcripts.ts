// lib/fetchEarningsTranscript.ts
import { NonRetriableError } from "inngest";
import { ensureEnv } from "./env";

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

  const data = await response.json();
  const typedData = data as AlphaVantageEarningsTranscriptResponse;

  if (
    !typedData.symbol ||
    !typedData.quarter ||
    typedData.transcript.length === 0
  ) {
    console.log("Typed data", typedData);
    throw new Error(
      `Alpha Vantage API response parsing error: ${JSON.stringify(typedData)}`,
    );
  }

  return typedData.transcript;
}
