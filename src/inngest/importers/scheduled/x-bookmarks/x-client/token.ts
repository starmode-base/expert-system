import { ensureEnv } from "~/lib/env";
import type { XTokenResponse } from "./types";

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
 * Refresh an access token using a refresh token
 * Per X API docs, uses POST /2/oauth2/token with grant_type=refresh_token
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<XTokenResponse> {
  const clientId = ensureEnv("X_CLIENT_ID");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
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
    throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
  }

  return response.json() as Promise<XTokenResponse>;
}

/**
 * Check if a token is expired or expiring soon (within 5 minutes)
 */
export function isTokenExpired(expiresAt: Date): boolean {
  const bufferMs = 5 * 60 * 1000; // 5 minutes buffer
  return Date.now() >= expiresAt.getTime() - bufferMs;
}

/**
 * Calculate token expiration date from expires_in seconds
 */
export function calculateExpiresAt(expiresInSeconds: number): Date {
  return new Date(Date.now() + expiresInSeconds * 1000);
}
