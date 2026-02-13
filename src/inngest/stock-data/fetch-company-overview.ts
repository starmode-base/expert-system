import { eq } from "drizzle-orm";
import { inngest } from "~/inngest/client";
import { db, schema } from "~/postgres/db";
import { generateEmbedding } from "~/postgres/generate-embedding";
import { fetchCompanyOverview } from "~/server/financial-data-api/alpha-vantage-api";

/**
 * Worker: fetch and persist an Alpha Vantage company overview for a single
 * stock symbol. Dispatched by the backfill-company-overviews scheduler.
 *
 * Concurrency is capped at 5 to limit parallel requests. Each invocation
 * sleeps after fetching to respect the Alpha Vantage rate limit.
 */
export const fetchCompanyOverviewWorker = inngest.createFunction(
  {
    id: "stock.fetch-company-overview",
    concurrency: [{ limit: 5 }],
  },
  { event: "stock/fetch-company-overview" },
  async ({ event, step }) => {
    const { stockSymbolId, symbol } = event.data;

    await step.run("fetch-and-persist-overview", async () => {
      const overview = await fetchCompanyOverview(symbol);

      if (!overview) {
        console.warn(`No overview data returned for ${symbol}`);
        await db
          .update(schema.stockSymbols)
          .set({ overviewFetchedAt: new Date() })
          .where(eq(schema.stockSymbols.id, stockSymbolId));
        return;
      }

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
        .where(eq(schema.stockSymbols.id, stockSymbolId));

      if (overview.Description) {
        const embeddingText = `${overview.Name} — ${overview.Description} | ${overview.Sector} | ${overview.Industry}`;
        const embedding = await generateEmbedding(embeddingText);

        await db
          .insert(schema.stockSymbolEmbeddings)
          .values({ stockSymbolId, embedding })
          .onConflictDoUpdate({
            target: schema.stockSymbolEmbeddings.stockSymbolId,
            set: { embedding },
          });
      }
    });

    // Respect Alpha Vantage rate limit (~1 req/sec)
    await step.sleep("rate-limit", 1100);

    return { symbol, success: true };
  },
);
