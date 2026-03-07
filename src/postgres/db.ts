import { ensureEnv } from "~/lib/env";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";
import * as relations from "./relations";

function createDb() {
  return drizzle(ensureEnv("DATABASE_URL"), {
    casing: "snake_case",
    schema: { ...schema, ...relations },
  });
}

/**
 * Database client. Only initialized on the server. When db.ts is pulled into
 * the client bundle (via server function import chains), we skip
 * initialization since DATABASE_URL is never exposed to the browser.
 */
const db =
  typeof window === "undefined"
    ? createDb()
    : (null as unknown as ReturnType<typeof createDb>);

export { db, schema };
