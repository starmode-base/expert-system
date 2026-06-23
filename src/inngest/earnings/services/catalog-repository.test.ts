import { describe, expect, test, vi } from "vitest";
import type { EarningsCompanyCatalogEntry } from "../api/earnings-calls";

vi.mock("~/postgres/db", () => ({
  db: {},
  schema: {},
}));

const { filterUsCatalogEntries, selectCatalogStocksToHydrate } = await import(
  "./catalog-repository"
);

const company = (
  overrides: Partial<EarningsCompanyCatalogEntry> = {},
): EarningsCompanyCatalogEntry => ({
  companyName: "NVIDIA",
  symbol: "NVDA",
  sector: "Information Technology",
  industry: "Semiconductors",
  exchange: "NASDAQ",
  country: "US",
  mic: "XNAS",
  callCount: 10,
  latestCallAt: new Date("2026-05-20T21:00:00.000Z"),
  earliestCallAt: new Date("2023-05-24T21:00:00.000Z"),
  ...overrides,
});

describe("earnings company catalog filtering", () => {
  test("keeps US listings with available calls", () => {
    expect(filterUsCatalogEntries([company()])).toHaveLength(1);
  });

  test("removes non-US listings", () => {
    expect(filterUsCatalogEntries([company({ country: "CA" })])).toHaveLength(
      0,
    );
  });

  test("removes listings without calls", () => {
    expect(filterUsCatalogEntries([company({ callCount: 0 })])).toHaveLength(0);
  });

  test("deduplicates the same symbol and venue within a provider page", () => {
    expect(filterUsCatalogEntries([company(), company()])).toHaveLength(1);
  });
});

describe("catalog stock activation", () => {
  const catalogRows = [
    { id: "new", symbol: "NVDA", mic: "XNAS" },
    { id: "active", symbol: "MSFT", mic: "XNAS" },
    { id: "inactive", symbol: "AAPL", mic: "XNAS" },
    { id: "other-venue", symbol: "ONE", mic: "XNYS" },
  ];

  test("hydrates only new, inactive, and distinct-venue listings", () => {
    const result = selectCatalogStocksToHydrate(catalogRows, [
      { symbol: "MSFT", mic: "XNAS", active: true },
      { symbol: "AAPL", mic: "XNAS", active: false },
      { symbol: "ONE", mic: "XNAS", active: true },
    ]);

    expect(result.map((row) => row.id)).toEqual([
      "new",
      "inactive",
      "other-venue",
    ]);
  });
});
