import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWTPayload,
} from "jose";
const mocks = vi.hoisted(() => ({ update: vi.fn(), user: vi.fn() }));
vi.mock("~/postgres/db", async () => ({
  schema: await import("~/postgres/schema"),
  db: {
    update: () => ({ set: () => ({ where: mocks.update }) }),
    query: { users: { findFirst: mocks.user } },
  },
}));
import { verifyLogoutToken } from "./web";
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let key: ReturnType<typeof createLocalJWKSet>;
beforeAll(async () => {
  keys = await generateKeyPair("RS256");
  key = createLocalJWKSet({
    keys: [{ ...(await exportJWK(keys.publicKey)), kid: "logout" }],
  });
});
beforeEach(() => {
  vi.stubEnv("AUTH0_ISSUER", "https://issuer.example/");
  vi.stubEnv("AUTH0_WEB_CLIENT_ID", "web");
  vi.stubEnv("SITE_ORIGIN", "https://site.example");
  vi.stubEnv("AUTH0_MCP_RESOURCE", "https://site.example/api/mcp");
});
async function token(overrides: JWTPayload = {}) {
  return new SignJWT({
    iss: "https://issuer.example/",
    aud: "web",
    iat: Math.floor(Date.now() / 1000),
    jti: "id",
    sid: "sid",
    events: { "http://schemas.openid.net/event/backchannel-logout": {} },
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: "logout" })
    .sign(keys.privateKey);
}
describe("back-channel logout token validation", () => {
  it("accepts session logout", async () => {
    expect(await verifyLogoutToken(await token(), key)).toMatchObject({
      sid: "sid",
    });
  });
  it("accepts subject logout", async () => {
    expect(
      await verifyLogoutToken(
        await token({ sid: undefined, sub: "auth0|one" }),
        key,
      ),
    ).toMatchObject({ sub: "auth0|one" });
  });
  it.each([
    { iss: "wrong" },
    { aud: "other" },
    { nonce: "forbidden" },
    { sid: undefined },
    { events: {} },
    {
      events: {
        "http://schemas.openid.net/event/backchannel-logout": {
          unexpected: true,
        },
      },
    },
    { iat: 1 },
    { iat: 9999999999 },
    { jti: undefined },
    { exp: 1 },
  ])("rejects invalid logout claims %j", async (claims) => {
    await expect(verifyLogoutToken(await token(claims), key)).rejects.toThrow();
  });
  it("rejects signature tampering", async () => {
    const other = await generateKeyPair("RS256");
    const wrong = createLocalJWKSet({
      keys: [{ ...(await exportJWK(other.publicKey)), kid: "logout" }],
    });
    await expect(verifyLogoutToken(await token(), wrong)).rejects.toThrow();
  });
});
