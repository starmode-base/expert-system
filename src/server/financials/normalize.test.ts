import { describe, expect, it } from "vitest";
import { companyFactsFixtures } from "./__fixtures__/company-facts";
import { normalizeFinancialMetric, secCompanyFactsSchema } from "./normalize";

const fixtures = {
  apple: secCompanyFactsSchema.parse(companyFactsFixtures.apple),
  walmart: secCompanyFactsSchema.parse(companyFactsFixtures.walmart),
  jpmorgan: secCompanyFactsSchema.parse(companyFactsFixtures.jpmorgan),
  exxon: secCompanyFactsSchema.parse(companyFactsFixtures.exxon),
};

describe("normalizeFinancialMetric", () => {
  it("accepts minimized fixtures from different industries and calendars", () => {
    expect(Object.keys(fixtures)).toEqual([
      "apple",
      "walmart",
      "jpmorgan",
      "exxon",
    ]);
  });

  it("selects standalone quarterly income facts and the latest amendment", () => {
    const metric = normalizeFinancialMetric(
      fixtures.apple,
      "revenue",
      "quarterly",
      8,
    );
    expect(metric).toEqual({
      unit: "USD",
      data: [
        expect.objectContaining({
          value: 111_185,
          periodType: "quarter",
          accession: "apple-q2-amended",
        }),
      ],
    });
  });

  it("labels a filed Q2 cash-flow value as year-to-date", () => {
    const metric = normalizeFinancialMetric(
      fixtures.apple,
      "operatingCashFlow",
      "quarterly",
      8,
    );
    expect(metric?.data).toEqual([
      expect.objectContaining({
        value: 82_627,
        periodType: "yearToDate",
        start: "2025-09-28",
      }),
    ]);
  });

  it("classifies balance-sheet values as instant facts", () => {
    const metric = normalizeFinancialMetric(
      fixtures.apple,
      "cash",
      "quarterly",
      8,
    );
    expect(metric?.data[0]).toEqual(
      expect.objectContaining({ periodType: "instant" }),
    );
  });

  it("does not require calendar frames for non-calendar fiscal quarters", () => {
    const metric = normalizeFinancialMetric(
      fixtures.walmart,
      "revenue",
      "quarterly",
      8,
    );
    expect(metric?.data[0]).toEqual(
      expect.objectContaining({
        date: "2025-10-31",
        periodType: "quarter",
      }),
    );
  });

  it("uses ordered aliases without combining concepts", () => {
    const revenue = normalizeFinancialMetric(
      fixtures.jpmorgan,
      "revenue",
      "quarterly",
      8,
    );
    const equity = normalizeFinancialMetric(
      fixtures.jpmorgan,
      "stockholdersEquity",
      "quarterly",
      8,
    );
    expect(revenue?.data[0]?.concept).toBe("Revenues");
    expect(equity?.data[0]?.concept).toBe(
      "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    );
  });

  it("supports debt fallbacks and annual duration facts", () => {
    const debt = normalizeFinancialMetric(
      fixtures.exxon,
      "shortTermDebt",
      "quarterly",
      8,
    );
    const income = normalizeFinancialMetric(
      fixtures.exxon,
      "netIncome",
      "annual",
      8,
    );
    expect(debt?.data[0]?.concept).toBe("DebtCurrent");
    expect(income?.data[0]?.periodType).toBe("annual");
  });

  it("prefers USD and sorts newest-first before applying the limit", () => {
    const company = secCompanyFactsSchema.parse({
      cik: 1,
      entityName: "Unit Test Company",
      facts: {
        "us-gaap": {
          Revenues: {
            units: {
              EUR: [
                {
                  start: "2026-01-01",
                  end: "2026-03-31",
                  val: 999,
                  accn: "eur",
                  fy: 2026,
                  fp: "Q1",
                  form: "10-Q",
                  filed: "2026-05-01",
                },
              ],
              USD: [
                {
                  start: "2025-01-01",
                  end: "2025-03-31",
                  val: 100,
                  accn: "oldest",
                  fy: 2025,
                  fp: "Q1",
                  form: "10-Q",
                  filed: "2025-05-01",
                },
                {
                  start: "2026-01-01",
                  end: "2026-03-31",
                  val: 300,
                  accn: "newest",
                  fy: 2026,
                  fp: "Q1",
                  form: "10-Q",
                  filed: "2026-05-01",
                },
                {
                  start: "2025-04-01",
                  end: "2025-06-30",
                  val: 200,
                  accn: "middle",
                  fy: 2025,
                  fp: "Q2",
                  form: "10-Q",
                  filed: "2025-08-01",
                },
              ],
            },
          },
        },
      },
    });

    const metric = normalizeFinancialMetric(company, "revenue", "quarterly", 2);
    expect(metric?.unit).toBe("USD");
    expect(metric?.data.map(({ date }) => date)).toEqual([
      "2026-03-31",
      "2025-06-30",
    ]);
  });

  it("prefers a filed standalone cash-flow quarter over YTD for one end date", () => {
    const company = secCompanyFactsSchema.parse({
      cik: 1,
      entityName: "Cash Flow Test Company",
      facts: {
        "us-gaap": {
          NetCashProvidedByUsedInOperatingActivities: {
            units: {
              USD: [
                {
                  start: "2026-01-01",
                  end: "2026-06-30",
                  val: 190,
                  accn: "ytd",
                  fy: 2026,
                  fp: "Q2",
                  form: "10-Q",
                  filed: "2026-08-01",
                },
                {
                  start: "2026-04-01",
                  end: "2026-06-30",
                  val: 100,
                  accn: "quarter",
                  fy: 2026,
                  fp: "Q2",
                  form: "10-Q",
                  filed: "2026-08-01",
                },
              ],
            },
          },
        },
      },
    });

    const metric = normalizeFinancialMetric(
      company,
      "operatingCashFlow",
      "quarterly",
      8,
    );
    expect(metric?.data).toEqual([
      expect.objectContaining({ value: 100, periodType: "quarter" }),
    ]);
  });

  it("returns unavailable instead of empty data", () => {
    expect(
      normalizeFinancialMetric(fixtures.jpmorgan, "inventory", "quarterly", 8),
    ).toBeUndefined();
  });
});
