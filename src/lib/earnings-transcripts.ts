// lib/fetchEarningsTranscript.ts
import { NonRetriableError } from "inngest";
import { ensureEnv } from "./env";

const API_BASE_URL = "https://api.api-ninjas.com/v1/earningstranscript";
const API_KEY = ensureEnv("API_NINJA");
console.log("API_KEY", API_KEY);

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
