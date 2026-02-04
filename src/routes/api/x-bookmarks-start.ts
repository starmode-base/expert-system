/**
 * X Bookmarks OAuth Start Endpoint
 *
 * GET /api/x-bookmarks-start
 *
 * This endpoint initiates the OAuth2 + PKCE flow for connecting a user's
 * X account. It:
 *
 * 1. Verifies the user is logged in (via Clerk)
 * 2. Creates an OAuth session with PKCE parameters
 * 3. Stores the session in an encrypted cookie
 * 4. Redirects to X's authorization page
 *
 * After the user approves on X, they're redirected to /api/x-bookmarks-callback
 * with an authorization code that can be exchanged for tokens.
 *
 * The session cookie contains:
 * - state: CSRF protection token
 * - codeVerifier: PKCE verifier for token exchange
 * - viewerId: Our user ID (needed because Clerk auth fails on callback)
 */

import { createAPIFileRoute } from "@tanstack/react-start/api";
import { getViewerId } from "~/server/auth";
import {
  createOAuthSession,
  getAuthorizationUrl,
  createSessionCookie,
} from "src/x-client/x-sdk/";

export const APIRoute = createAPIFileRoute("/api/x-bookmarks-start")({
  GET: async ({ request }) => {
    // User must be logged in to connect their X account
    const viewerId = await getViewerId(request);

    if (!viewerId) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Create OAuth session with PKCE parameters
    // We store viewerId because Clerk auth doesn't work on the callback
    // (external redirect from X breaks Clerk's session handshake)
    const session = createOAuthSession(viewerId);

    // Build the X authorization URL with PKCE challenge
    const authUrl = await getAuthorizationUrl(session);

    // Store encrypted session in cookie and redirect to X
    // The cookie will be sent back when X redirects to our callback
    return new Response(null, {
      status: 302,
      headers: {
        Location: authUrl,
        "Set-Cookie": createSessionCookie(session),
      },
    });
  },
});
