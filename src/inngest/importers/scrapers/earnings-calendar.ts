import { ensureEnv } from "../../../lib/env";

const ALPHAVANTAGE_API_BASE_URL = "https://www.alphavantage.co/query";
const ALPHAVANTAGE_API_KEY = ensureEnv("ALPHAVANTAGE_API_KEY");

export interface EarningsCalendarEntry {
  symbol: string;
  name: string;
  reportDate: Date;
  fiscalDateEnding: string;
  estimate: number | null;
  currency: string | null;
}

type Horizon = "3month" | "6month" | "12month";

/**
 * Fetches the earnings calendar from Alpha Vantage API.
 * Returns CSV data which is more memory-efficient than JSON.
 */
export async function fetchEarningsCalendar(
  horizon: Horizon = "3month",
): Promise<EarningsCalendarEntry[]> {
  const url = `${ALPHAVANTAGE_API_BASE_URL}?function=EARNINGS_CALENDAR&horizon=${horizon}&apikey=${ALPHAVANTAGE_API_KEY}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch earnings calendar from Alpha Vantage: ${response.statusText}`,
    );
  }

  const csvText = await response.text();
  return parseEarningsCalendarCsv(csvText);
}

/**
 * Parses the CSV response from Alpha Vantage EARNINGS_CALENDAR endpoint.
 * Expected CSV format:
 * symbol,name,reportDate,fiscalDateEnding,estimate,currency
 */
function parseEarningsCalendarCsv(csvText: string): EarningsCalendarEntry[] {
  const lines = csvText.trim().split("\n");

  // Skip header row
  if (lines.length <= 1) {
    return [];
  }

  const entries: EarningsCalendarEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line?.trim()) continue;

    const fields = parseCsvLine(line);

    if (fields.length < 6) continue;

    const symbol = fields[0];
    const name = fields[1];
    const reportDateStr = fields[2];
    const fiscalDateEnding = fields[3];
    const estimateStr = fields[4];
    const currency = fields[5];

    // Ensure required fields exist
    if (!symbol || !name || !reportDateStr || !fiscalDateEnding) continue;

    // Parse report date
    const reportDate = new Date(reportDateStr);
    if (isNaN(reportDate.getTime())) continue;

    // Parse estimate (can be empty)
    const estimate = estimateStr ? parseFloat(estimateStr) : null;

    entries.push({
      symbol: symbol.trim(),
      name: name.trim(),
      reportDate,
      fiscalDateEnding: fiscalDateEnding.trim(),
      estimate: estimate !== null && !isNaN(estimate) ? estimate : null,
      currency: currency?.trim() ?? null,
    });
  }

  return entries;
}

/**
 * Parses a single CSV line, handling quoted fields correctly.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
}
