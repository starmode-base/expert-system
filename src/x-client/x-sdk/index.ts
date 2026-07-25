/**
 * X (Twitter) OAuth2 Client Module
 *
 * This module provides everything needed for X OAuth2 authentication
 * and API access. It implements:
 *
 * 1. OAuth2 + PKCE authorization flow (oauth.ts)
 * 2. Token refresh for automated access (token.ts)
 * 3. Secure session storage in encrypted cookies (session.ts)
 * 4. X API client for making requests (client.ts)
 *
 * Usage:
 * - Import from "~/x-client" to access all exports
 * - Start flow: createOAuthSession() -> getAuthorizationUrl() -> redirect
 * - Callback: getSessionFromRequest() -> exchangeCodeForTokens() -> getMe()
 * - Refresh: isTokenExpired() -> refreshAccessToken()
 *
 * Environment variables required:
 * - X_CLIENT_ID: OAuth2 client ID from X Developer Portal
 * - X_CLIENT_SECRET: OAuth2 client secret
 * - X_REDIRECT_URI: Callback URL (must match X app settings exactly)
 * - CLERK_SECRET_KEY: Used to derive encryption key for session cookies
 */

export * from "./types";
export * from "./oauth";
export * from "./token";
export * from "./client";
export * from "./session";
export * from "./normalize";
