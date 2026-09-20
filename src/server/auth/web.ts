import * as oidc from "openid-client";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "~/postgres/db";
import { authConfig } from "./config";
import {
  cookie,
  hashToken,
  newToken,
  readCookie,
  revokeSession,
  SESSION_COOKIE,
  TRANSACTION_COOKIE,
  upsertUser,
} from "~/server/auth";

export function safeReturnTo(value: string | null) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value)
  )
    return "/";
  return value;
}
async function configuration() {
  const config = authConfig();
  const secret = process.env.AUTH0_WEB_CLIENT_SECRET;
  if (!secret) throw new Error("Missing AUTH0_WEB_CLIENT_SECRET");
  return oidc.discovery(new URL(config.issuer), config.clientId, secret);
}
function redirect(location: string, cookies: string[]) {
  const headers = new Headers({
    Location: location,
    "Cache-Control": "no-store",
  });
  for (const value of cookies) headers.append("Set-Cookie", value);
  return new Response(null, { status: 302, headers });
}
export async function login(request: Request) {
  if (process.env.AUTH0_DISABLED === "true")
    return new Response("Sign-in is unavailable on ephemeral previews.", {
      status: 503,
    });
  const config = authConfig();
  const client = await configuration();
  const token = newToken();
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const verifier = oidc.randomPKCECodeVerifier();
  await db.insert(schema.authTransactions).values({
    tokenHash: hashToken(token),
    state,
    nonce,
    verifier,
    returnTo: safeReturnTo(new URL(request.url).searchParams.get("returnTo")),
    expiresAt: new Date(Date.now() + 600_000),
  });
  const url = oidc.buildAuthorizationUrl(client, {
    redirect_uri: `${config.origin}/api/auth/callback`,
    scope: "openid profile email",
    state,
    nonce,
    code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
    code_challenge_method: "S256",
  });
  return redirect(url.href, [cookie(TRANSACTION_COOKIE, token, 600)]);
}
export async function callback(request: Request) {
  const clearTransaction = cookie(TRANSACTION_COOKIE, "", 0);
  try {
    const token = readCookie(request, TRANSACTION_COOKIE);
    if (!token) throw new Error("Missing transaction");
    // Atomic consume prevents callback replay across instances, including failed exchanges.
    const [transaction] = await db
      .delete(schema.authTransactions)
      .where(
        and(
          eq(schema.authTransactions.tokenHash, hashToken(token)),
          gt(schema.authTransactions.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!transaction) throw new Error("Expired transaction");
    const config = authConfig();
    const url = new URL(`${config.origin}/api/auth/callback`);
    url.search = new URL(request.url).search;
    const tokens = await oidc.authorizationCodeGrant(
      await configuration(),
      url,
      {
        pkceCodeVerifier: transaction.verifier,
        expectedState: transaction.state,
        expectedNonce: transaction.nonce,
        idTokenExpected: true,
      },
    );
    const claims = z
      .object({
        sub: z.string().min(1),
        email: z.email(),
        email_verified: z.literal(true),
        name: z.string().optional(),
        nickname: z.string().optional(),
        sid: z.string().optional(),
      })
      .parse(tokens.claims());
    const user = await upsertUser(claims.sub, {
      email: claims.email,
      displayName: claims.name,
      nickname: claims.nickname,
    });
    await revokeSession(request);
    const sessionToken = newToken();
    await db.insert(schema.authSessions).values({
      tokenHash: hashToken(sessionToken),
      userId: user.id,
      auth0Sid: claims.sid,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    return redirect(`${config.origin}${safeReturnTo(transaction.returnTo)}`, [
      clearTransaction,
      cookie(SESSION_COOKIE, sessionToken, 86_400),
    ]);
  } catch {
    return new Response(
      "Sign-in failed. Please start again and use a verified email address.",
      {
        status: 400,
        headers: {
          "Set-Cookie": clearTransaction,
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
export async function logout(request: Request) {
  const config = authConfig();
  if (request.headers.get("origin") !== config.origin)
    return new Response("Forbidden", { status: 403 });
  await revokeSession(request);
  const url = new URL("v2/logout", config.issuer);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("returnTo", config.origin);
  return redirect(url.href, [
    cookie(SESSION_COOKIE, "", 0),
    cookie(TRANSACTION_COOKIE, "", 0),
  ]);
}
const logoutClaims = z
  .object({
    sub: z.string().min(1).optional(),
    sid: z.string().min(1).optional(),
    nonce: z.never().optional(),
    iat: z.number(),
    jti: z.string().min(1),
    events: z.object({
      "http://schemas.openid.net/event/backchannel-logout": z
        .object({})
        .strict(),
    }),
  })
  .refine((value) => !!(value.sid ?? value.sub));
export async function verifyLogoutToken(token: string, key?: JWTVerifyGetKey) {
  const config = authConfig();
  const { payload } = await jwtVerify(
    token,
    key ?? createRemoteJWKSet(new URL(".well-known/jwks.json", config.issuer)),
    {
      issuer: config.issuer,
      audience: config.clientId,
      algorithms: ["RS256"],
      maxTokenAge: "5m",
      requiredClaims: ["iat", "jti"],
    },
  );
  return logoutClaims.parse(payload);
}
export async function backchannel(request: Request) {
  try {
    const token = (await request.formData()).get("logout_token");
    if (typeof token !== "string") throw new Error("Missing token");
    const claims = await verifyLogoutToken(token);
    const user = claims.sub
      ? await db.query.users.findFirst({
          where: eq(schema.users.auth0Subject, claims.sub),
        })
      : undefined;
    if (claims.sub && !user) return new Response(null, { status: 200 });
    // With both identifiers present they must refer to the same session.
    await db
      .update(schema.authSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          claims.sid ? eq(schema.authSessions.auth0Sid, claims.sid) : undefined,
          user ? eq(schema.authSessions.userId, user.id) : undefined,
        ),
      );
    return new Response(null, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return new Response("Invalid logout token", { status: 400 });
  }
}
