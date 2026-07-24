import { and, asc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db, schema } from "~/postgres/db";

export async function claimStockHydration(catalogId: string): Promise<{
  trackedStockId: string;
  symbol: string;
  mic: string;
} | null> {
  const catalog = await db.query.earningsCompanyCatalog.findFirst({
    where: eq(schema.earningsCompanyCatalog.id, catalogId),
    columns: { symbol: true, mic: true },
  });
  if (!catalog) {
    return null;
  }

  const [stock] = await db
    .update(schema.trackedStocks)
    .set({
      hydrationStatus: "processing",
      hydrationAttempts: sql`${schema.trackedStocks.hydrationAttempts} + 1`,
      hydrationLastError: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.trackedStocks.symbol, catalog.symbol),
        eq(schema.trackedStocks.mic, catalog.mic),
        eq(schema.trackedStocks.active, true),
        inArray(schema.trackedStocks.hydrationStatus, ["pending", "failed"]),
        or(
          isNull(schema.trackedStocks.hydrationNextAttemptAt),
          lte(schema.trackedStocks.hydrationNextAttemptAt, new Date()),
        ),
      ),
    )
    .returning({
      trackedStockId: schema.trackedStocks.id,
      symbol: schema.trackedStocks.symbol,
      mic: schema.trackedStocks.mic,
    });

  return stock ?? null;
}

export async function completeStockHydration(
  trackedStockId: string,
): Promise<void> {
  await db
    .update(schema.trackedStocks)
    .set({
      hydrationStatus: "complete",
      hydrationLastError: null,
      hydrationNextAttemptAt: null,
      hydratedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.trackedStocks.id, trackedStockId));
}

export async function failStockHydration(
  trackedStockId: string,
  error: unknown,
  nextAttemptAt: Date,
): Promise<void> {
  const message = error instanceof Error ? error.message : "Unknown error";
  await db
    .update(schema.trackedStocks)
    .set({
      hydrationStatus: "failed",
      hydrationLastError: message.slice(0, 2000),
      hydrationNextAttemptAt: nextAttemptAt,
      updatedAt: new Date(),
    })
    .where(eq(schema.trackedStocks.id, trackedStockId));
}

export async function queueStockHydration(
  trackedStockId: string,
): Promise<string | null> {
  const [row] = await db
    .update(schema.trackedStocks)
    .set({
      hydrationStatus: "pending",
      hydrationLastError: null,
      hydrationNextAttemptAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.trackedStocks.id, trackedStockId),
        eq(schema.trackedStocks.active, true),
      ),
    )
    .returning({
      symbol: schema.trackedStocks.symbol,
      mic: schema.trackedStocks.mic,
    });
  if (!row) {
    return null;
  }

  const catalog = await db.query.earningsCompanyCatalog.findFirst({
    where: and(
      eq(schema.earningsCompanyCatalog.symbol, row.symbol),
      eq(schema.earningsCompanyCatalog.mic, row.mic),
    ),
    columns: { id: true },
  });
  return catalog?.id ?? null;
}

export async function queueAllActiveStockHydrations(): Promise<number> {
  const rows = await db
    .update(schema.trackedStocks)
    .set({
      hydrationStatus: "pending",
      hydrationLastError: null,
      hydrationNextAttemptAt: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.trackedStocks.active, true))
    .returning({ id: schema.trackedStocks.id });
  return rows.length;
}

export async function listDueStockHydrations(limit: number): Promise<
  {
    catalogId: string;
  }[]
> {
  return db
    .select({ catalogId: schema.earningsCompanyCatalog.id })
    .from(schema.trackedStocks)
    .innerJoin(
      schema.earningsCompanyCatalog,
      and(
        eq(schema.trackedStocks.symbol, schema.earningsCompanyCatalog.symbol),
        eq(schema.trackedStocks.mic, schema.earningsCompanyCatalog.mic),
      ),
    )
    .where(
      and(
        eq(schema.trackedStocks.active, true),
        inArray(schema.trackedStocks.hydrationStatus, ["pending", "failed"]),
        or(
          isNull(schema.trackedStocks.hydrationNextAttemptAt),
          lte(schema.trackedStocks.hydrationNextAttemptAt, new Date()),
        ),
      ),
    )
    .orderBy(
      asc(schema.trackedStocks.hydrationNextAttemptAt),
      asc(schema.trackedStocks.updatedAt),
    )
    .limit(limit);
}
