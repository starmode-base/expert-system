import {
  fredSeriesDescriptions,
  fredSeriesIds,
  type FredSeriesId,
} from "./fred-api";

export type FredNativeFrequency = "daily" | "weekly" | "monthly" | "quarterly";

interface FredSeriesMetadata {
  category: string;
  nativeFrequency: FredNativeFrequency;
  nativeUnits: string;
  keywords: readonly string[];
}

const fredSeriesMetadata = {
  GDPC1: {
    category: "Growth & Real Economy",
    nativeFrequency: "quarterly",
    nativeUnits: "Billions of chained 2017 dollars, SAAR",
    keywords: ["gdp", "growth", "output"],
  },
  INDPRO: {
    category: "Growth & Real Economy",
    nativeFrequency: "monthly",
    nativeUnits: "Index 2017=100",
    keywords: ["production", "manufacturing", "output"],
  },
  TCU: {
    category: "Growth & Real Economy",
    nativeFrequency: "monthly",
    nativeUnits: "Percent",
    keywords: ["capacity", "utilization", "industry"],
  },
  PCEC96: {
    category: "Growth & Real Economy",
    nativeFrequency: "monthly",
    nativeUnits: "Billions of chained 2017 dollars",
    keywords: ["consumption", "consumer spending", "pce"],
  },
  PNFIC1: {
    category: "Growth & Real Economy",
    nativeFrequency: "quarterly",
    nativeUnits: "Billions of chained 2017 dollars, SAAR",
    keywords: ["business investment", "capex", "fixed investment"],
  },
  UNRATE: {
    category: "Labor Market",
    nativeFrequency: "monthly",
    nativeUnits: "Percent",
    keywords: ["unemployment", "jobs", "labor"],
  },
  CIVPART: {
    category: "Labor Market",
    nativeFrequency: "monthly",
    nativeUnits: "Percent",
    keywords: ["participation", "workforce", "labor"],
  },
  EMRATIO: {
    category: "Labor Market",
    nativeFrequency: "monthly",
    nativeUnits: "Percent",
    keywords: ["employment", "population", "jobs"],
  },
  PAYEMS: {
    category: "Labor Market",
    nativeFrequency: "monthly",
    nativeUnits: "Thousands of persons",
    keywords: ["payrolls", "jobs", "employment"],
  },
  ICSA: {
    category: "Labor Market",
    nativeFrequency: "weekly",
    nativeUnits: "Persons, seasonally adjusted",
    keywords: ["initial claims", "jobless claims", "layoffs"],
  },
  CCSA: {
    category: "Labor Market",
    nativeFrequency: "weekly",
    nativeUnits: "Persons, seasonally adjusted",
    keywords: ["continuing claims", "jobless claims", "unemployment"],
  },
  JTSJOR: {
    category: "Labor Market",
    nativeFrequency: "monthly",
    nativeUnits: "Percent",
    keywords: ["job openings", "jolts", "labor demand"],
  },
  JTSQUR: {
    category: "Labor Market",
    nativeFrequency: "monthly",
    nativeUnits: "Percent",
    keywords: ["quits", "jolts", "labor mobility"],
  },
  CPIAUCSL: {
    category: "Inflation & Prices",
    nativeFrequency: "monthly",
    nativeUnits: "Index 1982-84=100",
    keywords: ["headline cpi", "inflation", "prices"],
  },
  CPILFESL: {
    category: "Inflation & Prices",
    nativeFrequency: "monthly",
    nativeUnits: "Index 1982-84=100",
    keywords: ["core cpi", "inflation", "prices"],
  },
  PCEPI: {
    category: "Inflation & Prices",
    nativeFrequency: "monthly",
    nativeUnits: "Index 2017=100",
    keywords: ["headline pce", "inflation", "prices"],
  },
  PCEPILFE: {
    category: "Inflation & Prices",
    nativeFrequency: "monthly",
    nativeUnits: "Index 2017=100",
    keywords: ["core pce", "inflation", "fed target"],
  },
  PCETRIM1M158SFRBDAL: {
    category: "Inflation & Prices",
    nativeFrequency: "monthly",
    nativeUnits: "Annualized percent change",
    keywords: ["trimmed mean", "underlying inflation", "dallas fed"],
  },
  MEDCPIM158SFRBCLE: {
    category: "Inflation & Prices",
    nativeFrequency: "monthly",
    nativeUnits: "Annualized percent change",
    keywords: ["median cpi", "underlying inflation", "cleveland fed"],
  },
  CES0500000003: {
    category: "Wages & Income",
    nativeFrequency: "monthly",
    nativeUnits: "Dollars per hour",
    keywords: ["wages", "earnings", "pay"],
  },
  ECIALLCIV: {
    category: "Wages & Income",
    nativeFrequency: "quarterly",
    nativeUnits: "Index Dec 2005=100",
    keywords: ["employment cost", "compensation", "wages"],
  },
  DSPIC96: {
    category: "Wages & Income",
    nativeFrequency: "monthly",
    nativeUnits: "Billions of chained 2017 dollars",
    keywords: ["disposable income", "real income", "households"],
  },
  FEDFUNDS: {
    category: "Monetary Policy & Liquidity",
    nativeFrequency: "monthly",
    nativeUnits: "Percent",
    keywords: ["fed funds", "policy rate", "interest rates"],
  },
  EFFR: {
    category: "Monetary Policy & Liquidity",
    nativeFrequency: "daily",
    nativeUnits: "Percent",
    keywords: ["effective fed funds", "policy rate", "interest rates"],
  },
  IORB: {
    category: "Monetary Policy & Liquidity",
    nativeFrequency: "daily",
    nativeUnits: "Percent",
    keywords: ["reserve balances", "policy rate", "fed"],
  },
  WALCL: {
    category: "Monetary Policy & Liquidity",
    nativeFrequency: "weekly",
    nativeUnits: "Millions of dollars",
    keywords: ["fed balance sheet", "quantitative easing", "liquidity"],
  },
  WRESBAL: {
    category: "Monetary Policy & Liquidity",
    nativeFrequency: "weekly",
    nativeUnits: "Billions of dollars",
    keywords: ["bank reserves", "reserve balances", "liquidity"],
  },
  RRPONTSYD: {
    category: "Monetary Policy & Liquidity",
    nativeFrequency: "daily",
    nativeUnits: "Billions of dollars",
    keywords: ["reverse repo", "rrp", "liquidity"],
  },
  M2SL: {
    category: "Monetary Policy & Liquidity",
    nativeFrequency: "monthly",
    nativeUnits: "Billions of dollars",
    keywords: ["money supply", "m2", "liquidity"],
  },
  DGS2: {
    category: "Rates & Yield Curve",
    nativeFrequency: "daily",
    nativeUnits: "Percent",
    keywords: ["2 year", "treasury yield", "rates"],
  },
  DGS10: {
    category: "Rates & Yield Curve",
    nativeFrequency: "daily",
    nativeUnits: "Percent",
    keywords: ["10 year", "treasury yield", "rates"],
  },
  T10Y2Y: {
    category: "Rates & Yield Curve",
    nativeFrequency: "daily",
    nativeUnits: "Percentage points",
    keywords: ["yield curve", "spread", "recession"],
  },
  THREEFYTP10: {
    category: "Rates & Yield Curve",
    nativeFrequency: "daily",
    nativeUnits: "Percent",
    keywords: ["term premium", "duration", "treasury"],
  },
  T10YIE: {
    category: "Rates & Yield Curve",
    nativeFrequency: "daily",
    nativeUnits: "Percent",
    keywords: ["breakeven inflation", "inflation expectations", "treasury"],
  },
  BAA10Y: {
    category: "Credit & Financial Stress",
    nativeFrequency: "daily",
    nativeUnits: "Percentage points",
    keywords: ["baa spread", "corporate credit", "risk premium"],
  },
  BAMLH0A0HYM2: {
    category: "Credit & Financial Stress",
    nativeFrequency: "daily",
    nativeUnits: "Percent",
    keywords: ["high yield spread", "junk bonds", "credit risk"],
  },
  DRTSCILM: {
    category: "Credit & Financial Stress",
    nativeFrequency: "quarterly",
    nativeUnits: "Net percent of banks",
    keywords: ["lending standards", "sloos", "bank credit"],
  },
  NFCI: {
    category: "Credit & Financial Stress",
    nativeFrequency: "weekly",
    nativeUnits: "Index",
    keywords: ["financial conditions", "stress", "credit"],
  },
  TOTBKCR: {
    category: "Credit & Financial Stress",
    nativeFrequency: "weekly",
    nativeUnits: "Billions of dollars",
    keywords: ["bank credit", "lending", "loans"],
  },
  HOUST: {
    category: "Housing",
    nativeFrequency: "monthly",
    nativeUnits: "Thousands of units, SAAR",
    keywords: ["housing starts", "construction", "homes"],
  },
  PERMIT: {
    category: "Housing",
    nativeFrequency: "monthly",
    nativeUnits: "Thousands of units, SAAR",
    keywords: ["building permits", "construction", "homes"],
  },
  EXHOSLUSM495S: {
    category: "Housing",
    nativeFrequency: "monthly",
    nativeUnits: "Thousands of units, SAAR",
    keywords: ["existing home sales", "housing market", "homes"],
  },
  CSUSHPINSA: {
    category: "Housing",
    nativeFrequency: "monthly",
    nativeUnits: "Index Jan 2000=100",
    keywords: ["case shiller", "home prices", "housing"],
  },
  MORTGAGE30US: {
    category: "Housing",
    nativeFrequency: "weekly",
    nativeUnits: "Percent",
    keywords: ["mortgage rate", "housing affordability", "home loans"],
  },
  UMCSENT: {
    category: "Sentiment",
    nativeFrequency: "monthly",
    nativeUnits: "Index 1966:Q1=100",
    keywords: ["consumer sentiment", "confidence", "michigan"],
  },
} as const satisfies Record<FredSeriesId, FredSeriesMetadata>;

export interface PublicFredSeries {
  id: FredSeriesId;
  description: string;
  category: string;
  nativeFrequency: FredNativeFrequency;
  nativeUnits: string;
  sourceUrl: string;
}

function getFredSeriesSourceUrl(seriesId: FredSeriesId): string {
  return `https://fred.stlouisfed.org/series/${seriesId}`;
}

export function getFredSeriesMetadata(
  seriesId: FredSeriesId,
): PublicFredSeries {
  const metadata = fredSeriesMetadata[seriesId];
  return {
    id: seriesId,
    description: fredSeriesDescriptions[seriesId],
    category: metadata.category,
    nativeFrequency: metadata.nativeFrequency,
    nativeUnits: metadata.nativeUnits,
    sourceUrl: getFredSeriesSourceUrl(seriesId),
  };
}

export function listFredSeries(query?: string): PublicFredSeries[] {
  const terms = query?.trim().toLowerCase().split(/\s+/).filter(Boolean);

  return fredSeriesIds.flatMap((seriesId) => {
    const metadata = fredSeriesMetadata[seriesId];
    const series = getFredSeriesMetadata(seriesId);
    if (!terms?.length) return [series];

    const searchable = [
      series.id,
      series.description,
      series.category,
      ...metadata.keywords,
    ]
      .join(" ")
      .toLowerCase();

    return terms.every((term) => searchable.includes(term)) ? [series] : [];
  });
}
