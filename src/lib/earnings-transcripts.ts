// lib/fetchEarningsTranscript.ts
import { NonRetriableError } from "inngest";
import { ensureEnv } from "./env";

const API_BASE_URL = "https://api.api-ninjas.com/v1/earningstranscript";
const API_KEY = ensureEnv("API_NINJA");

const ALPHAVANTAGE_API_BASE_URL = "https://www.alphavantage.co/query";
const ALPHAVANTAGE_API_KEY = ensureEnv("ALPHAVANTAGE_API_KEY");

// types/earningsTranscript.ts
export interface TranscriptSplit {
  speaker: string;
  text: string;
}

export interface EarningsTranscriptResponse {
  date: string; // e.g. "2024-01-30"
  transcript: string;
  transcript_split: TranscriptSplit[];
}

export interface AlphaVantageTranscriptEntry {
  speaker: string;
  title: string;
  content: string;
  sentiment: string;
}

export interface AlphaVantageEarningsTranscriptResponse {
  symbol: string;
  quarter: string;
  transcript: AlphaVantageTranscriptEntry[];
}

interface FetchTranscriptParams {
  ticker: string;
  year: number;
  quarter: number;
}

export async function fetchEarningsTranscript({
  ticker,
  year,
  quarter,
}: FetchTranscriptParams): Promise<EarningsTranscriptResponse> {
  const url = `${API_BASE_URL}?ticker=${encodeURIComponent(ticker)}&year=${year}&quarter=${quarter}`;
  console.log("url", url);

  const response = await fetch(url, {
    headers: {
      "X-Api-Key": API_KEY,
    },
  });

  if (!response.ok) {
    console.log("response", response);
    throw new NonRetriableError(
      `Failed to fetch ${ticker} transcript: ${response.statusText}`,
    );
  }

  const data = await response.json();

  const typedData = data as EarningsTranscriptResponse;

  if (!typedData.date || !typedData.transcript) {
    throw new NonRetriableError(`Failed to fetch ${ticker} transcript`);
  }

  return typedData;
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
    throw new NonRetriableError(
      `Failed to fetch ${symbol} transcript from Alpha Vantage`,
    );
  }

  return typedData.transcript;
}
