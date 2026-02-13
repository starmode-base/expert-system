import { asc, eq, isNull, lt, or } from "drizzle-orm";
import { inngest } from "~/inngest/client";
import { db, schema } from "~/postgres/db";
import { generateEmbedding } from "~/postgres/generate-embedding";
import { fetchCompanyOverview } from "~/server/financial-data-api/alpha-vantage-api";

const RATE_LIMIT_DELAY_MS = 600;

/**
 * Each symbol uses 2 Inngest steps (fetch + sleep). With a 1,000-step limit
 * and 1 step for the initial query, we can process 499 symbols per run.
 */
const BATCH_SIZE = 499;

const THREE_MONTHS_MS = 1000 * 60 * 60 * 24 * 90;

/**
 * Backfill Alpha Vantage company overviews for stock symbols that have
 * never been fetched or haven't been refreshed in over three months.
 *
 * Processes up to 499 symbols per run to stay within Inngest's step limit.
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
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    console.log(
      `Fetching company overviews for ${symbolsToFetch.length} symbols`,
    );

    let succeeded = 0;
    let failed = 0;

    for (const { id, symbol } of symbolsToFetch) {
      const result = await step.run(`fetch-overview-${symbol}`, async () => {
        try {
          const overview = await fetchCompanyOverview(symbol);

          await db
            .update(schema.stockSymbols)
            .set({
              assetType: overview.AssetType,
              description: overview.Description,
              cik: overview.CIK,
              exchange: overview.Exchange,
              currency: overview.Currency,
              country: overview.Country,
              sector: overview.Sector,
              industry: overview.Industry,
              address: overview.Address,
              officialSite: overview.OfficialSite,
              fiscalYearEnd: overview.FiscalYearEnd,
              overviewFetchedAt: new Date(),
            })
            .where(eq(schema.stockSymbols.id, id));

          if (overview.Description) {
            const embeddingText = `${overview.Name} — ${overview.Description} | ${overview.Sector} | ${overview.Industry}`;
            const embedding = await generateEmbedding(embeddingText);

            await db
              .insert(schema.stockSymbolEmbeddings)
              .values({ stockSymbolId: id, embedding })
              .onConflictDoUpdate({
                target: schema.stockSymbolEmbeddings.stockSymbolId,
                set: { embedding },
              });
          }

          return { success: true as const };
        } catch (error) {
          console.error(
            `Failed to fetch overview for ${symbol}:`,
            error instanceof Error ? error.message : error,
          );
          return {
            success: false as const,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }

      await step.sleep(`rate-limit-${symbol}`, RATE_LIMIT_DELAY_MS);
    }

    console.log(
      `Company overview backfill complete: ${succeeded} succeeded, ${failed} failed out of ${symbolsToFetch.length}`,
    );

    return { processed: symbolsToFetch.length, succeeded, failed };
  },
);
