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

// db.ts is pulled into the client bundle via server function import chains.
// TanStack Start strips handler bodies but not top-level module imports,
// so we guard initialization to server-only.
const db =
  typeof window === "undefined"
    ? createDb()
    : (null as unknown as ReturnType<typeof createDb>);

export { db, schema };
