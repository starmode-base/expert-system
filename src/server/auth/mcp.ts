import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { authConfig, MCP_SCOPE, METADATA_PATH } from "./config";
import { upsertUser, isAccessTokenRevoked } from "~/server/auth";

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
export async function verifyAccessToken(token: string, key?: JWTVerifyGetKey) {
  const config = authConfig();
  jwks ??= createRemoteJWKSet(new URL(".well-known/jwks.json", config.issuer));
  const { payload, protectedHeader } = await jwtVerify(token, key ?? jwks, {
    issuer: config.issuer,
    audience: config.resource,
    algorithms: ["RS256"],
    requiredClaims: ["sub", "exp", "iat", "client_id"],
  });
  // RFC 9068 distinguishes access tokens from ID tokens even for overlapping audiences.
  if (
    protectedHeader.typ !== "at+jwt" ||
    typeof payload.sub !== "string" ||
    !payload.sub ||
    typeof payload.client_id !== "string" ||
    !payload.client_id
  )
    throw new Error("Invalid access token");
  return {
    subject: payload.sub,
    clientId: payload.client_id,
    expiresAt: payload.exp,
    scopes:
      typeof payload.scope === "string"
        ? payload.scope.split(" ").filter(Boolean)
        : [],
  };
}
export function authFailure(status: 401 | 403, invalid = false) {
  const config = authConfig();
  const metadata = new URL(METADATA_PATH, config.resource).href;
  const error =
    status === 403
      ? ', error="insufficient_scope"'
      : invalid
        ? ', error="invalid_token"'
        : "";
  return Response.json(
    { error: status === 403 ? "insufficient_scope" : "unauthorized" },
    {
      status,
      headers: {
        "WWW-Authenticate": `Bearer resource_metadata="${metadata}"${error}, scope="${MCP_SCOPE}"`,
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "WWW-Authenticate",
      },
    },
  );
}
export async function authenticateMcpRequest(
  request: Request,
  verify = verifyAccessToken,
) {
  const authorization = request.headers.get("authorization");
  const match = /^Bearer ([^\s]+)$/i.exec(authorization ?? "");
  const token = match?.[1];
  if (!token)
    return {
      type: "error" as const,
      response: authFailure(401, !!authorization),
    };
  let principal;
  try {
    principal = await verify(token);
  } catch {
    return { type: "error" as const, response: authFailure(401, true) };
  }
  if (!principal.scopes.includes(MCP_SCOPE))
    return { type: "error" as const, response: authFailure(403) };
  if (await isAccessTokenRevoked(token))
    return { type: "error" as const, response: authFailure(401, true) };
  const user = await upsertUser(principal.subject);
  const info: AuthInfo = {
    token,
    clientId: principal.clientId,
    scopes: principal.scopes,
    expiresAt: principal.expiresAt,
    resource: new URL(authConfig().resource),
    extra: { userId: user.id, subject: principal.subject },
  };
  return { type: "ok" as const, userId: user.id, user, info };
}
export function oauthMetadata() {
  const config = authConfig();
  return Response.json(
    {
      resource: config.resource,
      authorization_servers: [config.issuer],
      scopes_supported: [MCP_SCOPE],
      bearer_methods_supported: ["header"],
      resource_documentation: `${new URL(config.resource).origin}/account/api-docs`,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300",
      },
    },
  );
}
export function oauthOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id, MCP-Method, MCP-Name",
      "Access-Control-Expose-Headers": "WWW-Authenticate, MCP-Session-Id",
    },
  });
}
