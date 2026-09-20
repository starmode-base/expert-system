import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
const mocks = vi.hoisted(() => ({
  jwt: vi.fn(),
  user: vi.fn(),
  update: vi.fn(),
}));
vi.mock("jose", () => ({ createRemoteJWKSet: vi.fn(), jwtVerify: mocks.jwt }));
vi.mock("~/postgres/db", async () => ({
  schema: await import("~/postgres/schema"),
  db: {
    update: () => ({ set: () => ({ where: mocks.update }) }),
    query: { users: { findFirst: mocks.user } },
  },
}));
import { backchannel } from "./web";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH0_ISSUER", "https://issuer.example/");
  vi.stubEnv("AUTH0_WEB_CLIENT_ID", "web");
  vi.stubEnv("SITE_ORIGIN", "https://site.example");
  vi.stubEnv("AUTH0_MCP_RESOURCE", "https://site.example/api/mcp");
  mocks.jwt.mockResolvedValue({
    payload: {
      iat: 1,
      jti: "jti",
      sid: "sid",
      sub: "auth0|one",
      events: { "http://schemas.openid.net/event/backchannel-logout": {} },
    },
  });
  mocks.user.mockResolvedValue({ id: "internal-one" });
});
const request = () =>
  new Request("https://site.example/api/auth/backchannel", {
    method: "POST",
    body: new URLSearchParams({ logout_token: "signed" }),
  });
it("revokes only sessions matching both subject and sid", async () => {
  expect((await backchannel(request())).status).toBe(200);
  const where: unknown = mocks.update.mock.calls[0]?.[0];
  const query = new PgDialect().sqlToQuery(where as SQL);
  expect(query.params).toEqual(["sid", "internal-one"]);
  expect(query.sql).toContain(" and ");
});
it("does not revoke another user's sessions for an unknown subject", async () => {
  mocks.user.mockResolvedValue(undefined);
  expect((await backchannel(request())).status).toBe(200);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("does not change sessions for an invalid token", async () => {
  mocks.jwt.mockRejectedValue(new Error("Invalid signature"));
  expect((await backchannel(request())).status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});
