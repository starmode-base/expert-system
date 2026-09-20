import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWTPayload,
} from "jose";
const mocks = vi.hoisted(() => ({ upsert: vi.fn(), revoked: vi.fn() }));
vi.mock("~/server/auth", () => ({
  upsertUser: mocks.upsert,
  isAccessTokenRevoked: mocks.revoked,
}));
import {
  authFailure,
  oauthMetadata,
  oauthOptions,
  verifyAccessToken,
  authenticateMcpRequest,
} from "./mcp";
const issuer = "https://tenant.example/";
const resource = "https://expert.example/api/mcp";
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let resolveKey: ReturnType<typeof createLocalJWKSet>;
beforeAll(async () => {
  keys = await generateKeyPair("RS256");
  resolveKey = createLocalJWKSet({
    keys: [{ ...(await exportJWK(keys.publicKey)), kid: "test", alg: "RS256" }],
  });
});
beforeEach(() => {
  vi.stubEnv("AUTH0_ISSUER", issuer);
  vi.stubEnv("AUTH0_WEB_CLIENT_ID", "web");
  vi.stubEnv("AUTH0_MCP_RESOURCE", resource);
  vi.stubEnv("SITE_ORIGIN", "https://expert.example");
  mocks.upsert.mockClear();
  mocks.revoked.mockResolvedValue(false);
  mocks.upsert.mockImplementation((subject: string) =>
    Promise.resolve({ id: `internal-${subject}` }),
  );
});
async function token(
  overrides: JWTPayload = {},
  typ = "at+jwt",
  signingKey = keys.privateKey,
) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    iss: issuer,
    aud: resource,
    sub: "auth0|one",
    client_id: "client",
    scope: "expert-system:read",
    iat: now,
    exp: now + 600,
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test", typ })
    .sign(signingKey);
}
describe("OAuth access token validation", () => {
  it("accepts only a signed access token for the canonical resource", async () => {
    expect(await verifyAccessToken(await token(), resolveKey)).toMatchObject({
      subject: "auth0|one",
      clientId: "client",
      scopes: ["expert-system:read"],
    });
  });
  it.each([
    { iss: "https://wrong/" },
    { aud: "web" },
    { exp: 1 },
    { nbf: 9999999999 },
    { sub: "" },
    { sub: undefined },
    { exp: undefined },
    { client_id: undefined },
  ])("rejects invalid claims %j", async (claims) => {
    await expect(
      verifyAccessToken(await token(claims), resolveKey),
    ).rejects.toThrow();
  });
  it("rejects ID tokens even with the API audience", async () => {
    await expect(
      verifyAccessToken(await token({}, "JWT"), resolveKey),
    ).rejects.toThrow();
  });
  it("rejects a different signing key", async () => {
    const other = await generateKeyPair("RS256");
    await expect(
      verifyAccessToken(
        await token({}, "at+jwt", other.privateKey),
        resolveKey,
      ),
    ).rejects.toThrow();
  });
  it("keeps missing scope distinguishable from an invalid JWT", async () => {
    expect(
      (await verifyAccessToken(await token({ scope: undefined }), resolveKey))
        .scopes,
    ).toEqual([]);
  });
  it.each([
    undefined,
    "Bearer esak_test",
    "Bearer opaque-session",
    "Basic abc",
    "Bearer a b",
  ])(
    "rejects non-OAuth credentials without provisioning: %s",
    async (header) => {
      const result = await authenticateMcpRequest(
        new Request(resource, {
          headers: header ? { authorization: header } : {},
        }),
      );
      expect(result.type).toBe("error");
      if (result.type === "error") expect(result.response.status).toBe(401);
      expect(mocks.upsert).not.toHaveBeenCalled();
    },
  );
});
describe("OAuth discovery and challenges", () => {
  it("publishes exact canonical metadata and CORS", async () => {
    const response = oauthMetadata();
    expect(await response.json()).toEqual({
      resource,
      authorization_servers: [issuer],
      scopes_supported: ["expert-system:read"],
      bearer_methods_supported: ["header"],
      resource_documentation: "https://expert.example/account/api-docs",
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(oauthOptions().status).toBe(204);
    expect(
      oauthOptions().headers.get("Access-Control-Allow-Headers"),
    ).toContain("Authorization");
  });
  it.each([
    [401, false, ""],
    [401, true, ', error="invalid_token"'],
    [403, false, ', error="insufficient_scope"'],
  ] as const)("returns precise %s challenge", (status, invalid, error) => {
    const response = authFailure(status, invalid);
    expect(response.status).toBe(status);
    expect(response.headers.get("WWW-Authenticate")).toBe(
      `Bearer resource_metadata="https://expert.example/.well-known/oauth-protected-resource/api/mcp"${error}, scope="expert-system:read"`,
    );
  });
});

describe("MCP authorization and provisioning", () => {
  const req = () =>
    new Request(resource, { headers: { authorization: "Bearer token" } });
  const principal = {
    subject: "auth0|one",
    clientId: "client",
    expiresAt: 9999999999,
    scopes: ["expert-system:read"],
  };
  it("returns 403 without provisioning for a valid token missing scope", async () => {
    const result = await authenticateMcpRequest(req(), () =>
      Promise.resolve({ ...principal, scopes: [] }),
    );
    expect(result.type === "error" && result.response.status).toBe(403);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("rejects explicitly revoked tokens", async () => {
    mocks.revoked.mockResolvedValue(true);
    const result = await authenticateMcpRequest(req(), () =>
      Promise.resolve(principal),
    );
    expect(result.type === "error" && result.response.status).toBe(401);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("resolves stable identities independently for concurrent subjects", async () => {
    const results = await Promise.all(
      ["one", "two", "one"].map((subject) =>
        authenticateMcpRequest(req(), () =>
          Promise.resolve({ ...principal, subject }),
        ),
      ),
    );
    expect(results.map((r) => (r.type === "ok" ? r.userId : null))).toEqual([
      "internal-one",
      "internal-two",
      "internal-one",
    ]);
    expect(results[0]?.type === "ok" && results[0].info.extra).toEqual({
      userId: "internal-one",
      subject: "one",
    });
  });
});
