import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeMock = vi.fn();
const listSeriesMock = vi.fn();
const getBatchMock = vi.fn();

vi.mock("@tanstack/react-start/api", () => ({
  createAPIFileRoute:
    (path: string) =>
    (methods: unknown): { path: string; methods: unknown } => ({
      path,
      methods,
    }),
}));
vi.mock("~/server/quota", () => ({ authorizeApiRequest: authorizeMock }));
vi.mock("~/server/fred-data-api/catalog", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("~/server/fred-data-api/catalog")>();
  return { ...actual, listFredSeries: listSeriesMock };
});
vi.mock("~/server/fred-data-api/service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("~/server/fred-data-api/service")>();
  return { ...actual, getFredObservationBatch: getBatchMock };
});

const { APIRoute: seriesRoute } = await import("./v1.macro.series");
const { APIRoute: observationsRoute } = await import("./v1.macro.observations");

beforeEach(() => {
  vi.clearAllMocks();
  authorizeMock.mockResolvedValue({ type: "ok", userId: "user_1" });
  listSeriesMock.mockReturnValue([]);
  getBatchMock.mockResolvedValue({ asOf: "now", items: [], errors: [] });
});

describe("macro API routes", () => {
  it("authenticates and accounts against the endpoint-specific quota labels", async () => {
    const seriesHandler = seriesRoute.methods.GET;
    const observationsHandler = observationsRoute.methods.POST;
    if (!seriesHandler || !observationsHandler) {
      throw new Error("Missing macro API handler");
    }

    await seriesHandler({
      request: new Request("https://example.com/api/v1/macro/series"),
      params: {},
    });
    await observationsHandler({
      request: new Request("https://example.com/api/v1/macro/observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ series: [{ id: "UNRATE" }] }),
      }),
      params: {},
    });

    expect(authorizeMock).toHaveBeenNthCalledWith(
      1,
      expect.any(Request),
      "macro.series",
      {
        structuredErrors: true,
      },
    );
    expect(authorizeMock).toHaveBeenNthCalledWith(
      2,
      expect.any(Request),
      "macro.observations",
      { structuredErrors: true },
    );
  });

  it("returns an authentication error without invoking a service", async () => {
    authorizeMock.mockResolvedValue({
      type: "error",
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const handler = seriesRoute.methods.GET;
    if (!handler) throw new Error("Missing series GET handler");
    const response = await handler({
      request: new Request("https://example.com/api/v1/macro/series"),
      params: {},
    });

    expect(response.status).toBe(401);
    expect(listSeriesMock).not.toHaveBeenCalled();
  });

  it("searches the supported series catalog", async () => {
    listSeriesMock.mockReturnValue([{ id: "UNRATE" }]);
    const handler = seriesRoute.methods.GET;
    if (!handler) throw new Error("Missing series GET handler");
    const response = await handler({
      request: new Request(
        "https://example.com/api/v1/macro/series?query=unemployment",
      ),
      params: {},
    });

    expect(response.status).toBe(200);
    expect(listSeriesMock).toHaveBeenCalledWith("unemployment");
    expect(await response.json()).toEqual({ items: [{ id: "UNRATE" }] });
  });

  it("rejects malformed and duplicate series requests", async () => {
    const handler = observationsRoute.methods.POST;
    if (!handler) throw new Error("Missing observations POST handler");

    const malformed = await handler({
      request: new Request("https://example.com/api/v1/macro/observations", {
        method: "POST",
        body: "not-json",
      }),
      params: {},
    });
    const duplicate = await handler({
      request: new Request("https://example.com/api/v1/macro/observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ series: [{ id: "UNRATE" }, { id: "UNRATE" }] }),
      }),
      params: {},
    });

    expect(malformed.status).toBe(400);
    expect(duplicate.status).toBe(400);
    expect(getBatchMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported, oversized, and invalid-date requests", async () => {
    const handler = observationsRoute.methods.POST;
    if (!handler) throw new Error("Missing observations POST handler");
    const invalidBodies = [
      { series: [{ id: "NOT_A_SUPPORTED_SERIES" }] },
      {
        series: ["UNRATE", "ICSA", "CPIAUCSL", "GDPC1", "DGS10", "DGS2"].map(
          (id) => ({ id }),
        ),
      },
      {
        series: [
          {
            id: "UNRATE",
            startDate: "2026-02-30",
            endDate: "2026-03-01",
          },
        ],
      },
    ];

    for (const body of invalidBodies) {
      const response = await handler({
        request: new Request("https://example.com/api/v1/macro/observations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        params: {},
      });
      expect(response.status).toBe(400);
    }
    expect(getBatchMock).not.toHaveBeenCalled();
  });

  it("rejects incomplete ranges, conflicting windows, and upsampling", async () => {
    const handler = observationsRoute.methods.POST;
    if (!handler) throw new Error("Missing observations POST handler");
    const invalidBodies = [
      { series: [{ id: "UNRATE", startDate: "2026-01-01" }] },
      {
        series: [
          {
            id: "UNRATE",
            lastN: 12,
            startDate: "2026-01-01",
            endDate: "2026-06-01",
          },
        ],
      },
      { series: [{ id: "UNRATE", frequency: "w" }] },
    ];

    for (const body of invalidBodies) {
      const response = await handler({
        request: new Request("https://example.com/api/v1/macro/observations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        params: {},
      });
      expect(response.status).toBe(400);
    }
  });

  it("passes independent series requests to the service", async () => {
    getBatchMock.mockResolvedValue({
      asOf: "2026-08-02T00:00:00.000Z",
      items: [{ seriesId: "UNRATE" }],
      errors: [],
    });
    const handler = observationsRoute.methods.POST;
    if (!handler) throw new Error("Missing observations POST handler");
    const body = {
      series: [
        { id: "UNRATE", lastN: 6, units: "lin" },
        { id: "ICSA", frequency: "m", aggregationMethod: "avg" },
      ],
    };
    const response = await handler({
      request: new Request("https://example.com/api/v1/macro/observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      params: {},
    });

    expect(response.status).toBe(200);
    expect(getBatchMock).toHaveBeenCalledWith(body.series);
  });

  it("returns 502 when every provider request fails", async () => {
    getBatchMock.mockResolvedValue({
      asOf: "now",
      items: [],
      errors: [
        {
          seriesId: "UNRATE",
          code: "FRED_UNAVAILABLE",
          message: "unavailable",
        },
      ],
    });
    const handler = observationsRoute.methods.POST;
    if (!handler) throw new Error("Missing observations POST handler");
    const response = await handler({
      request: new Request("https://example.com/api/v1/macro/observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ series: [{ id: "UNRATE" }] }),
      }),
      params: {},
    });

    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FRED_UNAVAILABLE");
  });
});
