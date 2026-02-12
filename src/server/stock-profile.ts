import { createServerFn } from "@tanstack/react-start";
import { and, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { authMiddleware } from "~/middleware/auth-middleware";
import { db, schema } from "~/postgres/db";
import {
  fetchCompanyOverview,
  fetchGlobalQuote,
  type CompanyOverview,
  type GlobalQuote,
} from "~/server/financial-data-api/alpha-vantage-api";

interface StockProfileResult {
  dbStock: typeof schema.stockSymbols.$inferSelect | null;
  overview: CompanyOverview | null;
  quote: GlobalQuote | null;
  nextEarningsDate: Date | null;
  isTracked: boolean;
  trackedCompanyStockSymbolId: string | null;
}

export const getStockProfileSF = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ symbol: z.string() }))
  .handler(
    async ({ context, data: { symbol } }): Promise<StockProfileResult> => {
      const viewer = context.ensureViewer();
      const upperSymbol = symbol.trim().toUpperCase();

      const [dbStock, overview, quote] = await Promise.all([
        db.query.stockSymbols.findFirst({
          where: eq(schema.stockSymbols.symbol, upperSymbol),
        }),
        fetchCompanyOverview(upperSymbol).catch(() => null),
        fetchGlobalQuote(upperSymbol).catch(() => null),
      ]);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const nextEarnings = await db.query.earningsSchedule.findFirst({
        where: and(
          eq(schema.earningsSchedule.symbol, upperSymbol),
          gte(schema.earningsSchedule.reportDate, today),
        ),
        orderBy: (es, { asc }) => [asc(es.reportDate)],
      });

      let isTracked = false;
      let trackedCompanyStockSymbolId: string | null = null;

      if (dbStock) {
        trackedCompanyStockSymbolId = dbStock.id;
        const tracked = await db.query.trackedCompanies.findFirst({
          where: and(
            eq(schema.trackedCompanies.userId, viewer.id),
            eq(schema.trackedCompanies.stockSymbolId, dbStock.id),
          ),
        });
        isTracked = !!tracked;
      }

      return {
        dbStock: dbStock ?? null,
        overview: overview ?? null,
        quote: quote ?? null,
        nextEarningsDate: nextEarnings?.reportDate ?? null,
        isTracked,
        trackedCompanyStockSymbolId,
      };
    },
  );
