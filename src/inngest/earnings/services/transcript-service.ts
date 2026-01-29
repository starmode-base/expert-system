import { getDocumentSummary } from "~/inngest/importers/helpers/get-document-summary";
import {
  documentExists,
  saveContent,
  type Document,
} from "~/inngest/importers/scrapers/save-content";
import { fetchAlphaVantageEarningsTranscript } from "../api/alpha-vantage-transcripts";
import { EARNINGS_TRANSCRIPT_SOURCE } from "../constants";

// Re-export for consumers that need document operations
export { documentExists, saveContent, type Document };

/**
 * Maps each quarter to the first month of the following quarter.
 * For Q4, increments the year.
 */
function getEarningsDate(year: number, quarter: number): Date {
  const nextQuarterMapping = {
    1: { month: 4, yearOffset: 0 },
    2: { month: 7, yearOffset: 0 },
    3: { month: 10, yearOffset: 0 },
    4: { month: 1, yearOffset: 1 },
  };
  const { month, yearOffset } = nextQuarterMapping[quarter as 1 | 2 | 3 | 4];
  const publicationYear = year + yearOffset;
  const monthString = String(month).padStart(2, "0");
  const publicationDate = new Date(`${publicationYear}-${monthString}-01`);
  return publicationDate;
}

/**
 * Generates the title for an earnings call transcript.
 */
export function getTranscriptTitle(
  name: string,
  quarter: number,
  year: number,
): string {
  return `${name} - Q${quarter} ${year} Earnings Call Transcript`;
}

/**
 * Fetches a transcript from Alpha Vantage and saves it to the database.
 * Idempotent: returns existing document ID if transcript already exists.
 *
 * @returns The document ID (existing or newly created)
 */
export async function fetchAndSaveTranscript({
  symbol,
  name,
  year,
  quarter,
  earningsDate,
}: {
  symbol: string;
  name: string;
  year: number;
  quarter: number;
  earningsDate?: Date;
}): Promise<string> {
  const result = await fetchAlphaVantageEarningsTranscript({
    symbol,
    year,
    quarter,
  });

  const publicationDate = earningsDate ?? getEarningsDate(year, quarter);

  const title = getTranscriptTitle(name, quarter, year);

  const articleText = result
    .map((entry) => `${entry.speaker} (${entry.title}): "${entry.content}"`)
    .join("\n");

  // Check if transcript already exists (idempotency)
  const existingDocumentId = await documentExists({
    source: EARNINGS_TRANSCRIPT_SOURCE,
    title,
  });

  if (existingDocumentId) {
    console.log(`Transcript already exists for ${symbol}`);
    return existingDocumentId;
  }

  // Generate summary for the transcript
  const description = await getDocumentSummary(articleText, title);

  const document = {
    source: EARNINGS_TRANSCRIPT_SOURCE,
    title,
    description,
    publicationDate,
    link: "",
    articleText,
  };

  return await saveContent(document);
}

/**
 * Checks if a transcript exists for the given symbol, year, and quarter.
 * Uses the earningsSchedule name to build the title.
 */
export async function checkTranscriptExists(params: {
  name: string;
  year: number;
  quarter: number;
}): Promise<string | null> {
  const title = getTranscriptTitle(params.name, params.quarter, params.year);
  return documentExists({
    source: EARNINGS_TRANSCRIPT_SOURCE,
    title,
  });
}
