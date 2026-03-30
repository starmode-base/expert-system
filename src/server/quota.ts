import { eq, sql, and } from "drizzle-orm";
import { db, schema } from "~/postgres/db";
import { authenticate } from "~/server/api-keys";

const FREE_TIER_LIMIT = 100;

/** Valid endpoint identifiers for quota tracking. Add new entries here when creating new API routes. */
export type ApiEndpoint =
  | "takeaways.search"
  | "takeaways"
  | "takeaways.recent"
  | "documents"
  | "query.macro"
  | "query.financial"
  | "research";

/**
 * Atomically increments the per-endpoint monthly counter and checks the total
 * across all endpoints. Unlimited users still get tracked but skip the limit.
 */
export async function checkAndIncrementQuota(
  userId: string,
  endpoint: ApiEndpoint,
): Promise<{ allowed: boolean; remaining: number }> {
  const month = new Date().toISOString().slice(0, 7); // "YYYY-MM"

  // Fetch plan tier
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { planTier: true },
  });

  const planTier = user?.planTier ?? "free";

  // Atomic upsert for this endpoint's counter
  await db
    .insert(schema.apiUsage)
    .values({ userId, month, endpoint, requestCount: 1 })
    .onConflictDoUpdate({
      target: [
        schema.apiUsage.userId,
        schema.apiUsage.month,
        schema.apiUsage.endpoint,
      ],
      set: { requestCount: sql`${schema.apiUsage.requestCount} + 1` },
    });

  if (planTier === "unlimited") {
    return { allowed: true, remaining: Infinity };
  }

  // Sum total requests across all endpoints for this month
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${schema.apiUsage.requestCount}), 0)`,
    })
    .from(schema.apiUsage)
    .where(
      and(eq(schema.apiUsage.userId, userId), eq(schema.apiUsage.month, month)),
    );

  const total = Number(row?.total ?? 0);
  const remaining = Math.max(0, FREE_TIER_LIMIT - total);

  return { allowed: total <= FREE_TIER_LIMIT, remaining };
}

/**
 * Wraps authenticate() + checkAndIncrementQuota().
 * Returns the userId on success, or an error Response (401 | 429).
 */
export async function authorizeApiRequest(
  request: Request,
  endpoint: ApiEndpoint,
): Promise<
  { type: "ok"; userId: string } | { type: "error"; response: Response }
> {
  const userId = await authenticate(request);
  if (!userId) {
    return {
      type: "error",
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  const quota = await checkAndIncrementQuota(userId, endpoint);
  if (!quota.allowed) {
    return {
      type: "error",
      response: new Response(
        JSON.stringify({
          error:
            "Monthly quota exceeded. Upgrade to Unlimited at expert-system.com/pricing.",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": String(FREE_TIER_LIMIT),
            "X-RateLimit-Remaining": "0",
          },
        },
      ),
    };
  }

  return { type: "ok", userId };
}
