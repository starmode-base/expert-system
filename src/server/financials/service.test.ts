import { beforeEach, describe, expect, it, vi } from "vitest";
import { companyFactsFixtures } from "./__fixtures__/company-facts";
import { secCompanyFactsSchema, type SecCompanyFacts } from "./normalize";

const findFirstMock = vi.fn();
const getSecCompanyFactsMock =
  vi.fn<(cik: string | number) => Promise<SecCompanyFacts>>();

vi.mock("~/postgres/db", () => ({
  db: { query: { stockSymbols: { findFirst: findFirstMock } } },
  schema: { stockSymbols: { symbol: "stock_symbols.symbol" } },
}));

vi.mock("./sec-client", () => ({
  getSecCompanyFacts: getSecCompanyFactsMock,
  normalizeCik: (value: string | number) => {
    const raw = String(value).replace(/^CIK/i, "").replace(/^0+/, "") || "0";
    return raw.padStart(10, "0");
  },
  secCompanyFactsUrl: (cik: string) =>
    `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
}));

const apple = secCompanyFactsSchema.parse(companyFactsFixtures.apple);
const { getBatchFinancialMetrics, getCompanyFinancialCatalog } = await import(
  "./service"
);
const { getSingleFinancialMetric, resolveCompanyIdentifier } = await import(
  "./service"
);

beforeEach(() => {
  vi.clearAllMocks();
  getSecCompanyFactsMock.mockResolvedValue(apple);
});

describe("financial service", () => {
  it("accepts a direct CIK without a stock lookup", async () => {
    await expect(resolveCompanyIdentifier("CIK320193")).resolves.toEqual({
      cik: "0000320193",
    });
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("resolves uppercase ticker symbols through the stock catalog", async () => {
    findFirstMock.mockResolvedValue({ cik: "320193" });
    await expect(resolveCompanyIdentifier("aapl")).resolves.toEqual({
      cik: "0000320193",
      symbol: "AAPL",
    });
  });

  it("returns compact observations without provenance by default", async () => {
    findFirstMock.mockResolvedValue({ cik: "320193" });
    const result = await getSingleFinancialMetric("AAPL", "accountsPayable", {
      period: "quarterly",
      limit: 8,
      includeProvenance: false,
    });

    expect(result.catalogVersion).toBe("1");
    expect(result.cik).toBe("0000320193");
    expect(result.data[0]).toEqual({
      date: "2026-03-28",
      value: 68_260,
      periodType: "instant",
    });
    expect(result.source).toBe("SEC");
  });

  it("adds filing provenance only when requested", async () => {
    const result = await getSingleFinancialMetric(
      "CIK320193",
      "accountsPayable",
      {
        period: "quarterly",
        limit: 8,
        includeProvenance: true,
      },
    );

    expect(result.data[0]).toEqual(
      expect.objectContaining({
        filed: "2026-05-01",
        form: "10-Q",
        accession: "apple-ap",
        concept: "AccountsPayableCurrent",
      }),
    );
    expect(result.source).toEqual(
      expect.objectContaining({ provider: "SEC EDGAR" }),
    );
  });

  it("returns partial batch success with per-metric errors", async () => {
    const result = await getBatchFinancialMetrics(
      "CIK320193",
      ["revenue", "inventory"],
      {
        period: "quarterly",
        limit: 8,
        includeProvenance: false,
      },
    );

    expect(result.metrics.revenue).toBeDefined();
    expect(result.metrics.inventory).toBeUndefined();
    expect(result.errors?.inventory).toEqual(
      expect.objectContaining({ code: "METRIC_UNAVAILABLE" }),
    );
  });

  it("discovers only metrics available for the requested company and period", async () => {
    const result = await getCompanyFinancialCatalog("CIK320193", "quarterly");
    const ids = result.metrics.map((metric) => metric.id);
    expect(ids).toContain("revenue");
    expect(ids).toContain("cash");
    expect(ids).not.toContain("inventory");
  });
});
