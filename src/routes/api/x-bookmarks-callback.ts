/**
 * X Bookmarks OAuth Callback Endpoint
 *
 * GET /api/x-bookmarks-callback
 *
 * This endpoint handles the OAuth2 callback after a user approves on X.
 * X redirects here with ?code=...&state=... query parameters.
 *
 * Flow:
 * 1. Parse the authorization code and state from query params
 * 2. Decrypt the OAuth session from our cookie
 * 3. Verify state matches (CSRF protection)
 * 4. Exchange the code for access + refresh tokens
 * 5. Get the X user ID (needed for bookmarks API)
 * 6. Store tokens in the database
 * 7. Redirect to settings page with success message
 *
 * IMPORTANT: We don't use Clerk auth here because external redirects from X
 * break Clerk's session handshake. Instead, we stored the viewerId in the
 * encrypted session cookie during the start flow.
 */

import { createAPIFileRoute } from "@tanstack/react-start/api";
import { db, schema } from "~/postgres/db";
import { eq } from "drizzle-orm";
import {
  getSessionFromRequest,
  clearSessionCookie,
  exchangeCodeForTokens,
  calculateExpiresAt,
  getMe,
} from "~/x-client";
import { origin } from "~/lib/env";

export const APIRoute = createAPIFileRoute("/api/x-bookmarks-callback")({
  GET: async ({ request }) => {
    // Parse query params from X's redirect
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // Handle OAuth errors (user denied, invalid request, etc.)
    if (error) {
      const errorDescription =
        url.searchParams.get("error_description") ?? "No description";
      console.error("OAuth error from X:", error, errorDescription);
      return new Response(`OAuth error: ${error} - ${errorDescription}`, {
        status: 400,
        headers: { "Set-Cookie": clearSessionCookie() },
      });
    }

    if (!code || !state) {
      return new Response("Missing code or state parameter", {
        status: 400,
        headers: { "Set-Cookie": clearSessionCookie() },
      });
    }

    // Get the OAuth session from encrypted cookie
    // This contains: state, codeVerifier, viewerId
    let session;
    try {
      session = getSessionFromRequest(request);
    } catch (err) {
      console.error("Error parsing OAuth session cookie:", err);
      return new Response("Session parse error", { status: 500 });
    }

    if (!session) {
      return new Response("Missing or invalid OAuth session", { status: 400 });
    }

    // Get viewerId from session (we stored it during start because Clerk
    // auth doesn't work on callbacks from external redirects)
    const viewerId = session.viewerId as string;
    if (!viewerId) {
      return new Response("Missing viewerId in session", {
        status: 400,
        headers: { "Set-Cookie": clearSessionCookie() },
      });
    }

    // CSRF protection: verify state matches what we sent
    if (session.state !== state) {
      return new Response("State mismatch - possible CSRF attack", {
        status: 400,
        headers: { "Set-Cookie": clearSessionCookie() },
      });
    }

    try {
      // Exchange authorization code for tokens using PKCE verifier
      const tokens = await exchangeCodeForTokens(code, session.codeVerifier);

      // We need a refresh token for automated daily sync
      if (!tokens.refresh_token) {
        return new Response(
          "No refresh token received - ensure offline.access scope is enabled",
          {
            status: 400,
            headers: { "Set-Cookie": clearSessionCookie() },
          },
        );
      }

      // Get the X user ID - required for bookmarks API
      // (bookmarks endpoint requires the user ID to match the authenticated user)
      const xUser = await getMe(tokens.access_token);

      // Calculate when the access token expires
      const expiresAt = calculateExpiresAt(tokens.expires_in);

      // Upsert the auth record (update if exists, insert if new)
      const existingAuth = await db.query.xBookmarksAuth.findFirst({
        where: eq(schema.xBookmarksAuth.userId, viewerId),
      });

      if (existingAuth) {
        // User is re-connecting - update their tokens
        await db
          .update(schema.xBookmarksAuth)
          .set({
            xUserId: xUser.id,
            refreshToken: tokens.refresh_token,
            accessToken: tokens.access_token,
            expiresAt,
          })
          .where(eq(schema.xBookmarksAuth.id, existingAuth.id));
      } else {
        // New connection - insert auth record
        await db.insert(schema.xBookmarksAuth).values({
          userId: viewerId,
          xUserId: xUser.id,
          refreshToken: tokens.refresh_token,
          accessToken: tokens.access_token,
          expiresAt,
        });
      }

      // Success! Clear the session cookie and redirect to settings
      const redirectUrl = `${origin()}/settings?x_connected=true`;
      return new Response(null, {
        status: 302,
        headers: {
          Location: redirectUrl,
          "Set-Cookie": clearSessionCookie(),
        },
      });
    } catch (err) {
      console.error("OAuth callback error:", err);
      return new Response(
        `OAuth callback failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        {
          status: 500,
          headers: { "Set-Cookie": clearSessionCookie() },
        },
      );
    }
  },
});
