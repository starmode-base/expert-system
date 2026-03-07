import { ensureEnv } from "~/lib/env";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";
import * as relations from "./relations";

const db = drizzle(ensureEnv("DATABASE_URL"), {
  casing: "snake_case",
  schema: { ...schema, ...relations },
});

export { db, schema };
