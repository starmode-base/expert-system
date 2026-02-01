import { createAPIFileRoute } from "@tanstack/react-start/api";
import crypto from "crypto";
import { getViewerId } from "~/server/auth";
import {
  createOAuthSession,
  getAuthorizationUrl,
} from "~/inngest/importers/scheduled/x-bookmarks/x-client";

const COOKIE_NAME = "x_oauth_session";
const COOKIE_MAX_AGE = 60 * 10; // 10 minutes

/**
 * Simple encryption for OAuth session cookie
 * Uses AES-256-GCM with a derived key from CLERK_SECRET_KEY
 */
function encryptSession(data: string): string {
  const key = crypto
    .createHash("sha256")
    .update(process.env.CLERK_SECRET_KEY ?? "")
    .digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(data, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}.${authTag.toString("base64")}.${encrypted}`;
}

export const APIRoute = createAPIFileRoute("/api/x-bookmarks-start")({
  GET: async ({ request }) => {
    try {
      const viewerId = await getViewerId(request);

      if (!viewerId) {
        return new Response("Unauthorized", { status: 401 });
      }

      // Create PKCE session
      const session = createOAuthSession();
      const authUrl = getAuthorizationUrl(session);

      // Encrypt session data for cookie
      const sessionData = JSON.stringify({
        state: session.state,
        codeVerifier: session.codeVerifier,
        viewerId,
      });
      const encryptedSession = encryptSession(sessionData);

      // Redirect to X authorization with session cookie
      return new Response(null, {
        status: 302,
        headers: {
          Location: authUrl,
          "Set-Cookie": `${COOKIE_NAME}=${encryptedSession}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${COOKIE_MAX_AGE}`,
        },
      });
    } catch (err) {
      console.error("X Bookmarks start error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      return new Response(`Error: ${message}`, { status: 500 });
    }
  },
});
