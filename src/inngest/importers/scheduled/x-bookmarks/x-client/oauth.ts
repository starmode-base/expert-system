import crypto from "crypto";
import { ensureEnv } from "~/lib/env";
import type { XOAuthSession, XTokenResponse } from "./types";

const SCOPES = ["tweet.read", "users.read", "bookmark.read", "offline.access"];

/**
 * Generate a cryptographically secure random string for state/verifier
 */
function generateRandomString(length: number): string {
  const bytes = crypto.randomBytes(length);
  return bytes
    .toString("base64url")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, length);
}

/**
 * Generate PKCE code verifier (43-128 characters)
 */
export function generateCodeVerifier(): string {
  return generateRandomString(64);
}

/**
 * Generate PKCE code challenge from verifier using SHA256
 */
export function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash("sha256").update(verifier).digest();
  return hash
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Generate OAuth state parameter
 */
export function generateState(): string {
  return generateRandomString(32);
}

/**
 * Create a new OAuth session with PKCE parameters
 */
export function createOAuthSession(): XOAuthSession {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  return { state, codeVerifier };
}

/**
 * Build X OAuth2 authorization URL with PKCE
 */
export function getAuthorizationUrl(session: XOAuthSession): string {
  const clientId = ensureEnv("X_CLIENT_ID");
  const redirectUri = ensureEnv("X_REDIRECT_URI");
  const codeChallenge = generateCodeChallenge(session.codeVerifier);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES.join(" "),
    state: session.state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
}

/**
 * Build Basic auth header for confidential client
 */
function getBasicAuthHeader(): string {
  const clientId = ensureEnv("X_CLIENT_ID");
  const clientSecret = ensureEnv("X_CLIENT_SECRET");
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );
  return `Basic ${credentials}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<XTokenResponse> {
  const clientId = ensureEnv("X_CLIENT_ID");
  const redirectUri = ensureEnv("X_REDIRECT_URI");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  });

  const response = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: getBasicAuthHeader(),
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Token exchange failed: ${response.status} - ${errorText}`,
    );
  }

  return response.json() as Promise<XTokenResponse>;
}
