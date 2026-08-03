import { describe, expect, it } from "vitest";
import { listFredSeries } from "./catalog";

describe("FRED series catalog", () => {
  it("returns the complete supported-series catalog", () => {
    const items = listFredSeries();
    expect(items).toHaveLength(45);
    expect(items[0]).toMatchObject({
      id: "GDPC1",
      category: "Growth & Real Economy",
      nativeFrequency: "quarterly",
    });
  });

  it.each([
    ["UNRATE", "UNRATE"],
    ["consumer spending", "PCEC96"],
    ["labor layoffs", "ICSA"],
    ["housing mortgage", "MORTGAGE30US"],
  ])("resolves %s through catalog metadata", (query, expectedId) => {
    expect(listFredSeries(query).map((item) => item.id)).toContain(expectedId);
  });

  it("returns an empty list when no supported series matches", () => {
    expect(listFredSeries("martian commodity index")).toEqual([]);
  });
});
