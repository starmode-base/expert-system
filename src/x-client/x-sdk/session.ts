/**
 * X OAuth2 Session Cookie Management
 *
 * This module handles secure storage of OAuth session data in cookies.
 * The session contains sensitive data (PKCE verifier, user ID) that must
 * be protected from tampering and theft.
 *
 * Security measures:
 * - AES-256-GCM encryption (authenticated encryption)
 * - HttpOnly flag (prevents JavaScript access)
 * - Secure flag (HTTPS only)
 * - SameSite=Lax (CSRF protection)
 * - Short TTL (10 minutes - just enough for OAuth flow)
 *
 * Why we use cookies instead of server-side sessions:
 * - Stateless: No need to manage session storage
 * - Works with serverless: No shared state between function invocations
 * - Simple: Everything needed is in the encrypted cookie
 */

import crypto from "crypto";
import { ensureEnv } from "~/lib/env";
import type { XOAuthSession } from "./types";

/** Cookie name for the OAuth session */
const COOKIE_NAME = "x_oauth_session";

/** AES-256-GCM provides both encryption and authentication */
const ALGORITHM = "aes-256-gcm";

/**
 * Derive a 256-bit encryption key from CLERK_SECRET_KEY.
 *
 * We reuse the Clerk secret as the source of entropy since:
 * - It's already a high-entropy secret
 * - It's already required for the app to function
 * - Avoids adding another secret to manage
 */
function getEncryptionKey(): Buffer {
  const secret = ensureEnv("CLERK_SECRET_KEY");
  // SHA-256 produces exactly 32 bytes (256 bits) for AES-256
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypt an OAuth session for storage in a cookie.
 *
 * Uses AES-256-GCM which provides:
 * - Confidentiality: Data is encrypted
 * - Integrity: Any tampering is detected via auth tag
 *
 * @param session - The session data to encrypt
 * @returns Encrypted string in format: iv.authTag.ciphertext (all base64)
 */
export function encryptSession(session: XOAuthSession): string {
  const key = getEncryptionKey();
  // Random IV ensures same plaintext produces different ciphertext
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(session);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  // Auth tag proves the ciphertext hasn't been tampered with
  const authTag = cipher.getAuthTag();

  // Format: iv.authTag.ciphertext (all base64-encoded)
  return `${iv.toString("base64")}.${authTag.toString("base64")}.${encrypted}`;
}

/**
 * Decrypt an OAuth session from a cookie value.
 *
 * @param encrypted - The encrypted string from the cookie
 * @returns The decrypted session data
 * @throws Error if decryption fails (tampered, wrong key, malformed)
 */
export function decryptSession(encrypted: string): XOAuthSession {
  const [ivB64, authTagB64, ciphertext] = encrypted.split(".");

  if (!ivB64 || !authTagB64 || !ciphertext) {
    throw new Error("Invalid session format");
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  // Set auth tag before decryption - will throw if tampered
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return JSON.parse(decrypted) as XOAuthSession;
}

/**
 * Create a Set-Cookie header value for the OAuth session.
 *
 * Cookie attributes:
 * - HttpOnly: Prevents XSS attacks from reading the cookie
 * - Secure: Only sent over HTTPS
 * - SameSite=Lax: Sent on top-level navigations (needed for OAuth redirect)
 * - Max-Age=600: 10 minutes (plenty for OAuth flow)
 *
 * @param session - The session to store
 * @returns Complete Set-Cookie header value
 */
export function createSessionCookie(session: XOAuthSession): string {
  const encrypted = encryptSession(session);

  const parts = [
    `${COOKIE_NAME}=${encrypted}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=600", // 10 minutes
  ];

  return parts.join("; ");
}

/**
 * Parse the OAuth session from request cookies.
 *
 * @param request - The incoming request
 * @returns The decrypted session, or null if not found/invalid
 */
export function getSessionFromRequest(request: Request): XOAuthSession | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  // Parse cookie header into key-value pairs
  const cookies = cookieHeader
    .split(";")
    .reduce<Record<string, string>>((acc, cookie) => {
      const [key, ...valueParts] = cookie.trim().split("=");
      if (key) {
        // Rejoin in case value contains '=' characters
        acc[key] = valueParts.join("=");
      }
      return acc;
    }, {});

  const sessionCookie = cookies[COOKIE_NAME];
  if (!sessionCookie) return null;

  try {
    return decryptSession(sessionCookie);
  } catch {
    // Invalid/tampered cookie - treat as no session
    return null;
  }
}

/**
 * Create a Set-Cookie header to clear the OAuth session.
 *
 * Sets Max-Age=0 to immediately expire the cookie.
 *
 * @returns Set-Cookie header value that clears the session
 */
export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
