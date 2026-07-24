import { describe, expect, test, vi } from "vitest";
import type { EarningsCallMetadata } from "../api/earnings-calls";

vi.mock("~/postgres/db", () => ({
  db: {},
  schema: {
    trackedStocks: {},
  },
}));
vi.mock("~/lib/dev-user", () => ({
  DEV_CLERK_USER_ID: "dev-user",
}));

const { matchTrackedCalls } = await import("./earnings-repository");

const now = new Date("2026-06-23T12:00:00.000Z");

function call(
  overrides: Partial<EarningsCallMetadata> = {},
): EarningsCallMetadata {
  return {
    providerCallId: 1,
    companyName: "NVIDIA",
    symbol: "NVDA",
    exchange: "NASDAQ",
    mic: "XNAS",
    country: "US",
    transcriptTitle: "NVIDIA Earnings Call",
    eventType: "Earnings",
    eventDateTime: now,
    providerAddedAt: now,
    sector: "Technology",
    industry: "Semiconductors",
    durationSeconds: 3600,
    ...overrides,
  };
}

function stock(overrides: Record<string, unknown> = {}) {
  return {
    id: "stock_1",
    symbol: "NVDA",
    companyName: "NVIDIA",
    exchange: "NASDAQ",
    mic: "XNAS",
    country: "US",
    active: true,
    hydrationStatus: "complete" as const,
    hydrationAttempts: 1,
    hydrationLastError: null,
    hydrationNextAttemptAt: null,
    hydratedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("tracked earnings call matching", () => {
  test("matches by normalized symbol and MIC", () => {
    const result = matchTrackedCalls(
      [call({ symbol: "nvda", mic: "xnas" })],
      [stock()],
    );
    expect(result).toHaveLength(1);
  });

  test("does not ingest another listing with the same symbol", () => {
    const result = matchTrackedCalls([call({ mic: "XNYS" })], [stock()]);
    expect(result).toHaveLength(0);
  });

  test("ignores inactive and non-US stocks", () => {
    expect(
      matchTrackedCalls([call()], [stock({ active: false })]),
    ).toHaveLength(0);
    expect(
      matchTrackedCalls([call({ country: "CA" })], [stock()]),
    ).toHaveLength(0);
  });
});
