/**
 * X OAuth2 Token Management
 *
 * This module handles token refresh for automated/scheduled access to X APIs.
 * Access tokens expire after ~2 hours, so we need to refresh them periodically.
 *
 * Key behaviors:
 * - Refresh tokens may rotate (X sometimes returns a new refresh_token)
 * - Always store the latest refresh_token after each refresh
 * - Use a buffer time to refresh before actual expiry
 *
 * Used by the daily bookmark sync job to maintain access without user interaction.
 */

import { ensureEnv } from "~/lib/env";
import type { XTokenResponse } from "./types";

/**
 * Buffer time (in ms) before token expiry to trigger refresh.
 * Set to 5 minutes to avoid race conditions with clock skew.
 */
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

/**
 * Check if a token is expired or will expire soon.
 *
 * @param expiresAt - The token's expiration timestamp
 * @returns true if the token should be refreshed
 */
export function isTokenExpired(expiresAt: Date): boolean {
  return Date.now() >= expiresAt.getTime() - EXPIRY_BUFFER_MS;
}

/**
 * Calculate the expiration timestamp from expires_in seconds.
 *
 * @param expiresIn - Seconds until expiry (from token response)
 * @returns Date object representing when the token expires
 */
export function calculateExpiresAt(expiresIn: number): Date {
  return new Date(Date.now() + expiresIn * 1000);
}

/**
 * Refresh an access token using a refresh token.
 *
 * This is used by scheduled jobs to get fresh access tokens without
 * user interaction. X's refresh tokens may rotate, so always store
 * the new refresh_token if one is returned.
 *
 * @param refreshToken - The stored refresh token
 * @returns New token response (may include a rotated refresh_token)
 * @throws Error if refresh fails (e.g., token revoked, requires re-auth)
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<XTokenResponse> {
  const clientId = ensureEnv("X_CLIENT_ID");
  const clientSecret = ensureEnv("X_CLIENT_SECRET");

  // X requires Basic auth for confidential clients
  // Format: base64(client_id:client_secret)
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  // Token endpoint requires form-urlencoded body
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
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
    // Common errors:
    // - 401: Invalid/revoked refresh token (user needs to re-auth)
    // - 400: Malformed request
    throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<XTokenResponse>;
}
