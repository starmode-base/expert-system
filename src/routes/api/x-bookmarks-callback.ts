import { createAPIFileRoute } from "@tanstack/react-start/api";
import crypto from "crypto";
import { db, schema } from "~/postgres/db";
import { eq } from "drizzle-orm";
import {
  exchangeCodeForTokens,
  createXClient,
  calculateExpiresAt,
} from "~/inngest/importers/scheduled/x-bookmarks/x-client";

const COOKIE_NAME = "x_oauth_session";

interface OAuthSessionData {
  state: string;
  codeVerifier: string;
  viewerId: string;
}

/**
 * Decrypt OAuth session from cookie
 */
function decryptSession(encrypted: string): OAuthSessionData | null {
  try {
    const key = crypto
      .createHash("sha256")
      .update(process.env.CLERK_SECRET_KEY ?? "")
      .digest();

    const [ivB64, authTagB64, data] = encrypted.split(".");
    if (!ivB64 || !authTagB64 || !data) {
      return null;
    }

    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(data, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return JSON.parse(decrypted) as OAuthSessionData;
  } catch {
    return null;
  }
}

/**
 * Parse cookies from request
 */
function parseCookies(request: Request): Record<string, string> {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  const cookies: Record<string, string> = {};
  for (const c of cookieHeader.split(";")) {
    const [key, ...val] = c.trim().split("=");
    if (key) {
      cookies[key] = val.join("=");
    }
  }
  return cookies;
}

export const APIRoute = createAPIFileRoute("/api/x-bookmarks-callback")({
  GET: async ({ request }) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // Handle X OAuth error response
    if (error) {
      const errorDescription =
        url.searchParams.get("error_description") ?? "Unknown error";
      return new Response(`OAuth error: ${errorDescription}`, { status: 400 });
    }

    if (!code || !state) {
      return new Response("Missing code or state parameter", { status: 400 });
    }

    // Get session from cookie
    const cookies = parseCookies(request);
    const encryptedSession = cookies[COOKIE_NAME];

    if (!encryptedSession) {
      return new Response("Missing OAuth session. Please start again.", {
        status: 400,
      });
    }

    const session = decryptSession(encryptedSession);
    if (!session) {
      return new Response("Invalid OAuth session. Please start again.", {
        status: 400,
      });
    }

    // Verify state matches
    if (session.state !== state) {
      return new Response("State mismatch. Possible CSRF attack.", {
        status: 400,
      });
    }

    try {
      // Exchange code for tokens
      const tokens = await exchangeCodeForTokens(code, session.codeVerifier);

      if (!tokens.refresh_token) {
        return new Response(
          "No refresh token received. Ensure offline.access scope is requested.",
          { status: 400 },
        );
      }

      // Get authenticated user's X ID
      const client = createXClient(tokens.access_token);
      const userResponse = await client.getMe();
      const xUserId = userResponse.data.id;

      // Calculate token expiration
      const expiresAt = calculateExpiresAt(tokens.expires_in);

      // Upsert auth record for this user
      const existingAuth = await db.query.xBookmarksAuth.findFirst({
        where: eq(schema.xBookmarksAuth.userId, session.viewerId),
      });

      if (existingAuth) {
        await db
          .update(schema.xBookmarksAuth)
          .set({
            xUserId,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt,
          })
          .where(eq(schema.xBookmarksAuth.id, existingAuth.id));
      } else {
        await db.insert(schema.xBookmarksAuth).values({
          userId: session.viewerId,
          xUserId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt,
        });
      }

      // Clear the OAuth session cookie and redirect to success page
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/?x-bookmarks=connected",
          "Set-Cookie": `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
        },
      });
    } catch (err) {
      console.error("X OAuth callback error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      return new Response(`OAuth callback failed: ${message}`, { status: 500 });
    }
  },
});
