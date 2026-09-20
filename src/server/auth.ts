import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "~/postgres/db";

export const SESSION_COOKIE = "__Host-es_session";
export const TRANSACTION_COOKIE = "__Host-es_transaction";
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
export function cookie(name: string, token: string, maxAge: number) {
  return `${name}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
export function readCookie(request: Request, name: string) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}
export async function getSessionUser(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const [result] = await db
    .select({ user: schema.users })
    .from(schema.authSessions)
    .innerJoin(schema.users, eq(schema.authSessions.userId, schema.users.id))
    .where(
      and(
        eq(schema.authSessions.tokenHash, hashToken(token)),
        isNull(schema.authSessions.revokedAt),
        gt(schema.authSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return result?.user ?? null;
}
export async function getAuth0Subject(request: Request) {
  return (await getSessionUser(request))?.auth0Subject ?? null;
}
export async function getViewerId(request: Request) {
  return (await getSessionUser(request))?.id ?? null;
}
export async function revokeSession(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (token)
    await db
      .update(schema.authSessions)
      .set({ revokedAt: new Date() })
      .where(eq(schema.authSessions.tokenHash, hashToken(token)));
}
export async function upsertUser(
  subject: string,
  profile?: { email: string; displayName?: string; nickname?: string },
) {
  const [user] = await db
    .insert(schema.users)
    .values({ auth0Subject: subject, ...profile })
    .onConflictDoUpdate({
      target: schema.users.auth0Subject,
      set: profile ?? { auth0Subject: subject },
    })
    .returning();
  if (!user) throw new Error("Unable to provision identity");
  return user;
}

export async function isAccessTokenRevoked(token: string) {
  const revoked = await db.query.revokedMcpTokens.findFirst({
    where: eq(schema.revokedMcpTokens.tokenHash, hashToken(token)),
  });
  return !!revoked;
}
/** Administrative revocation; pass an already-verified token's expiration. */
export async function revokeAccessToken(token: string, expiresAt: number) {
  await db
    .insert(schema.revokedMcpTokens)
    .values({
      tokenHash: hashToken(token),
      expiresAt: new Date(expiresAt * 1000),
    })
    .onConflictDoNothing();
}
