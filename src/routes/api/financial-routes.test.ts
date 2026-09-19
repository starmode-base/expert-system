import { beforeEach, describe, expect, it, vi } from "vitest";
import { FinancialApiError } from "../../server/financials/errors";

const authorizeMock = vi.fn();
const quotaMock = vi.fn();
const getBatchMock = vi.fn();
const getCompanyCatalogMock = vi.fn();
const getSingleMetricMock = vi.fn();

vi.mock("@tanstack/react-start/api", () => ({
  createAPIFileRoute:
    (path: string) =>
    (methods: unknown): { path: string; methods: unknown } => ({
      path,
      methods,
    }),
}));
vi.mock("~/server/quota", () => ({
  authenticateApiRequest: authorizeMock,
  enforceApiQuota: quotaMock,
}));
vi.mock("~/server/financials/service", () => ({
  getBatchFinancialMetrics: getBatchMock,
  getCompanyFinancialCatalog: getCompanyCatalogMock,
  getSingleFinancialMetric: getSingleMetricMock,
}));

const { APIRoute: batchRoute } = await import("./v1.financials");
const { APIRoute: globalCatalogRoute } = await import(
  "./v1.financials.metrics"
);
const { APIRoute: singleMetricRoute } = await import(
  "./v1.financials.$symbol.$metric"
);

beforeEach(() => {
  vi.clearAllMocks();
  authorizeMock.mockResolvedValue({ type: "ok", userId: "user_1" });
  quotaMock.mockResolvedValue({ type: "ok", userId: "user_1" });
});

describe("financial API routes", () => {
  it.each([
    ["revenue", "?period=invalid", 400],
    ["revenue", "?limit=0", 400],
    ["revenue", "?include=invalid", 400],
    ["metrics", "?period=invalid", 400],
    ["unknown", "", 404],
  ])(
    "does not charge invalid financial queries: %s%s",
    async (metric, query, status) => {
      const handler = singleMetricRoute.methods.GET;
      if (!handler) throw new Error("Missing GET handler");
      const response = await handler({
        request: new Request(
          `https://example.com/api/v1/financials/AAPL/${metric}${query}`,
        ),
        params: { symbol: "AAPL", metric },
      });
      expect(response.status).toBe(status);
      expect(quotaMock).not.toHaveBeenCalled();
      expect(getSingleMetricMock).not.toHaveBeenCalled();
      expect(getCompanyCatalogMock).not.toHaveBeenCalled();
    },
  );

  it("does not charge malformed JSON", async () => {
    const handler = batchRoute.methods.POST;
    if (!handler) throw new Error("Missing POST handler");
    const response = await handler({
      request: new Request("https://example.com/api/v1/financials", {
        method: "POST",
        body: "not-json",
      }),
      params: {},
    });
    expect(response.status).toBe(400);
    expect(quotaMock).not.toHaveBeenCalled();
  });

  it("enforces quota after validation and before executing financial requests", async () => {
    quotaMock.mockResolvedValue({
      type: "error",
      response: Response.json(
        { error: { code: "RATE_LIMITED", message: "Monthly quota exceeded" } },
        { status: 429 },
      ),
    });
    const handler = singleMetricRoute.methods.GET;
    if (!handler) throw new Error("Missing GET handler");
    const response = await handler({
      request: new Request(
        "https://example.com/api/v1/financials/AAPL/revenue",
      ),
      params: { symbol: "AAPL", metric: "revenue" },
    });
    expect(response.status).toBe(429);
    expect(quotaMock).toHaveBeenCalledTimes(1);
    expect(getSingleMetricMock).not.toHaveBeenCalled();
  });

  it("returns structured authentication failures before executing a route", async () => {
    authorizeMock.mockResolvedValue({
      type: "error",
      response: Response.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 },
      ),
    });
    const handler = batchRoute.methods.POST;
    if (!handler) throw new Error("Missing batch POST handler");

    const response = await handler({
      request: new Request("https://example.com/api/v1/financials", {
        method: "POST",
        body: "{}",
      }),
      params: {},
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Unauthorized" },
    });
    expect(getBatchMock).not.toHaveBeenCalled();
    expect(quotaMock).not.toHaveBeenCalled();
  });

  it("rejects malformed batch requests with INVALID_REQUEST", async () => {
    const handler = batchRoute.methods.POST;
    if (!handler) throw new Error("Missing batch POST handler");
    const response = await handler({
      request: new Request("https://example.com/api/v1/financials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: "AAPL", metrics: [] }),
      }),
      params: {},
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_REQUEST");
    expect(quotaMock).not.toHaveBeenCalled();
  });

  it("rejects unknown canonical metric IDs before execution", async () => {
    const handler = batchRoute.methods.POST;
    if (!handler) throw new Error("Missing batch POST handler");
    const response = await handler({
      request: new Request("https://example.com/api/v1/financials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: "AAPL", metrics: ["ebitda"] }),
      }),
      params: {},
    });

    expect(response.status).toBe(404);
    expect(quotaMock).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      error: {
        code: "METRIC_NOT_FOUND",
        message: "Unknown financial metric: ebitda",
      },
    });
  });

  it("returns batch partial-success payloads unchanged", async () => {
    getBatchMock.mockResolvedValue({
      catalogVersion: "1",
      cik: "0000320193",
      metrics: { revenue: { unit: "USD", data: [] } },
      errors: {
        inventory: {
          code: "METRIC_UNAVAILABLE",
          message: "inventory is unavailable for AAPL",
        },
      },
      source: "SEC",
    });
    const handler = batchRoute.methods.POST;
    if (!handler) throw new Error("Missing batch POST handler");
    const response = await handler({
      request: new Request("https://example.com/api/v1/financials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: "AAPL",
          metrics: ["revenue", "inventory"],
        }),
      }),
      params: {},
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      errors: { inventory: { code: string } };
    };
    expect(body.errors.inventory.code).toBe("METRIC_UNAVAILABLE");
    expect(quotaMock).toHaveBeenCalledExactlyOnceWith("user_1", "financials", {
      structuredErrors: true,
    });
  });

  it("parses single-metric period, limit, and provenance controls", async () => {
    getSingleMetricMock.mockResolvedValue({ metric: "revenue" });
    const handler = singleMetricRoute.methods.GET;
    if (!handler) throw new Error("Missing single-metric GET handler");
    const response = await handler({
      request: new Request(
        "https://example.com/api/v1/financials/AAPL/revenue?period=annual&limit=4&include=provenance",
      ),
      params: { symbol: "AAPL", metric: "revenue" },
    });

    expect(response.status).toBe(200);
    expect(getSingleMetricMock).toHaveBeenCalledWith("AAPL", "revenue", {
      period: "annual",
      limit: 4,
      includeProvenance: true,
    });
  });

  it("maps unavailable single metrics to the machine-readable error envelope", async () => {
    getSingleMetricMock.mockRejectedValue(
      new FinancialApiError(
        "METRIC_UNAVAILABLE",
        "inventory is unavailable for JPM",
        404,
      ),
    );
    const handler = singleMetricRoute.methods.GET;
    if (!handler) throw new Error("Missing single-metric GET handler");
    const response = await handler({
      request: new Request(
        "https://example.com/api/v1/financials/JPM/inventory",
      ),
      params: { symbol: "JPM", metric: "inventory" },
    });

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("METRIC_UNAVAILABLE");
    expect(quotaMock).toHaveBeenCalledTimes(1);
  });

  it("supports global and company-specific metric discovery", async () => {
    getCompanyCatalogMock.mockResolvedValue({ metrics: [{ id: "revenue" }] });
    const globalHandler = globalCatalogRoute.methods.GET;
    const companyHandler = singleMetricRoute.methods.GET;
    if (!globalHandler || !companyHandler) {
      throw new Error("Missing catalog GET handler");
    }

    const globalResponse = await globalHandler({
      request: new Request("https://example.com/api/v1/financials/metrics"),
      params: {},
    });
    const companyResponse = await companyHandler({
      request: new Request(
        "https://example.com/api/v1/financials/AAPL/metrics?period=annual",
      ),
      params: { symbol: "AAPL", metric: "metrics" },
    });

    const globalBody = (await globalResponse.json()) as { metrics: unknown[] };
    expect(globalBody.metrics).toHaveLength(27);
    expect(companyResponse.status).toBe(200);
    expect(getCompanyCatalogMock).toHaveBeenCalledWith("AAPL", "annual");
    expect(getSingleMetricMock).not.toHaveBeenCalled();
  });
});
