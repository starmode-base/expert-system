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

  /**
   * Platform environment variables
   */
  // https://nextjs.org/docs/app/building-your-application/configuring/environment-variables#test-environment-variables
  // https://nextjs.org/docs/app/building-your-application/configuring/environment-variables#good-to-know
  NODE_ENV: process.env.NODE_ENV,

  // https://vercel.com/docs/environment-variables/system-environment-variables#VERCEL_ENV
  // https://vercel.com/docs/environment-variables/framework-environment-variables#VITE_VERCEL_ENV
  VERCEL_ENV: process.env.VITE_VERCEL_ENV ?? "development",

  // https://vercel.com/docs/environment-variables/system-environment-variables#VERCEL_URL
  // https://vercel.com/docs/environment-variables/framework-environment-variables#VITE_VERCEL_URL
  VERCEL_URL: process.env.VITE_VERCEL_URL ?? devHost,

  // https://vercel.com/docs/environment-variables/system-environment-variables#VERCEL_BRANCH_URL
  // https://vercel.com/docs/environment-variables/framework-environment-variables#VITE_VERCEL_BRANCH_URL
  VERCEL_BRANCH_URL: process.env.VITE_VERCEL_BRANCH_URL ?? devHost,

  // https://vercel.com/docs/environment-variables/system-environment-variables#VERCEL_PROJECT_PRODUCTION_URL
  // https://vercel.com/docs/environment-variables/framework-environment-variables#VITE_VERCEL_PROJECT_PRODUCTION_URL
  VERCEL_PROJECT_PRODUCTION_URL:
    process.env.VITE_VERCEL_PROJECT_PRODUCTION_URL ?? devHost,
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
