/**
 * NOTE: Dynamically accessing environment variables in the browser is not
 * possible because Next.js inlines the environment variables during the build
 * base on wether they are accessed statically using their full path (eg.
 * `process.env.NEXT_PUBLIC_SOME_VAR`).
 *
 * By putting the environment variables in the `rawEnv` we can circumvent this
 * and allow dynamic access, via `ensureEnv` for example.
 *
 * https://nextjs.org/docs/pages/building-your-application/configuring/environment-variables#bundling-environment-variables-for-the-browser
 */

const devHost = `localhost:${process.env.PORT ?? "3000"}`;

const rawEnv = {
  /**
   * Application environment variables
   */
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
  ABLY_API_KEY: process.env.ABLY_API_KEY,
  API_NINJA: process.env.API_NINJA,
  EARNINGSCALLS_API_KEY: process.env.EARNINGSCALLS_API_KEY,
  FRED_API_KEY: process.env.FRED_API_KEY,
  X_BEARER_TOKEN: process.env.X_BEARER_TOKEN,
  X_CLIENT_ID: process.env.X_CLIENT_ID,
  X_CLIENT_SECRET: process.env.X_CLIENT_SECRET,
  X_REDIRECT_URI: process.env.X_REDIRECT_URI,
  ALPACA_API_KEY: process.env.ALPACA_API_KEY,
  ALPACA_SECRET_KEY: process.env.ALPACA_SECRET_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_MONTHLY_PRICE_ID: process.env.STRIPE_MONTHLY_PRICE_ID,
  STRIPE_ANNUAL_PRICE_ID: process.env.STRIPE_ANNUAL_PRICE_ID,

  /**
   * Site URL for canonical links and OG meta tags. When unset, falls back to
   * VERCEL_URL (current deployment URL).
   */
  SITE_ORIGIN: process.env.SITE_ORIGIN ?? process.env.VITE_SITE_ORIGIN,

  /**
   * Platform environment variables
   */
  // https://nextjs.org/docs/app/building-your-application/configuring/environment-variables#test-environment-variables
  // https://nextjs.org/docs/app/building-your-application/configuring/environment-variables#good-to-know
  NODE_ENV: process.env.NODE_ENV,

  // https://vercel.com/docs/environment-variables/system-environment-variables#VERCEL_ENV
  // https://vercel.com/docs/environment-variables/framework-environment-variables#VITE_VERCEL_ENV
  VERCEL_ENV:
    process.env.VERCEL_ENV ?? process.env.VITE_VERCEL_ENV ?? "development",

  // https://vercel.com/docs/environment-variables/system-environment-variables#VERCEL_URL
  // https://vercel.com/docs/environment-variables/framework-environment-variables#VITE_VERCEL_URL
  VERCEL_URL: process.env.VERCEL_URL ?? process.env.VITE_VERCEL_URL ?? devHost,

  // https://vercel.com/docs/environment-variables/system-environment-variables#VERCEL_BRANCH_URL
  // https://vercel.com/docs/environment-variables/framework-environment-variables#VITE_VERCEL_BRANCH_URL
  VERCEL_BRANCH_URL:
    process.env.VERCEL_BRANCH_URL ??
    process.env.VITE_VERCEL_BRANCH_URL ??
    devHost,

  // https://vercel.com/docs/environment-variables/system-environment-variables#VERCEL_PROJECT_PRODUCTION_URL
  // https://vercel.com/docs/environment-variables/framework-environment-variables#VITE_VERCEL_PROJECT_PRODUCTION_URL
  VERCEL_PROJECT_PRODUCTION_URL:
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VITE_VERCEL_PROJECT_PRODUCTION_URL ??
    devHost,
};

export function ensureEnv(name: keyof typeof rawEnv): string {
  const val = rawEnv[name];

  if (typeof val !== "string" || !val) {
    throw new Error(`Missing env var: "${name}"`);
  }

  return val;
}

export function isProduction(): boolean {
  return ensureEnv("VERCEL_ENV") === "production";
}

export function isDevelopment(): boolean {
  return ensureEnv("VERCEL_ENV") === "development";
}

export function isPreview(): boolean {
  return ensureEnv("VERCEL_ENV") === "preview";
}

export function isTest(): boolean {
  return ensureEnv("NODE_ENV") === "test";
}

/**
 * Get the origin of the current environment. Eg. protocol + host with port if
 * not default port and without trailing slash. Example:
 *
 * - http://localhost:3000
 * - https://example.com
 *
 * Takes the type of Vercel URL to get the origin from, defaults to
 * VERCEL_PROJECT_PRODUCTION_URL, which most likely is the production URL for
 * the Vercel project.
 */
export function origin(
  urlType:
    | "VERCEL_URL"
    | "VERCEL_BRANCH_URL"
    | "VERCEL_PROJECT_PRODUCTION_URL" = "VERCEL_PROJECT_PRODUCTION_URL",
): string {
  const protocol = isDevelopment() ? "http:" : "https:";
  return new URL(`${protocol}//${ensureEnv(urlType)}`).origin;
}

/**
 * Site origin for canonical URLs and OG meta tags. Uses SITE_ORIGIN when set,
 * otherwise the production URL (VERCEL_PROJECT_PRODUCTION_URL).
 */
export function getSiteOrigin(): string {
  const override = rawEnv.SITE_ORIGIN;
  if (typeof override === "string" && override.trim()) {
    return new URL(
      override.startsWith("http") ? override : `https://${override}`,
    ).origin;
  }
  return origin("VERCEL_PROJECT_PRODUCTION_URL");
}
