import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  CLIENT_CAPABILITIES_META_KEY,
  CLIENT_INFO_META_KEY,
  PROTOCOL_VERSION_META_KEY,
} from "@modelcontextprotocol/server";
import { FinancialApiError } from "~/server/financials/errors";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  quota: vi.fn(),
  search: vi.fn(),
  recent: vi.fn(),
  takeaways: vi.fn(),
  documents: vi.fn(),
  content: vi.fn(),
  macro: vi.fn(),
  single: vi.fn(),
  batch: vi.fn(),
  company: vi.fn(),
}));
vi.mock("~/server/quota", () => ({
  authenticateApiRequest: mocks.auth,
  enforceApiQuota: mocks.quota,
}));
vi.mock("~/server/public-api/research", () => ({
  MAX_PUBLIC_IDS: 50,
  searchTakeawayPreviews: mocks.search,
  getRecentTakeawayPreviews: mocks.recent,
  getTakeawaysByIds: mocks.takeaways,
  getDocumentsByIds: mocks.documents,
  getDocumentContent: mocks.content,
}));
vi.mock("~/server/financials/service", () => ({
  getSingleFinancialMetric: mocks.single,
  getBatchFinancialMetrics: mocks.batch,
  getCompanyFinancialCatalog: mocks.company,
}));
vi.mock("~/server/fred-data-api/service", async (original) => ({
  ...(await original<typeof import("~/server/fred-data-api/service")>()),
  getFredObservationBatch: mocks.macro,
}));
vi.mock("@tanstack/react-start/api", () => ({
  createAPIFileRoute: () => (methods: unknown) => ({ methods }),
}));

const { handleMcpRequest } = await import("./handler");
const { financialMetricIds } = await import("~/server/financials/catalog");
const { APIRoute: search } = await import("~/routes/api/v1.takeaways.search");
const { APIRoute: recent } = await import("~/routes/api/v1.takeaways.recent");
const { APIRoute: takeaways } = await import("~/routes/api/v1.takeaways");
const { APIRoute: documents } = await import("~/routes/api/v1.documents");
const { APIRoute: content } = await import(
  "~/routes/api/v1.documents.$documentId.content"
);
const { APIRoute: series } = await import("~/routes/api/v1.macro.series");
const { APIRoute: macro } = await import("~/routes/api/v1.macro.observations");
const { APIRoute: catalog } = await import(
  "~/routes/api/v1.financials.metrics"
);
const { APIRoute: financial } = await import(
  "~/routes/api/v1.financials.$symbol.$metric"
);
const { APIRoute: batch } = await import("~/routes/api/v1.financials");

const object = z.record(z.string(), z.unknown());
const rpcSchema = z.object({
  result: object.optional(),
  error: object.optional(),
});
function rpcRequest(
  method: string,
  params: Record<string, unknown> = {},
  version = "2026-07-28",
  token = "user_1",
) {
  const modern = version === "2026-07-28";
  return new Request("https://example.com/api/mcp", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": version,
      ...(modern
        ? {
            "Mcp-Method": method,
            ...(typeof params.name === "string"
              ? { "Mcp-Name": params.name }
              : {}),
          }
        : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params: {
        ...params,
        ...(modern
          ? {
              _meta: {
                [PROTOCOL_VERSION_META_KEY]: version,
                [CLIENT_CAPABILITIES_META_KEY]: {},
                [CLIENT_INFO_META_KEY]: { name: "parity-test", version: "1" },
              },
            }
          : {}),
      },
    }),
  });
}
async function rpc(
  method: string,
  params: Record<string, unknown> = {},
  version = "2026-07-28",
  token = "user_1",
) {
  const response = await handleMcpRequest(
    rpcRequest(method, params, version, token),
  );
  const text = await response.text();
  const payload = text.startsWith("event:")
    ? text
        .split("\n")
        .find((line) => line.startsWith("data: "))
        ?.slice(6)
    : text;
  if (!payload) throw new Error(`Empty MCP response: ${response.status}`);
  const body: unknown = JSON.parse(payload);
  return rpcSchema.parse(body);
}
async function call(
  name: string,
  args: Record<string, unknown> = {},
  version = "2026-07-28",
  token = "user_1",
) {
  const response = await rpc(
    "tools/call",
    { name, arguments: args },
    version,
    token,
  );
  expect(response.error).toBeUndefined();
  return z
    .object({
      structuredContent: object,
      content: z.array(z.object({ type: z.literal("text"), text: z.string() })),
      isError: z.boolean().optional(),
      _meta: z.object({ httpStatus: z.number() }).loose(),
    })
    .parse(response.result);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockImplementation((request: Request) =>
    Promise.resolve({
      type: "ok",
      userId: request.headers.get("authorization")?.slice(7) ?? "user_1",
    }),
  );
  mocks.quota.mockImplementation((userId: string) =>
    Promise.resolve({ type: "ok", userId }),
  );
  const preview = {
    id: "tak_1",
    documentId: "doc_1",
    publicationDate: new Date("2026-01-02"),
    document: {
      id: "doc_1",
      link: "https://source.example.com",
      title: "Source",
    },
  };
  mocks.search.mockResolvedValue([preview]);
  mocks.recent.mockResolvedValue([preview]);
  mocks.takeaways.mockImplementation((ids: string[]) =>
    Promise.resolve(
      ids.map((id) => ({
        id,
        takeaway: "Full text",
        takeawayReferences: [{ referenceNumber: 1, reference: "Citation" }],
      })),
    ),
  );
  mocks.documents.mockImplementation((ids: string[]) =>
    Promise.resolve(ids.map((id) => ({ id, articleText: "Source text" }))),
  );
  mocks.content.mockResolvedValue({
    item: {
      id: "doc_1",
      content: {
        text: "Source",
        offset: 0,
        nextOffset: null,
        totalCharacters: 6,
        truncated: false,
      },
    },
  });
  mocks.macro.mockResolvedValue({
    asOf: "2026-01-02",
    items: [
      {
        seriesId: "UNRATE",
        observations: [{ date: "2026-01-01", value: 4.2 }],
      },
    ],
    errors: [],
  });
  mocks.single.mockResolvedValue({
    catalogVersion: "1",
    symbol: "AAPL",
    metric: "revenue",
    unit: "USD",
    data: [{ date: "2026-01-01", value: 42, periodType: "quarter" }],
    source: "SEC",
  });
  mocks.batch.mockResolvedValue({
    catalogVersion: "1",
    metrics: { revenue: { unit: "USD", data: [] } },
    errors: {},
  });
  mocks.company.mockResolvedValue({
    catalogVersion: "1",
    symbol: "AAPL",
    metrics: [{ id: "revenue", unit: "USD" }],
    source: "SEC",
  });
});

type RestHandler = (context: {
  request: Request;
  params: { documentId: string; symbol: string; metric: string };
}) => Response | Promise<Response>;
interface Case {
  tool: string;
  handler: RestHandler | undefined;
  path: string;
  args: Record<string, unknown>;
  endpoint: string;
  post?: boolean;
  params?: Partial<{ documentId: string; symbol: string; metric: string }>;
}
const cases: Case[] = [
  {
    tool: "search_takeaways",
    handler: search.methods.GET,
    path: "takeaways/search?query=AI",
    args: { query: "AI" },
    endpoint: "takeaways.search",
  },
  {
    tool: "get_recent_takeaways",
    handler: recent.methods.GET,
    path: "takeaways/recent",
    args: {},
    endpoint: "takeaways.recent",
  },
  {
    tool: "get_takeaways",
    handler: takeaways.methods.GET,
    path: "takeaways?ids=tak_2,tak_1",
    args: { ids: ["tak_2", "tak_1"] },
    endpoint: "takeaways",
  },
  {
    tool: "get_documents",
    handler: documents.methods.GET,
    path: "documents?ids=doc_2,doc_1",
    args: { ids: ["doc_2", "doc_1"] },
    endpoint: "documents",
  },
  {
    tool: "get_document_content",
    handler: content.methods.GET,
    path: "documents/doc_1/content",
    args: { documentId: "doc_1" },
    endpoint: "documents.content",
  },
  {
    tool: "list_macro_series",
    handler: series.methods.GET,
    path: "macro/series",
    args: {},
    endpoint: "macro.series",
  },
  {
    tool: "get_macro_observations",
    handler: macro.methods.POST,
    path: "macro/observations",
    args: { series: [{ id: "UNRATE" }] },
    endpoint: "macro.observations",
    post: true,
  },
  {
    tool: "list_financial_metrics",
    handler: catalog.methods.GET,
    path: "financials/metrics",
    args: {},
    endpoint: "financials",
  },
  {
    tool: "list_company_financial_metrics",
    handler: financial.methods.GET,
    path: "financials/AAPL/metrics",
    params: { metric: "metrics" },
    args: { symbol: "AAPL" },
    endpoint: "financials",
  },
  {
    tool: "get_company_financial_metric",
    handler: financial.methods.GET,
    path: "financials/AAPL/revenue",
    args: { symbol: "AAPL", metric: "revenue" },
    endpoint: "financials",
  },
  {
    tool: "get_company_financials",
    handler: batch.methods.POST,
    path: "financials",
    args: { symbol: "AAPL", metrics: ["revenue"] },
    endpoint: "financials",
    post: true,
  },
];
async function rest(testCase: Case) {
  if (!testCase.handler) throw new Error("Missing route");
  return testCase.handler({
    request: new Request(`https://example.com/api/v1/${testCase.path}`, {
      method: testCase.post ? "POST" : "GET",
      headers: { authorization: "Bearer user_1" },
      ...(testCase.post ? { body: JSON.stringify(testCase.args) } : {}),
    }),
    params: {
      documentId: "doc_1",
      symbol: "AAPL",
      metric: "revenue",
      ...testCase.params,
    },
  });
}

async function assertParity(
  testCase: Case,
  version: string,
  status = 200,
  charged = true,
) {
  const response = await rest(testCase);
  const restBody: unknown = await response.json();
  const restCalls = mocks.quota.mock.calls.slice();
  const result = await call(testCase.tool, testCase.args, version);
  expect(result.structuredContent).toEqual(restBody);
  expect(result.content).toEqual([
    { type: "text", text: JSON.stringify(restBody) },
  ]);
  expect(response.status).toBe(status);
  expect(result._meta.httpStatus).toBe(status);
  expect(result.isError ?? false).toBe(status >= 400);
  expect(mocks.quota).toHaveBeenCalledTimes(charged ? 2 : 0);
  if (charged) {
    expect(mocks.quota.mock.calls[1]).toEqual(restCalls[0]);
    expect(restCalls[0]?.slice(0, 2)).toEqual(["user_1", testCase.endpoint]);
  }
}

describe.each(["2026-07-28", "2025-11-25", "2025-03-26"])(
  "MCP %s",
  (version) => {
    it.each(cases)(
      "matches REST defaults, JSON and billing: $tool",
      async (testCase) => {
        await assertParity(testCase, version);
      },
    );
    it("discovers all tools and embedded mappings without quota", async () => {
      const discovery =
        version === "2026-07-28"
          ? await rpc("server/discover", {}, version)
          : await rpc(
              "initialize",
              {
                protocolVersion: version,
                capabilities: {},
                clientInfo: { name: "test", version: "1" },
              },
              version,
            );
      expect(discovery.error).toBeUndefined();
      expect(discovery.result?.instructions).toContain("no skill installation");
      const listed = await rpc("tools/list", {}, version);
      const tools = z
        .array(
          z.object({
            name: z.string(),
            description: z.string(),
            inputSchema: object,
          }),
        )
        .parse(listed.result?.tools);
      expect(tools.map((tool) => tool.name)).toEqual(
        cases.map((testCase) => testCase.tool),
      );
      const single = tools.find(
        (tool) => tool.name === "get_company_financial_metric",
      );
      expect(JSON.stringify(single)).toContain("capex → capitalExpenditures");
      expect(JSON.stringify(single)).toContain(
        JSON.stringify(financialMetricIds),
      );
      expect(mocks.quota).not.toHaveBeenCalled();
    });
    it.each([
      [
        0,
        "takeaways/search?query=AI&limit=0&recent=true",
        { query: "AI", limit: 0, recent: true },
      ],
      [1, "takeaways/recent?limit=1000", { limit: 1000 }],
      [1, "takeaways/recent?limit=-10", { limit: -10 }],
      [
        2,
        "takeaways?ids=tak_2,%20,tak_1,tak_2",
        { ids: ["tak_2", " ", "tak_1", "tak_2"] },
      ],
      [
        4,
        "documents/doc_1/content?limit=50000",
        { documentId: "doc_1", limit: 50000 },
      ],
      [5, "macro/series?query=unemployment", { query: "unemployment" }],
      [10, "financials", { symbol: " AAPL ", metrics: [" revenue "] }],
      [
        9,
        "financials/AAPL/revenue?period=annual&limit=40&include=provenance",
        {
          symbol: "AAPL",
          metric: "revenue",
          period: "annual",
          limit: 40,
          include: "provenance",
        },
      ],
    ] as const)(
      "preserves options and bounds %s",
      async (index, path, args) => {
        const base = cases[index];
        if (!base) throw new Error("Missing case");
        await assertParity({ ...base, path, args }, version);
      },
    );
    it.each([
      [0, "takeaways/search", {}, 400],
      [1, "takeaways/recent?limit=invalid", { limit: "invalid" }, 400],
      [2, "takeaways", {}, 400],
      [3, "documents?ids=,,", { ids: ["", ""] }, 400],
      [
        4,
        "documents/doc_1/content?offset=-1",
        { documentId: "doc_1", offset: -1 },
        400,
      ],
      [6, "macro/observations", { series: [{ id: "UNKNOWN" }] }, 400],
      [
        6,
        "macro/observations",
        {
          series: [
            { id: "UNRATE", startDate: "2026-02-30", endDate: "2026-03-01" },
          ],
        },
        400,
      ],
      [
        6,
        "macro/observations",
        {
          series: [
            {
              id: "UNRATE",
              lastN: 12,
              startDate: "2026-01-01",
              endDate: "2026-03-01",
            },
          ],
        },
        400,
      ],
      [
        6,
        "macro/observations",
        { series: [{ id: "UNRATE", frequency: "d" }] },
        400,
      ],
      [
        8,
        "financials/AAPL/metrics?period=invalid",
        { symbol: "AAPL", period: "invalid" },
        400,
      ],
      [
        9,
        "financials/AAPL/revenue?limit=41",
        { symbol: "AAPL", metric: "revenue", limit: 41 },
        400,
      ],
      [10, "financials", { symbol: "AAPL", metrics: ["unknown"] }, 404],
      [
        10,
        "financials",
        { symbol: "AAPL", metrics: ["revenue", "revenue"] },
        400,
      ],
    ] as const)(
      "preserves validation errors without billing %s %s",
      async (index, path, args, status) => {
        const base = cases[index];
        if (!base) throw new Error("Missing case");
        await assertParity({ ...base, path, args }, version, status, false);
      },
    );
    it("retains canonical metric error status and body", async () => {
      const base = cases[9];
      if (!base) throw new Error("Missing case");
      await assertParity(
        {
          ...base,
          params: { metric: "unknown" },
          path: "financials/AAPL/unknown",
          args: { symbol: "AAPL", metric: "unknown" },
        },
        version,
        404,
        false,
      );
    });
    it.each(["missing", "offset"])(
      "bills document execution error %s",
      async (failure) => {
        const base = cases[4];
        if (!base) throw new Error("Missing case");
        if (failure === "missing") mocks.content.mockResolvedValue(null);
        await assertParity(
          {
            ...base,
            path: "documents/doc_1/content?offset=7",
            args: { documentId: "doc_1", offset: 7 },
          },
          version,
          failure === "missing" ? 404 : 400,
        );
      },
    );
    it.each([
      "COMPANY_NOT_FOUND",
      "METRIC_UNAVAILABLE",
      "SEC_UNAVAILABLE",
    ] as const)("bills financial failure %s once", async (code) => {
      const status = code === "SEC_UNAVAILABLE" ? 502 : 404;
      mocks.single.mockRejectedValue(
        new FinancialApiError(code, "Provider error", status),
      );
      const base = cases[9];
      if (!base) throw new Error("Missing case");
      await assertParity(base, version, status);
    });
    it("bills partial financial results once", async () => {
      mocks.batch.mockResolvedValue({
        metrics: { revenue: { data: [] } },
        errors: {
          inventory: { code: "METRIC_UNAVAILABLE", message: "Unavailable" },
        },
      });
      const base = cases[10];
      if (!base) throw new Error("Missing case");
      await assertParity(
        {
          ...base,
          args: { symbol: "AAPL", metrics: ["revenue", "inventory"] },
        },
        version,
      );
    });
    it.each([true, false])(
      "bills macro partial/all failure once (all=%s)",
      async (all) => {
        mocks.macro.mockResolvedValue({
          items: all ? [] : [{ seriesId: "UNRATE", observations: [] }],
          errors: [{ seriesId: "ICSA", message: "Unavailable" }],
        });
        const base = cases[6];
        if (!base) throw new Error("Missing case");
        await assertParity(
          { ...base, args: { series: [{ id: "UNRATE" }, { id: "ICSA" }] } },
          version,
          all ? 502 : 200,
        );
      },
    );
    it("does not bill unknown tools or protocol errors", async () => {
      const unknown = await rpc(
        "tools/call",
        { name: "not_a_tool", arguments: {} },
        version,
      );
      expect(unknown.error ?? unknown.result?.isError).toBeTruthy();
      expect((await rpc("not_a_method", {}, version)).error).toBeDefined();
      expect(mocks.quota).not.toHaveBeenCalled();
    });
  },
);

it("keeps concurrent request identities isolated", async () => {
  await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      call(
        "get_recent_takeaways",
        {},
        i % 2 ? "2025-11-25" : "2026-07-28",
        `user_${i}`,
      ),
    ),
  );
  expect(mocks.quota.mock.calls.map((args) => String(args[0])).sort()).toEqual(
    Array.from({ length: 20 }, (_, i) => `user_${i}`).sort(),
  );
});
it.each(["GET", "DELETE", "PUT", "PATCH", "HEAD"])(
  "delegates %s method handling to the adapter without quota",
  async (method) => {
    const response = await handleMcpRequest(
      new Request("https://example.com/api/mcp", { method }),
    );
    expect(response.status).toBe(405);
    expect(mocks.quota).not.toHaveBeenCalled();
  },
);
