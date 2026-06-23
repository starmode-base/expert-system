import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
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
}

export const getStockProfileSF = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ symbol: z.string() }))
  .handler(
    async ({ context, data: { symbol } }): Promise<StockProfileResult> => {
      context.ensureViewer();
      const upperSymbol = symbol.trim().toUpperCase();

      const [dbStock, overview, quote] = await Promise.all([
        db.query.stockSymbols.findFirst({
          where: eq(schema.stockSymbols.symbol, upperSymbol),
        }),
        fetchCompanyOverview(upperSymbol).catch(() => null),
        fetchGlobalQuote(upperSymbol).catch(() => null),
      ]);

      return {
        dbStock: dbStock ?? null,
        overview: overview ?? null,
        quote: quote ?? null,
      };
    },
  );
