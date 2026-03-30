import { describe, expect, test, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

const findFirstMock = vi.fn();
const insertMock = vi.fn();
const authenticateMock = vi.fn();

let quotaTotal = 0;

vi.mock("~/postgres/db", () => {
  const onConflictDoUpdateMock = vi.fn().mockResolvedValue(undefined);
  const valuesMock = vi
    .fn()
    .mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock });
  insertMock.mockReturnValue({ values: valuesMock });

  const selectFn = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockImplementation(() => {
        return Promise.resolve([{ total: quotaTotal }]);
      }),
    }),
  });

  return {
    db: {
      query: { users: { findFirst: findFirstMock } },
      insert: insertMock,
      select: selectFn,
    },
    schema: {
      users: { id: "users.id", planTier: "users.planTier" },
      apiUsage: {
        userId: "api_usage.userId",
        month: "api_usage.month",
        endpoint: "api_usage.endpoint",
        requestCount: "api_usage.requestCount",
      },
    },
  };
});

vi.mock("~/server/api-keys", () => ({
  authenticate: authenticateMock,
}));

// Import after mocks are set up
const { checkAndIncrementQuota, authorizeApiRequest } = await import("./quota");

// ── Helpers ──────────────────────────────────────────────────────────────────

function setQuotaTotal(total: number) {
  quotaTotal = total;
}

beforeEach(() => {
  vi.clearAllMocks();
  setQuotaTotal(0);
  findFirstMock.mockResolvedValue({ planTier: "free" });
});

// ── checkAndIncrementQuota ───────────────────────────────────────────────────

describe("checkAndIncrementQuota", () => {
  // Normal case: user has headroom left, request should proceed.
  test("free user under limit is allowed", async () => {
    setQuotaTotal(50);
    const result = await checkAndIncrementQuota("user_1", "takeaways.search");

    expect(result).toEqual({ allowed: true, remaining: 50 });
  });

  // Boundary: the 100th request itself should succeed (limit is <=, not <).
  test("free user at exactly 100 is allowed (boundary)", async () => {
    setQuotaTotal(100);
    const result = await checkAndIncrementQuota("user_1", "takeaways.search");

    expect(result).toEqual({ allowed: true, remaining: 0 });
  });

  // The 101st request crosses the limit and should be rejected.
  test("free user at 101 is blocked", async () => {
    setQuotaTotal(101);
    const result = await checkAndIncrementQuota("user_1", "takeaways.search");

    expect(result).toEqual({ allowed: false, remaining: 0 });
  });

  // Paid users skip the limit check entirely — always allowed.
  test("unlimited user is always allowed with Infinity remaining", async () => {
    findFirstMock.mockResolvedValue({ planTier: "unlimited" });
    const result = await checkAndIncrementQuota("user_1", "takeaways.search");

    expect(result).toEqual({ allowed: true, remaining: Infinity });
  });

  // Even unlimited users get their usage recorded — needed for analytics
  // and future usage dashboards.
  test("unlimited user still triggers the upsert (usage tracking)", async () => {
    findFirstMock.mockResolvedValue({ planTier: "unlimited" });
    await checkAndIncrementQuota("user_1", "documents");

    expect(insertMock).toHaveBeenCalled();
  });

  // If the users row is missing (e.g. race condition during signup),
  // default to free tier limits rather than granting unlimited access.
  test("user not found defaults to free tier", async () => {
    findFirstMock.mockResolvedValue(null);
    setQuotaTotal(101);
    const result = await checkAndIncrementQuota("user_1", "research");

    expect(result).toEqual({ allowed: false, remaining: 0 });
  });
});

// ── authorizeApiRequest ──────────────────────────────────────────────────────

describe("authorizeApiRequest", () => {
  // No Bearer token or invalid API key — reject before checking quota.
  test("returns 401 when authentication fails", async () => {
    authenticateMock.mockResolvedValue(null);
    const request = new Request("https://example.com/api/v1/takeaways");

    const result = await authorizeApiRequest(request, "takeaways");

    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.response.status).toBe(401);
    }
  });

  // Valid API key but free tier limit already hit — return 429 with
  // rate-limit headers so clients can detect and handle programmatically.
  test("returns 429 when quota is exceeded", async () => {
    authenticateMock.mockResolvedValue("user_1");
    findFirstMock.mockResolvedValue({ planTier: "free" });
    setQuotaTotal(101);

    const request = new Request("https://example.com/api/v1/takeaways", {
      headers: { Authorization: "Bearer esak_test" },
    });

    const result = await authorizeApiRequest(request, "takeaways");

    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.response.status).toBe(429);
      expect(result.response.headers.get("X-RateLimit-Remaining")).toBe("0");
    }
  });

  // Happy path: valid key + quota available → return userId so the
  // route handler can use it for scoped queries.
  test("returns ok with userId when auth and quota pass", async () => {
    authenticateMock.mockResolvedValue("user_1");
    findFirstMock.mockResolvedValue({ planTier: "free" });
    setQuotaTotal(10);

    const request = new Request("https://example.com/api/v1/takeaways", {
      headers: { Authorization: "Bearer esak_test" },
    });

    const result = await authorizeApiRequest(request, "takeaways");

    expect(result).toEqual({ type: "ok", userId: "user_1" });
  });
});
