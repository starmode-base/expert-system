import { ensureEnv } from "~/lib/env";
import { z } from "zod";

const ALPHAVANTAGE_API_BASE_URL = "https://www.alphavantage.co/query";
const ALPHAVANTAGE_API_KEY = ensureEnv("ALPHAVANTAGE_API_KEY");

const TreasuryYieldIntervalSchema = z.enum(["daily", "weekly", "monthly"]);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TreasuryYieldMaturitySchema = z.enum([
  "3month",
  "2year",
  "5year",
  "7year",
  "10year",
  "30year",
]);

const TreasuryYieldPointSchema = z.object({
  date: z.string(),
  value: z.string(),
});

const TreasuryYieldResponseSchema = z
  .object({
    name: z.string(),
    interval: TreasuryYieldIntervalSchema,
    unit: z.string(),
    data: z.array(TreasuryYieldPointSchema),
  })
  .loose();

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

const GlobalQuoteSchema = z.object({
  "01. symbol": z.string(),
  "02. open": z.string(),
  "03. high": z.string(),
  "04. low": z.string(),
  "05. price": z.string(),
  "06. volume": z.string(),
  "07. latest trading day": z.string(),
  "08. previous close": z.string(),
  "09. change": z.string(),
  "10. change percent": z.string(),
});

const GlobalQuoteResponseSchema = z.object({
  "Global Quote": GlobalQuoteSchema,
});

const SymbolSearchMatchSchema = z.object({
  "1. symbol": z.string(),
  "2. name": z.string(),
  "3. type": z.string(),
  "4. region": z.string(),
  "5. marketOpen": z.string(),
  "6. marketClose": z.string(),
  "7. timezone": z.string(),
  "8. currency": z.string(),
  "9. matchScore": z.string(),
});

const SymbolSearchResponseSchema = z.object({
  bestMatches: z.array(SymbolSearchMatchSchema),
});

const IncomeStatementReportSchema = z
  .object({
    fiscalDateEnding: z.string(),
    reportedCurrency: z.string(),
    grossProfit: z.string().nullable(),
    totalRevenue: z.string().nullable(),
    costOfRevenue: z.string().nullable(),
    costofGoodsAndServicesSold: z.string().nullable(),
    operatingIncome: z.string().nullable(),
    sellingGeneralAndAdministrative: z.string().nullable(),
    researchAndDevelopment: z.string().nullable(),
    operatingExpenses: z.string().nullable(),
    investmentIncomeNet: z.string().nullable(),
    netInterestIncome: z.string().nullable(),
    interestIncome: z.string().nullable(),
    interestExpense: z.string().nullable(),
    nonInterestIncome: z.string().nullable(),
    otherNonOperatingIncome: z.string().nullable(),
    depreciation: z.string().nullable(),
    depreciationAndAmortization: z.string().nullable(),
    incomeBeforeTax: z.string().nullable(),
    incomeTaxExpense: z.string().nullable(),
    interestAndDebtExpense: z.string().nullable(),
    netIncomeFromContinuingOperations: z.string().nullable(),
    comprehensiveIncomeNetOfTax: z.string().nullable(),
    ebit: z.string().nullable(),
    ebitda: z.string().nullable(),
    netIncome: z.string().nullable(),
  })
  .loose();

const IncomeStatementSchema = z.object({
  symbol: z.string(),
  annualReports: z.array(IncomeStatementReportSchema),
  quarterlyReports: z.array(IncomeStatementReportSchema),
});

const BalanceSheetReportSchema = z
  .object({
    fiscalDateEnding: z.string(),
    reportedCurrency: z.string(),
    totalAssets: z.string().nullable(),
    totalCurrentAssets: z.string().nullable(),
    cashAndCashEquivalentsAtCarryingValue: z.string().nullable(),
    cashAndShortTermInvestments: z.string().nullable(),
    inventory: z.string().nullable(),
    currentNetReceivables: z.string().nullable(),
    totalNonCurrentAssets: z.string().nullable(),
    propertyPlantEquipment: z.string().nullable(),
    accumulatedDepreciationAmortizationPPE: z.string().nullable(),
    intangibleAssets: z.string().nullable(),
    intangibleAssetsExcludingGoodwill: z.string().nullable(),
    goodwill: z.string().nullable(),
    investments: z.string().nullable(),
    longTermInvestments: z.string().nullable(),
    shortTermInvestments: z.string().nullable(),
    otherCurrentAssets: z.string().nullable(),
    otherNonCurrentAssets: z.string().nullable(),
    totalLiabilities: z.string().nullable(),
    totalCurrentLiabilities: z.string().nullable(),
    currentAccountsPayable: z.string().nullable(),
    deferredRevenue: z.string().nullable(),
    currentDebt: z.string().nullable(),
    shortTermDebt: z.string().nullable(),
    totalNonCurrentLiabilities: z.string().nullable(),
    capitalLeaseObligations: z.string().nullable(),
    longTermDebt: z.string().nullable(),
    currentLongTermDebt: z.string().nullable(),
    longTermDebtNoncurrent: z.string().nullable(),
    shortLongTermDebtTotal: z.string().nullable(),
    otherCurrentLiabilities: z.string().nullable(),
    otherNonCurrentLiabilities: z.string().nullable(),
    totalShareholderEquity: z.string().nullable(),
    treasuryStock: z.string().nullable(),
    retainedEarnings: z.string().nullable(),
    commonStock: z.string().nullable(),
    commonStockSharesOutstanding: z.string().nullable(),
  })
  .loose();

const BalanceSheetSchema = z.object({
  symbol: z.string(),
  annualReports: z.array(BalanceSheetReportSchema),
  quarterlyReports: z.array(BalanceSheetReportSchema),
});

const CashFlowReportSchema = z
  .object({
    fiscalDateEnding: z.string(),
    reportedCurrency: z.string(),
    operatingCashflow: z.string().nullable(),
    paymentsForOperatingActivities: z.string().nullable(),
    proceedsFromOperatingActivities: z.string().nullable(),
    changeInOperatingLiabilities: z.string().nullable(),
    changeInOperatingAssets: z.string().nullable(),
    depreciationDepletionAndAmortization: z.string().nullable(),
    capitalExpenditures: z.string().nullable(),
    changeInReceivables: z.string().nullable(),
    changeInInventory: z.string().nullable(),
    profitLoss: z.string().nullable(),
    cashflowFromInvestment: z.string().nullable(),
    cashflowFromFinancing: z.string().nullable(),
    proceedsFromRepaymentsOfShortTermDebt: z.string().nullable(),
    paymentsForRepurchaseOfCommonStock: z.string().nullable(),
    paymentsForRepurchaseOfEquity: z.string().nullable(),
    paymentsForRepurchaseOfPreferredStock: z.string().nullable(),
    dividendPayout: z.string().nullable(),
    dividendPayoutCommonStock: z.string().nullable(),
    dividendPayoutPreferredStock: z.string().nullable(),
    proceedsFromIssuanceOfCommonStock: z.string().nullable(),
    proceedsFromIssuanceOfLongTermDebtAndCapitalSecuritiesNet: z
      .string()
      .nullable(),
    proceedsFromIssuanceOfPreferredStock: z.string().nullable(),
    proceedsFromRepurchaseOfEquity: z.string().nullable(),
    proceedsFromSaleOfTreasuryStock: z.string().nullable(),
    changeInCashAndCashEquivalents: z.string().nullable(),
    changeInExchangeRate: z.string().nullable(),
    netIncome: z.string().nullable(),
  })
      .loose();

const CashFlowSchema = z.object({
  symbol: z.string(),
  annualReports: z.array(CashFlowReportSchema),
  quarterlyReports: z.array(CashFlowReportSchema),
});

export const companyOverviewMetrics = CompanyOverviewSchema.keyof().options;
export const globalQuoteMetrics = GlobalQuoteSchema.keyof().options;
export const incomeStatementReportMetrics =
  IncomeStatementReportSchema.keyof().options;
export const balanceSheetReportMetrics =
  BalanceSheetReportSchema.keyof().options;
export const cashFlowReportMetrics = CashFlowReportSchema.keyof().options;

export type CompanyOverview = z.infer<typeof CompanyOverviewSchema>;
export type GlobalQuote = z.infer<typeof GlobalQuoteSchema>;
export type SymbolSearchMatch = z.infer<typeof SymbolSearchMatchSchema>;
export type IncomeStatementReport = z.infer<typeof IncomeStatementReportSchema>;
export type IncomeStatement = z.infer<typeof IncomeStatementSchema>;
export type BalanceSheetReport = z.infer<typeof BalanceSheetReportSchema>;
export type BalanceSheet = z.infer<typeof BalanceSheetSchema>;
export type CashFlowReport = z.infer<typeof CashFlowReportSchema>;
export type CashFlow = z.infer<typeof CashFlowSchema>;
export type TreasuryYieldInterval = z.infer<typeof TreasuryYieldIntervalSchema>;
export type TreasuryYieldMaturity = z.infer<typeof TreasuryYieldMaturitySchema>;
export type TreasuryYieldPoint = z.infer<typeof TreasuryYieldPointSchema>;
export type TreasuryYieldResponse = z.infer<typeof TreasuryYieldResponseSchema>;

export interface StockData {
  overview: CompanyOverview;
  quote: GlobalQuote;
}

function getAlphaVantageMessage(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  for (const [key, value] of Object.entries(payload)) {
    const lowered = key.toLowerCase();
    if (
      (lowered === "information" || lowered === "note") &&
      typeof value === "string"
    ) {
      return value;
    }
  }

  return null;
}

async function fetchAlphaVantageJson(
  params: Record<string, string>,
): Promise<unknown> {
  const url = new URL(ALPHAVANTAGE_API_BASE_URL);
  url.search = new URLSearchParams({
    ...params,
    apikey: ALPHAVANTAGE_API_KEY,
  }).toString();

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(
      `Alpha Vantage request failed: ${response.status} ${response.statusText}`,
    );
  }

  const json = await response.json();
  const infoMessage = getAlphaVantageMessage(json);

  if (infoMessage) {
    throw new Error(`Alpha Vantage error: ${infoMessage}`);
  }

  return json;
}

export async function fetchCompanyOverview(
  symbol: string,
): Promise<CompanyOverview> {
  const json = await fetchAlphaVantageJson({
    function: "OVERVIEW",
    symbol,
  });

  return CompanyOverviewSchema.parse(json);
}

export async function fetchGlobalQuote(symbol: string): Promise<GlobalQuote> {
  const json = await fetchAlphaVantageJson({
    function: "GLOBAL_QUOTE",
    symbol,
  });

  const parsed = GlobalQuoteResponseSchema.parse(json);
  return parsed["Global Quote"];
}

export async function searchTickers(
  keywords: string,
): Promise<SymbolSearchMatch[]> {
  const trimmedKeywords = keywords.trim();
  if (!trimmedKeywords) {
    return [];
  }

  const json = await fetchAlphaVantageJson({
    function: "SYMBOL_SEARCH",
    keywords: trimmedKeywords,
  });

  const parsed = SymbolSearchResponseSchema.parse(json);
  return parsed.bestMatches;
}

export async function fetchIncomeStatement(
  symbol: string,
): Promise<IncomeStatement> {
  const json = await fetchAlphaVantageJson({
    function: "INCOME_STATEMENT",
    symbol,
  });

  return IncomeStatementSchema.parse(json);
}

export async function fetchBalanceSheet(symbol: string): Promise<BalanceSheet> {
  const json = await fetchAlphaVantageJson({
    function: "BALANCE_SHEET",
    symbol,
  });

  return BalanceSheetSchema.parse(json);
}

export async function fetchCashFlow(symbol: string): Promise<CashFlow> {
  const json = await fetchAlphaVantageJson({
    function: "CASH_FLOW",
    symbol,
  });

  return CashFlowSchema.parse(json);
}

export async function fetchTreasuryYield(params: {
  interval: TreasuryYieldInterval;
  maturity: TreasuryYieldMaturity;
}): Promise<TreasuryYieldResponse> {
  const { interval, maturity } = params;

  const json = await fetchAlphaVantageJson({
    function: "TREASURY_YIELD",
    interval,
    maturity,
  });

  return TreasuryYieldResponseSchema.parse(json);
}
