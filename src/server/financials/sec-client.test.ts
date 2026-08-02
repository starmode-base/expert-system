import { beforeEach, describe, expect, it, vi } from "vitest";
import { companyFactsFixtures } from "./__fixtures__/company-facts";

interface CacheRow {
  payload: unknown;
  fetchedAt: Date;
}

let outerRows: CacheRow[] = [];
let transactionRows: CacheRow[] = [];

const outerLimitMock = vi.fn(() => Promise.resolve(outerRows));
const transactionLimitMock = vi.fn(() => Promise.resolve(transactionRows));
const executeMock = vi.fn().mockResolvedValue(undefined);
const onConflictDoUpdateMock = vi.fn().mockResolvedValue(undefined);
const valuesMock = vi
  .fn()
  .mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock });
const insertMock = vi.fn().mockReturnValue({ values: valuesMock });

const transactionClient = {
  execute: executeMock,
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({ limit: transactionLimitMock })),
    })),
  })),
  insert: insertMock,
};

const transactionMock = vi.fn(
  async (callback: (client: typeof transactionClient) => Promise<unknown>) =>
    callback(transactionClient),
);

vi.mock("~/postgres/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: outerLimitMock })),
      })),
    })),
    transaction: transactionMock,
  },
  schema: {
    secCompanyFactsCache: {
      cik: "sec_company_facts_cache.cik",
      payload: "sec_company_facts_cache.payload",
      fetchedAt: "sec_company_facts_cache.fetched_at",
    },
  },
}));

const { getSecCompanyFacts, isSecCacheFresh, normalizeCik } = await import(
  "./sec-client"
);

const applePayload = companyFactsFixtures.apple;

beforeEach(() => {
  vi.clearAllMocks();
  outerRows = [];
  transactionRows = [];
});

describe("SEC company-facts client", () => {
  it("normalizes CIKs and rejects malformed identifiers", () => {
    expect(normalizeCik("CIK320193")).toBe("0000320193");
    expect(() => normalizeCik("not-a-cik")).toThrow("CIK must contain");
  });

  it("uses a cache entry only within the 15-minute TTL", () => {
    const now = new Date("2026-08-02T12:00:00Z");
    expect(isSecCacheFresh(new Date("2026-08-02T11:45:01Z"), now)).toBe(true);
    expect(isSecCacheFresh(new Date("2026-08-02T11:45:00Z"), now)).toBe(false);
  });

  it("returns a valid fresh cache entry without a transaction or SEC call", async () => {
    outerRows = [
      {
        payload: applePayload,
        fetchedAt: new Date("2026-08-02T11:55:00Z"),
      },
    ];
    const fetcher = vi.fn<typeof fetch>();

    const result = await getSecCompanyFacts("320193", {
      fetcher,
      now: () => new Date("2026-08-02T12:00:00Z"),
    });

    expect(result.entityName).toBe("Apple Inc.");
    expect(fetcher).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("refreshes an expired entry and writes the validated payload", async () => {
    const expired = {
      payload: applePayload,
      fetchedAt: new Date("2026-08-02T11:00:00Z"),
    };
    outerRows = [expired];
    transactionRows = [expired];
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ ...applePayload, cik: 320194 }));

    const result = await getSecCompanyFacts("320194", {
      fetcher,
      now: () => new Date("2026-08-02T12:00:00Z"),
    });

    expect(result.entityName).toBe("Apple Inc.");
    expect(fetcher).toHaveBeenCalledOnce();
    expect(insertMock).toHaveBeenCalledOnce();
    expect(onConflictDoUpdateMock).toHaveBeenCalledOnce();
  });

  it("never serves an expired entry when SEC is unavailable", async () => {
    const expired = {
      payload: applePayload,
      fetchedAt: new Date("2026-08-02T11:00:00Z"),
    };
    outerRows = [expired];
    transactionRows = [expired];
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("down"));

    await expect(
      getSecCompanyFacts("320195", {
        fetcher,
        now: () => new Date("2026-08-02T12:00:00Z"),
      }),
    ).rejects.toMatchObject({ code: "SEC_UNAVAILABLE" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("coalesces concurrent cache misses for the same CIK", async () => {
    let releaseFetch: ((response: Response) => void) | undefined;
    const fetcher = vi.fn<typeof fetch>(
      () =>
        new Promise<Response>((resolve) => {
          releaseFetch = resolve;
        }),
    );
    const options = {
      fetcher,
      now: () => new Date("2026-08-02T12:00:00Z"),
    };

    const first = getSecCompanyFacts("320196", options);
    const second = getSecCompanyFacts("320196", options);
    await vi.waitFor(() => {
      expect(fetcher).toHaveBeenCalledOnce();
    });
    releaseFetch?.(Response.json({ ...applePayload, cik: 320196 }));

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toEqual(secondResult);
    expect(transactionMock).toHaveBeenCalledOnce();
  });

  it("rejects malformed SEC payloads", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ unexpected: true }));

    await expect(
      getSecCompanyFacts("320197", {
        fetcher,
        now: () => new Date("2026-08-02T12:00:00Z"),
      }),
    ).rejects.toMatchObject({ code: "SEC_UNAVAILABLE" });
  });
});
