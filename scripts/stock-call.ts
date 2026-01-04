import { ensureEnv } from "~/lib/env";
import { z } from "zod";

const API_KEY = ensureEnv("ALPHAVANTAGE_API_KEY");

if (!API_KEY) {
  throw new Error("Missing ALPHA_VANTAGE_API_KEY");
}

const url = new URL("https://www.alphavantage.co/query");
url.search = new URLSearchParams({
  function: "OVERVIEW",
  symbol: "TSLA",
  apikey: API_KEY,
}).toString();

const CompanyOverviewSchema = z.object({
  Symbol: z.string(),
  AssetType: z.string(),
  Name: z.string(),
  Description: z.string(),
  CIK: z.string(),
  Exchange: z.string(),
  Currency: z.string(),
  Country: z.string(),
  Sector: z.string(),
  Industry: z.string(),
  Address: z.string(),
  OfficialSite: z.string(),
  FiscalYearEnd: z.string(),
  LatestQuarter: z.string(),
  MarketCapitalization: z.string(),
  EBITDA: z.string(),
  PERatio: z.string().nullable(),
  PEGRatio: z.string().nullable(),
  BookValue: z.string().nullable(),
  DividendPerShare: z.string().nullable(),
  DividendYield: z.string().nullable(),
  EPS: z.string().nullable(),
  RevenuePerShareTTM: z.string().nullable(),
  ProfitMargin: z.string().nullable(),
  OperatingMarginTTM: z.string().nullable(),
  ReturnOnAssetsTTM: z.string().nullable(),
  ReturnOnEquityTTM: z.string().nullable(),
  RevenueTTM: z.string(),
  GrossProfitTTM: z.string(),
  DilutedEPSTTM: z.string(),
  QuarterlyEarningsGrowthYOY: z.string().nullable(),
  QuarterlyRevenueGrowthYOY: z.string().nullable(),
  AnalystTargetPrice: z.string().nullable(),
  AnalystRatingStrongBuy: z.string().nullable(),
  AnalystRatingBuy: z.string().nullable(),
  AnalystRatingHold: z.string().nullable(),
  AnalystRatingSell: z.string().nullable(),
  AnalystRatingStrongSell: z.string().nullable(),
  TrailingPE: z.string().nullable(),
  ForwardPE: z.string().nullable(),
  PriceToSalesRatioTTM: z.string().nullable(),
  PriceToBookRatio: z.string().nullable(),
  EVToRevenue: z.string().nullable(),
  EVToEBITDA: z.string().nullable(),
  Beta: z.string().nullable(),
  "52WeekHigh": z.string().nullable(),
  "52WeekLow": z.string().nullable(),
  "50DayMovingAverage": z.string().nullable(),
  "200DayMovingAverage": z.string().nullable(),
  SharesOutstanding: z.string().nullable(),
  SharesFloat: z.string().nullable(),
  PercentInsiders: z.string().nullable(),
  PercentInstitutions: z.string().nullable(),
  DividendDate: z.string().nullable(),
  ExDividendDate: z.string().nullable(),
});

export type CompanyOverview = z.infer<typeof CompanyOverviewSchema>;

export async function fetchTeslaFundamentalsTyped(): Promise<CompanyOverview> {
  const res = await fetch(url.toString());
  const json = await res.json();
  return CompanyOverviewSchema.parse(json);
}

// const GlobalQuoteSchema = z.object({
//   "01. symbol": z.string(),
//   "02. open": z.string(),
//   "03. high": z.string(),
//   "04. low": z.string(),
//   "05. price": z.string(),
//   "06. volume": z.string(),
//   "07. latest trading day": z.string(),
//   "08. previous close": z.string(),
//   "09. change": z.string(),
//   "10. change percent": z.string(),
// });

// const GlobalQuoteResponseSchema = z.object({
//   "Global Quote": GlobalQuoteSchema,
// });

// export type GlobalQuote = z.infer<typeof GlobalQuoteSchema>;

export async function fetchTeslaGlobalQuote() {
  const quoteUrl = new URL("https://www.alphavantage.co/query");
  quoteUrl.search = new URLSearchParams({
    function: "GLOBAL_QUOTE",
    symbol: "TSLA",
    apikey: API_KEY,
  }).toString();

  const res = await fetch(quoteUrl.toString());
  const json = await res.json();
  //   const parsed = GlobalQuoteResponseSchema.parse(json);
  return json;
}

const fundamentals = await fetchTeslaFundamentalsTyped();
console.log(fundamentals);

// sleep 1 second
await new Promise((resolve) => setTimeout(resolve, 1005));

const quote = await fetchTeslaGlobalQuote();
console.log(quote);
