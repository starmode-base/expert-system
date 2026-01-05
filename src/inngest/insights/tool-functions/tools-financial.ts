// Search Ticker

import {
  CompanyOverview,
  fetchCompanyOverview,
} from "~/server/financial-data-api/alpha-vantage-api";

// Fetch Company Overview by metric

export async function fetchCompanyOverviewByMetric(
  symbol: string,
  metric: keyof CompanyOverview,
) {
  try {
    const overview = await fetchCompanyOverview(symbol);
    return overview[metric];
  } catch (error) {
    console.log(
      `Error fetching company overview for ${symbol}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return "Unable to fetch company overview";
  }
}

// Fetch Global Quote by Ticker by metric

// Fetch Income Statement by Ticker by quarter by metric

// Fetch Balance Sheet by Ticker by quarter by metric

// Fetch Cash Flow by Ticker by quarter by metric

// Fetch Treasury Yield Curve by date by metric
