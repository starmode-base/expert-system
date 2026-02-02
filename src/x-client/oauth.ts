/**
 * X OAuth2 Authorization Flow
 *
 * This module handles the OAuth2 + PKCE authorization flow for X (Twitter).
 * It provides functions to:
 * 1. Create a session with PKCE parameters
 * 2. Generate the authorization URL for user consent
 * 3. Exchange the authorization code for tokens
 *
 * Flow overview:
 * 1. User clicks "Connect X Account"
 * 2. We create a session with state + PKCE verifier, store in encrypted cookie
 * 3. Redirect user to X's authorization URL
 * 4. User approves, X redirects back with ?code=...&state=...
 * 5. We verify state, exchange code for tokens using PKCE verifier
 *
 * References:
 * - X OAuth2 docs: https://developer.x.com/en/docs/authentication/oauth-2-0
 * - PKCE spec: https://datatracker.ietf.org/doc/html/rfc7636
 */

import { generateCodeVerifier, generateCodeChallenge } from "@xdevplatform/xdk";
import { randomId } from "~/lib/random-id";
import { ensureEnv } from "~/lib/env";
import type { XOAuthSession, XTokenResponse } from "./types";

/**
 * OAuth2 scopes required for X bookmarks sync.
 *
 * - tweet.read: Read tweet content
 * - users.read: Read user profile (needed for /2/users/me)
 * - bookmark.read: Read user's bookmarks
 * - offline.access: Get refresh tokens for automated access
 */
const SCOPES = ["tweet.read", "users.read", "bookmark.read", "offline.access"];

/**
 * Create a new OAuth2 session with PKCE parameters.
 *
 * This session is stored in an encrypted cookie and used to:
 * 1. Verify the callback came from our auth request (state parameter)
 * 2. Complete the PKCE flow (code verifier)
 * 3. Identify the user without Clerk auth (viewerId)
 *
 * @param viewerId - Our internal user ID to associate with the X account
 */
export function createOAuthSession(viewerId: string): XOAuthSession {
  // Random state for CSRF protection
  const state = randomId();
  // PKCE code verifier (high-entropy random string)
  const codeVerifier = generateCodeVerifier();

  return { state, codeVerifier, viewerId };
}

/**
 * Generate the X OAuth2 authorization URL.
 *
 * This URL is where we redirect the user to grant consent.
 * It includes PKCE challenge (S256 hash of verifier) for security.
 *
 * @param session - The OAuth session containing state and PKCE verifier
 * @returns The full authorization URL to redirect the user to
 */
export async function getAuthorizationUrl(
  session: XOAuthSession,
): Promise<string> {
  const clientId = ensureEnv("X_CLIENT_ID");
  const redirectUri = ensureEnv("X_REDIRECT_URI");

  // PKCE: Hash the verifier to create the challenge
  // X will store this, and we prove ownership by sending the original verifier later
  const codeChallenge = await generateCodeChallenge(session.codeVerifier);

  // Build the authorization URL with all required OAuth2 + PKCE params
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES.join(" "),
    state: session.state, // CSRF protection
    code_challenge: codeChallenge, // PKCE challenge
    code_challenge_method: "S256", // SHA-256 hash method
  });

  return `https://x.com/i/oauth2/authorize?${params.toString()}`;
}

/**
 * Exchange an authorization code for access and refresh tokens.
 *
 * This is called after X redirects back with a code. We send:
 * - The authorization code from X
 * - The original PKCE verifier (proves we started the flow)
 * - Client credentials via Basic auth header
 *
 * @param code - The authorization code from X's callback
 * @param codeVerifier - The PKCE verifier from our session
 * @returns Token response with access_token and refresh_token
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<XTokenResponse> {
  const clientId = ensureEnv("X_CLIENT_ID");
  const clientSecret = ensureEnv("X_CLIENT_SECRET");
  const redirectUri = ensureEnv("X_REDIRECT_URI");

  // X requires Basic auth for confidential clients (server-side apps with a secret)
  // Format: base64(client_id:client_secret)
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  // Token endpoint requires form-urlencoded body
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier, // PKCE: Prove we started the auth flow
  });

  const response = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<XTokenResponse>;
}
