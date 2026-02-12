import { eq, isNull } from "drizzle-orm";
import { inngest } from "~/inngest/client";
import { db, schema } from "~/postgres/db";
import { fetchCompanyOverview } from "~/server/financial-data-api/alpha-vantage-api";

const RATE_LIMIT_DELAY_MS = 1100;

/**
 * One-time/on-demand backfill: fetch Alpha Vantage company overview
 * for every stock_symbols row that is missing profile data (sector IS NULL).
 *
 * Triggered by the "stock/backfill-company-overviews" event, which is
 * sent by the "Update Stock Data" button after symbol sync completes.
 */
export const backfillCompanyOverviews = inngest.createFunction(
  { id: "stock.backfill-company-overviews" },
  { event: "stock/backfill-company-overviews" },
  async ({ step }) => {
    const symbolsToFetch = await step.run(
      "get-symbols-missing-overview",
      async () => {
        return await db
          .select({
            id: schema.stockSymbols.id,
            symbol: schema.stockSymbols.symbol,
          })
          .from(schema.stockSymbols)
          .where(isNull(schema.stockSymbols.sector));
      },
    );

    if (symbolsToFetch.length === 0) {
      console.log("All symbols already have overview data");
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    console.log(
      `Fetching company overviews for ${symbolsToFetch.length} symbols`,
    );

    let succeeded = 0;
    let failed = 0;

    for (const { id, symbol } of symbolsToFetch.slice(0, 10)) {
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
            })
            .where(eq(schema.stockSymbols.id, id));

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
