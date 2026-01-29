import { describe, expect, test } from "vitest";
import { parseFiscalQuarter } from "./process-earnings-jobs-helpers";

const toUtcDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe("parseFiscalQuarter", () => {
  test("uses the most recent fiscal year end before report date", () => {
    const result = parseFiscalQuarter({
      reportDate: toUtcDate("2024-03-15"),
      fiscalYearEnd: toUtcDate("2024-06-30"),
    });

    expect(result).toEqual({ year: 2023, quarter: 4 });
  });

  test("uses the fiscal year end in the report year when already passed", () => {
    const result = parseFiscalQuarter({
      reportDate: toUtcDate("2024-07-01"),
      fiscalYearEnd: toUtcDate("2024-06-30"),
    });

    expect(result).toEqual({ year: 2024, quarter: 4 });
  });

  test("handles calendar year end fiscal dates", () => {
    const result = parseFiscalQuarter({
      reportDate: toUtcDate("2024-02-15"),
      fiscalYearEnd: toUtcDate("2024-12-31"),
    });

    expect(result).toEqual({ year: 2023, quarter: 4 });
  });

  test("returns Q4 on the fiscal year end date", () => {
    const result = parseFiscalQuarter({
      reportDate: toUtcDate("2025-12-25"),
      fiscalYearEnd: toUtcDate("2025-09-30"),
    });

    expect(result).toEqual({ year: 2025, quarter: 4 });
  });
});
