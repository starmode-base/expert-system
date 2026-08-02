import { describe, expect, it } from "vitest";
import {
  FINANCIAL_CATALOG_VERSION,
  financialMetricCatalog,
  financialMetricIds,
  getPublicFinancialCatalog,
  isFinancialMetricId,
} from "./catalog";

describe("financial metric catalog", () => {
  it("publishes the complete, unique v1 metric catalog", () => {
    expect(FINANCIAL_CATALOG_VERSION).toBe("1");
    expect(financialMetricIds).toHaveLength(27);
    expect(new Set(financialMetricIds)).toHaveLength(27);
    expect(Object.keys(financialMetricCatalog)).toEqual(financialMetricIds);
    expect(getPublicFinancialCatalog()).toHaveLength(27);
  });

  it("recognizes only canonical metric identifiers", () => {
    expect(isFinancialMetricId("accountsPayable")).toBe(true);
    expect(isFinancialMetricId("AccountsPayableCurrent")).toBe(false);
  });
});
