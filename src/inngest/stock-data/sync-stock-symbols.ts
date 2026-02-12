import { eq } from "drizzle-orm";
import { inngest } from "~/inngest/client";
import { db, schema } from "~/postgres/db";

const dedupeBySymbol = (records: { symbol: string; name: string }[]) => [
  ...records
    .reduce(
      (map, rec) => (map.has(rec.symbol) ? map : map.set(rec.symbol, rec)),
      new Map<string, { symbol: string; name: string }>(),
    )
    .values(),
];

const partitionByExistence = (
  records: { symbol: string; name: string }[],
  existingBySymbol: Map<string, string>,
) =>
  records.reduce<{
    toInsert: { symbol: string; name: string }[];
    toUpdate: { id: string; name: string }[];
  }>(
    (acc, rec) => {
      const existingId = existingBySymbol.get(rec.symbol);
      return existingId
        ? {
            ...acc,
            toUpdate: [...acc.toUpdate, { id: existingId, name: rec.name }],
          }
        : { ...acc, toInsert: [...acc.toInsert, rec] };
    },
    { toInsert: [], toUpdate: [] },
  );

/**
 * Syncs the stock_symbols table from earnings_schedule, then triggers
 * the company overview backfill for any symbols missing profile data.
 *
 * Triggered by the "Update Stock Data" button via the
 * "stock/sync-stock-symbols" event.
 */
export const syncStockSymbols = inngest.createFunction(
  { id: "stock.sync-stock-symbols" },
  { event: "stock/sync-stock-symbols" },
  async ({ step }) => {
    const earningsRecords = await step.run(
      "fetch-earnings-records",
      async () => {
        const records = await db
          .selectDistinct({
            symbol: schema.earningsSchedule.symbol,
            name: schema.earningsSchedule.name,
          })
          .from(schema.earningsSchedule);

        console.log(
          `Found ${records.length} distinct symbols from earnings schedule`,
        );

        return dedupeBySymbol(records);
      },
    );

    if (earningsRecords.length === 0) {
      return { inserted: 0, updated: 0 };
    }

    const existingSymbols = await step.run(
      "fetch-existing-symbols",
      async () => {
        return await db
          .select({
            id: schema.stockSymbols.id,
            symbol: schema.stockSymbols.symbol,
          })
          .from(schema.stockSymbols);
      },
    );

    const existingBySymbol = new Map(
      existingSymbols.map((r) => [r.symbol, r.id]),
    );
    const { toInsert, toUpdate } = partitionByExistence(
      earningsRecords,
      existingBySymbol,
    );

    const insertedCount = await step.run("insert-new-symbols", async () => {
      if (toInsert.length === 0) return 0;

      const inserted = await db
        .insert(schema.stockSymbols)
        .values(toInsert)
        .returning({ id: schema.stockSymbols.id });

      console.log(`Inserted ${inserted.length} new stock symbols`);
      return inserted.length;
    });

    const updatedCount = await step.run("update-existing-symbols", async () => {
      if (toUpdate.length === 0) return 0;

      await Promise.all(
        toUpdate.map((rec) =>
          db
            .update(schema.stockSymbols)
            .set({ name: rec.name })
            .where(eq(schema.stockSymbols.id, rec.id)),
        ),
      );

      console.log(`Updated ${toUpdate.length} existing stock symbols`);
      return toUpdate.length;
    });

    await step.sendEvent("trigger-overview-backfill", {
      name: "stock/backfill-company-overviews",
      data: {},
    });

    return { inserted: insertedCount, updated: updatedCount };
  },
);
