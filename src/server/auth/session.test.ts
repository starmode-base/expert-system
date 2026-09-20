import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  predicate: vi.fn(),
  revoked: vi.fn(),
  values: vi.fn(),
  conflict: vi.fn(),
}));
vi.mock("~/postgres/db", async () => ({
  schema: await import("~/postgres/schema"),
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: (where: SQL) => {
            mocks.predicate(where);
            return { limit: mocks.session };
          },
        }),
      }),
    }),
    update: () => ({ set: mocks.revoked }),
    insert: () => ({
      values: (values: unknown) => {
        mocks.values(values);
        return {
          onConflictDoUpdate: (value: unknown) => {
            mocks.conflict(value);
            return {
              returning: () =>
                Promise.resolve([{ id: "stable", auth0Subject: "auth0|one" }]),
            };
          },
        };
      },
    }),
  },
}));
import {
  getSessionUser,
  hashToken,
  revokeSession,
  SESSION_COOKIE,
  upsertUser,
} from "~/server/auth";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue([]);
  mocks.revoked.mockReturnValue({ where: () => Promise.resolve() });
});
describe("local identity and sessions", () => {
  it("does not query without the opaque cookie", async () => {
    expect(
      await getSessionUser(new Request("https://site.example")),
    ).toBeNull();
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it("resolves only hashed, unrevoked, unexpired sessions", async () => {
    const user = { id: "stable", auth0Subject: "auth0|one" };
    mocks.session.mockResolvedValue([{ user }]);
    expect(
      await getSessionUser(
        new Request("https://site.example", {
          headers: { cookie: `${SESSION_COOKIE}=raw` },
        }),
      ),
    ).toEqual(user);
    const where: unknown = mocks.predicate.mock.calls[0]?.[0];
    const query = new PgDialect().sqlToQuery(where as SQL);
    expect(query.params).toContain(hashToken("raw"));
    expect(query.params).not.toContain("raw");
    expect(query.sql).toContain('"revokedAt" is null');
    expect(query.sql).toContain('"expiresAt" >');
  });
  it("rejects absent, expired and revoked sessions returned by the filtered lookup", async () => {
    expect(
      await getSessionUser(
        new Request("https://site.example", {
          headers: { cookie: `${SESSION_COOKIE}=expired` },
        }),
      ),
    ).toBeNull();
  });
  it("revokes local sessions", async () => {
    await revokeSession(
      new Request("https://site.example", {
        headers: { cookie: `${SESSION_COOKIE}=raw` },
      }),
    );
    expect(mocks.revoked).toHaveBeenCalledOnce();
  });
  it("provisions subject-only users and enriches the same identity on verified web login", async () => {
    expect((await upsertUser("auth0|one")).id).toBe("stable");
    expect(mocks.values).toHaveBeenLastCalledWith({
      auth0Subject: "auth0|one",
    });
    expect(
      (
        await upsertUser("auth0|one", {
          email: "one@example.com",
          displayName: "One",
        })
      ).id,
    ).toBe("stable");
    expect(mocks.conflict).toHaveBeenLastCalledWith(
      expect.objectContaining({
        set: { email: "one@example.com", displayName: "One" },
      }),
    );
  });
});
