import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { z } from "zod";
import {
  CLIENT_CAPABILITIES_META_KEY,
  PROTOCOL_VERSION_META_KEY,
} from "@modelcontextprotocol/server";

const state = vi.hoisted(() => ({
  keys: new Map<string, { id: string; userId: string; revoked: boolean }>(),
  tiers: new Map<string, string>(),
  usage: new Map<string, number>(),
  charges: [] as {
    userId: string;
    endpoint: string;
    month: string;
    requestCount: number;
  }[],
  search: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      validator: () => builder,
      handler: () => vi.fn(),
    };
    return builder;
  },
}));
vi.mock("~/middleware/auth-middleware", () => ({ authMiddleware: {} }));
vi.mock("~/postgres/db", async () => {
  const schema = await import("~/postgres/schema");
  function params(where: SQL): unknown[] {
    return new PgDialect().sqlToQuery(where).params;
  }
  return {
    schema,
    db: {
      query: {
        apiKeys: {
          findFirst: ({ where }: { where: SQL }) => {
            const sql = new PgDialect().sqlToQuery(where);
            // Exercise the real key resolver's revocation predicate, not an auth stub.
            expect(sql.sql).toContain('"revokedAt" is null');
            const key = state.keys.get(String(sql.params[0]));
            return Promise.resolve(key && !key.revoked ? key : undefined);
          },
        },
        users: {
          findFirst: ({ where }: { where: SQL }) =>
            Promise.resolve({
              planTier: state.tiers.get(String(params(where)[0])) ?? "free",
            }),
        },
      },
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
      insert: () => ({
        values: (entry: (typeof state.charges)[number]) => ({
          onConflictDoUpdate: () => {
            state.charges.push(entry);
            const key = `${entry.userId}/${entry.month}/${entry.endpoint}`;
            state.usage.set(key, (state.usage.get(key) ?? 0) + 1);
            return Promise.resolve();
          },
        }),
      }),
      select: () => ({
        from: () => ({
          where: (where: SQL) => {
            const [userId, month] = params(where);
            const prefix = `${String(userId)}/${String(month)}/`;
            const total = [...state.usage].reduce(
              (sum, [key, value]) => sum + (key.startsWith(prefix) ? value : 0),
              0,
            );
            return Promise.resolve([{ total }]);
          },
        }),
      }),
    },
  };
});
vi.mock("~/server/public-api/research", () => ({
  MAX_PUBLIC_IDS: 50,
  searchTakeawayPreviews: state.search,
  getRecentTakeawayPreviews: vi.fn(),
  getTakeawaysByIds: vi.fn(),
  getDocumentsByIds: vi.fn(),
  getDocumentContent: vi.fn(),
}));
vi.mock("~/server/financials/service", () => ({
  getSingleFinancialMetric: vi.fn(),
  getBatchFinancialMetrics: vi.fn(),
  getCompanyFinancialCatalog: vi.fn(),
}));

const { handleMcpRequest } = await import("./handler");
const { searchTakeaways } = await import(
  "~/server/public-api/research-operations"
);
const { queryInput, runRestOperation } = await import(
  "~/server/public-api/rest"
);

async function addKey(token: string, userId: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  const hash = Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const key = { id: hash, userId, revoked: false };
  state.keys.set(hash, key);
  return key;
}
function request(
  name: string,
  args: Record<string, unknown> = {},
  token: string | null = "esak_valid",
  version = "2026-07-28",
) {
  return new Request("https://example.com/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "Mcp-Method": "tools/call",
      "Mcp-Name": name,
      "Mcp-Protocol-Version": version,
      ...(token === null ? {} : { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name,
        arguments: args,
        ...(version === "2026-07-28"
          ? {
              _meta: {
                [PROTOCOL_VERSION_META_KEY]: version,
                [CLIENT_CAPABILITIES_META_KEY]: {},
              },
            }
          : {}),
      },
    }),
  });
}
async function call(
  name: string,
  args: Record<string, unknown> = {},
  token = "esak_valid",
  version = "2026-07-28",
) {
  const response = await handleMcpRequest(request(name, args, token, version));
  const text = await response.text();
  const payload = text.startsWith("event:")
    ? text
        .split("\n")
        .find((line) => line.startsWith("data: "))
        ?.slice(6)
    : text;
  const body: unknown = JSON.parse(payload ?? "null");
  return z
    .object({
      result: z.object({
        isError: z.boolean().optional(),
        structuredContent: z.record(z.string(), z.unknown()),
        _meta: z.object({ httpStatus: z.number() }).loose(),
      }),
    })
    .parse(body).result;
}
function rest(token = "esak_valid", query = "?query=AI") {
  const req = new Request(
    `https://example.com/api/v1/takeaways/search${query}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  return runRestOperation(req, searchTakeaways, () => queryInput(req));
}
function seed(user: string, endpoint: string, count: number) {
  state.usage.set(
    `${user}/${new Date().toISOString().slice(0, 7)}/${endpoint}`,
    count,
  );
}
beforeEach(async () => {
  vi.clearAllMocks();
  state.keys.clear();
  state.tiers.clear();
  state.usage.clear();
  state.charges.length = 0;
  state.search.mockResolvedValue([]);
  await addKey("esak_valid", "user_1");
});

it.each([null, "invalid", "esak_unknown"])(
  "rejects missing/invalid credentials %s before validation and billing",
  async (token) => {
    const response = await handleMcpRequest(
      request("search_takeaways", {}, token),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Unauthorized" },
    });
    expect(state.charges).toHaveLength(0);
    expect(state.search).not.toHaveBeenCalled();
  },
);
it("rejects a revoked key on the very next REST and MCP request", async () => {
  const key = await addKey("esak_revoke", "user_1");
  expect(
    (await call("search_takeaways", { query: "AI" }, "esak_revoke"))._meta
      .httpStatus,
  ).toBe(200);
  key.revoked = true;
  expect(
    (
      await handleMcpRequest(
        request("search_takeaways", { query: "AI" }, "esak_revoke"),
      )
    ).status,
  ).toBe(401);
  expect((await rest("esak_revoke")).status).toBe(401);
  expect(state.charges).toHaveLength(1);
});
describe.each(["2026-07-28", "2025-11-25"])("billing through %s", (version) => {
  it("shares the 100-request allowance across REST/MCP and endpoint buckets", async () => {
    seed("user_1", "documents", 98);
    expect((await rest()).status).toBe(200);
    expect(
      (await call("list_financial_metrics", {}, "esak_valid", version))._meta
        .httpStatus,
    ).toBe(200);
    const over = await call(
      "search_takeaways",
      { query: "AI" },
      "esak_valid",
      version,
    );
    expect(over._meta.httpStatus).toBe(429);
    expect(over.isError).toBe(true);
    expect(over.structuredContent).toEqual({
      error:
        "Monthly quota exceeded. Upgrade to Unlimited at expert-system.com/pricing.",
    });
    expect(over._meta.httpHeaders).toMatchObject({
      "x-ratelimit-remaining": "0",
      "x-ratelimit-limit": "100",
    });
    expect((await rest()).status).toBe(429);
    expect(state.charges.map((charge) => charge.endpoint)).toEqual([
      "takeaways.search",
      "financials",
      "takeaways.search",
      "takeaways.search",
    ]);
    expect(state.search).toHaveBeenCalledTimes(1);
  });
  it("does not charge invalid requests even at the quota boundary", async () => {
    seed("user_1", "documents", 100);
    expect((await rest("esak_valid", "")).status).toBe(400);
    expect(
      (await call("search_takeaways", {}, "esak_valid", version))._meta
        .httpStatus,
    ).toBe(400);
    expect(
      (
        await call(
          "get_company_financial_metric",
          { symbol: "AAPL", metric: "unknown" },
          "esak_valid",
          version,
        )
      )._meta.httpStatus,
    ).toBe(404);
    expect(state.charges).toHaveLength(0);
  });
  it("tracks unlimited usage while skipping the free-tier limit", async () => {
    state.tiers.set("user_1", "unlimited");
    seed("user_1", "documents", 1000);
    expect((await rest()).status).toBe(200);
    expect(
      (await call("search_takeaways", { query: "AI" }, "esak_valid", version))
        ._meta.httpStatus,
    ).toBe(200);
    expect(state.charges).toHaveLength(2);
  });
  it("charges unexpected provider exceptions exactly once", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    state.search.mockRejectedValue(new Error("provider unavailable"));
    try {
      expect(
        (await call("search_takeaways", { query: "AI" }, "esak_valid", version))
          ._meta.httpStatus,
      ).toBe(500);
      expect(state.charges).toHaveLength(1);
    } finally {
      log.mockRestore();
    }
  });
});
it("isolates concurrent users with different plans and keys", async () => {
  await addKey("esak_second", "user_2");
  seed("user_1", "documents", 100);
  seed("user_2", "documents", 1000);
  state.tiers.set("user_2", "unlimited");
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      call(
        "search_takeaways",
        { query: "AI" },
        i % 2 ? "esak_second" : "esak_valid",
      ),
    ),
  );
  expect(results.map((value) => value._meta.httpStatus)).toEqual(
    Array.from({ length: 12 }, (_, i) => (i % 2 ? 200 : 429)),
  );
  expect(
    state.charges.filter((charge) => charge.userId === "user_1"),
  ).toHaveLength(6);
  expect(
    state.charges.filter((charge) => charge.userId === "user_2"),
  ).toHaveLength(6);
});
