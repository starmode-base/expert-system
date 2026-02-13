import { asc, isNull, lt, or } from "drizzle-orm";
import { inngest } from "~/inngest/client";
import { db, schema } from "~/postgres/db";

/**
 * Max symbols to dispatch per scheduler run. No longer constrained by
 * Inngest's step limit since each symbol is its own function invocation.
 */
const BATCH_SIZE = 1000;

const THREE_MONTHS_MS = 1000 * 60 * 60 * 24 * 90;

/**
 * Scheduler: query for stock symbols that need a company overview refresh
 * and fan out one "stock/fetch-company-overview" event per symbol.
 *
 * Each event is handled by a dedicated worker function with a concurrency
 * limit of 1, so Alpha Vantage rate limits are respected automatically.
 *
 * Triggered by the "stock/backfill-company-overviews" event, which is
 * sent by the "Update Stock Data" button after symbol sync completes.
 */
export const backfillCompanyOverviews = inngest.createFunction(
  { id: "stock.backfill-company-overviews" },
  { event: "stock/backfill-company-overviews" },
  async ({ step }) => {
    const symbolsToFetch = await step.run(
      "get-symbols-needing-overview",
      async () => {
        const threeMonthsAgo = new Date(Date.now() - THREE_MONTHS_MS);

        return await db
          .select({
            id: schema.stockSymbols.id,
            symbol: schema.stockSymbols.symbol,
          })
          .from(schema.stockSymbols)
          .where(
            or(
              isNull(schema.stockSymbols.overviewFetchedAt),
              lt(schema.stockSymbols.overviewFetchedAt, threeMonthsAgo),
            ),
          )
          .orderBy(asc(schema.stockSymbols.overviewFetchedAt))
          .limit(BATCH_SIZE);
      },
    );

    if (symbolsToFetch.length === 0) {
      console.log("All symbols have up-to-date overview data");
      return { dispatched: 0 };
    }

    const events = symbolsToFetch.slice(0, 5).map(({ id, symbol }) => ({
      name: "stock/fetch-company-overview" as const,
      data: { stockSymbolId: id, symbol },
    }));

    await step.sendEvent("dispatch-overview-fetches", events);

    console.log(`Dispatched ${events.length} company overview fetch events`);

    return { dispatched: events.length };
  },
);
