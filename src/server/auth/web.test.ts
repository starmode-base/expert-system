import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  values: vi.fn(),
  consume: vi.fn(),
  exchange: vi.fn(),
  revoke: vi.fn(),
  upsert: vi.fn(),
  session: vi.fn(),
}));
vi.mock("~/postgres/db", async () => {
  const schema = await import("~/postgres/schema");
  return {
    schema,
    db: {
      insert: () => ({ values: mocks.values }),
      delete: () => ({ where: () => ({ returning: mocks.consume }) }),
    },
  };
});
vi.mock("~/server/auth", async (original) => ({
  ...(await original<typeof import("~/server/auth")>()),
  revokeSession: mocks.revoke,
  upsertUser: mocks.upsert,
}));
vi.mock("openid-client", async (original) => ({
  ...(await original<typeof import("openid-client")>()),
  discovery: () => Promise.resolve({}),
  buildAuthorizationUrl: (_: unknown, params: Record<string, string>) =>
    new URL(
      `https://issuer.example/authorize?${new URLSearchParams(params).toString()}`,
    ),
  authorizationCodeGrant: mocks.exchange,
}));
import { callback, login, logout, safeReturnTo } from "./web";
import {
  cookie,
  hashToken,
  SESSION_COOKIE,
  TRANSACTION_COOKIE,
} from "~/server/auth";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH0_ISSUER", "https://issuer.example/");
  vi.stubEnv("AUTH0_WEB_CLIENT_ID", "web");
  vi.stubEnv("AUTH0_WEB_CLIENT_SECRET", "secret");
  vi.stubEnv("SITE_ORIGIN", "https://site.example");
  vi.stubEnv("AUTH0_MCP_RESOURCE", "https://site.example/api/mcp");
  mocks.upsert.mockResolvedValue({ id: "stable-user" });
  mocks.consume.mockResolvedValue([
    {
      state: "state",
      nonce: "nonce",
      verifier: "verifier",
      returnTo: "/account/usage",
    },
  ]);
  mocks.exchange.mockResolvedValue({
    claims: () => ({
      sub: "auth0|one",
      email: "one@example.com",
      email_verified: true,
      sid: "sid",
    }),
  });
});
const request = () =>
  new Request("https://site.example/api/auth/callback?code=code&state=state", {
    headers: {
      cookie: `${TRANSACTION_COOKIE}=transaction; ${SESSION_COOKIE}=old-session`,
    },
  });
describe("web OAuth", () => {
  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\r\nevil",
    null,
  ])("rejects unsafe return path %s", (path) => {
    expect(safeReturnTo(path)).toBe("/");
  });
  it("allows safe same-origin paths", () => {
    expect(safeReturnTo("/account/usage?x=1")).toBe("/account/usage?x=1");
  });
  it("stores a hashed transaction and sends state, nonce and S256", async () => {
    const response = await login(
      new Request("https://site.example/api/auth/login?returnTo=/pricing"),
    );
    const url = new URL(response.headers.get("location") ?? "");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toHaveLength(43);
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(url.searchParams.get("nonce")).toBeTruthy();
    const cookieValue =
      response.headers.get("set-cookie")?.split(";")[0]?.split("=")[1] ?? "";
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenHash: hashToken(cookieValue),
        returnTo: "/pricing",
        state: url.searchParams.get("state"),
        nonce: url.searchParams.get("nonce"),
      }),
    );
    expect(response.headers.get("set-cookie")).toContain(
      "HttpOnly; Secure; SameSite=Lax",
    );
  });
  it("passes state, nonce and PKCE to the validating OIDC exchange and rotates the session", async () => {
    const response = await callback(request());
    expect(response.status).toBe(302);
    expect(mocks.exchange).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(URL),
      {
        expectedState: "state",
        expectedNonce: "nonce",
        pkceCodeVerifier: "verifier",
        idTokenExpected: true,
      },
    );
    expect(mocks.revoke).toHaveBeenCalledWith(expect.any(Request));
    expect(response.headers.get("location")).toBe(
      "https://site.example/account/usage",
    );
    const cookies = response.headers.getSetCookie();
    const sessionCookie =
      cookies.find((c) => c.startsWith(SESSION_COOKIE)) ?? "";
    const raw = sessionCookie.split(";")[0]?.split("=")[1] ?? "";
    expect(raw).not.toBe("old-session");
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "stable-user",
        tokenHash: hashToken(raw),
        auth0Sid: "sid",
      }),
    );
  });
  it.each(["state", "nonce", "PKCE"])(
    "does not create a session if OIDC rejects %s",
    async (reason) => {
      mocks.exchange.mockRejectedValueOnce(new Error(reason));
      expect((await callback(request())).status).toBe(400);
      expect(mocks.upsert).not.toHaveBeenCalled();
      expect(mocks.values).not.toHaveBeenCalled();
    },
  );
  it("rejects expired or replayed transactions", async () => {
    mocks.consume.mockResolvedValue([]);
    expect((await callback(request())).status).toBe(400);
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
  it("rejects missing cookie", async () => {
    expect(
      (
        await callback(
          new Request("https://site.example/api/auth/callback?code=x"),
        )
      ).status,
    ).toBe(400);
    expect(mocks.consume).not.toHaveBeenCalled();
  });
  it("requires verified email for web sessions", async () => {
    mocks.exchange.mockResolvedValue({
      claims: () => ({
        sub: "auth0|one",
        email: "one@example.com",
        email_verified: false,
      }),
    });
    const response = await callback(request());
    expect(response.status).toBe(403);
    expect(await response.text()).toContain("not verified");
    expect(response.headers.get("set-cookie")).toContain(
      `${TRANSACTION_COOKIE}=;`,
    );
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.values).not.toHaveBeenCalled();
  });
  it("logout revokes the session and clears cookies before Auth0 redirect", async () => {
    const response = await logout(
      new Request("https://site.example/api/auth/logout", {
        method: "POST",
        headers: { origin: "https://site.example" },
      }),
    );
    expect(mocks.revoke).toHaveBeenCalled();
    expect(response.headers.getSetCookie()).toHaveLength(2);
    expect(response.headers.get("location")).toContain(
      "https://issuer.example/v2/logout",
    );
  });
  it("prevents cross-origin logout", async () => {
    expect(
      (
        await logout(
          new Request("https://site.example/api/auth/logout", {
            method: "POST",
            headers: { origin: "https://evil.example" },
          }),
        )
      ).status,
    ).toBe(403);
    expect(mocks.revoke).not.toHaveBeenCalled();
  });
  it("sets host-only secure cookie flags", () => {
    expect(cookie(SESSION_COOKIE, "token", 86400)).toBe(
      `${SESSION_COOKIE}=token; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`,
    );
  });
});
