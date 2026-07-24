import { gte } from "drizzle-orm";
import { db, schema } from "~/postgres/db";

export async function recordEarningsApiRequest(
  endpoint: string,
  status: number | null,
): Promise<void> {
  await db.insert(schema.earningsApiRequests).values({ endpoint, status });
}

export async function getMonthlyEarningsApiRequestCount(
  now = new Date(),
): Promise<number> {
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  return db.$count(
    schema.earningsApiRequests,
    gte(schema.earningsApiRequests.createdAt, monthStart),
  );
}
