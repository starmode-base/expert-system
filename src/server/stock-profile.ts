import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { authMiddleware } from "~/middleware/auth-middleware";
import { db, schema } from "~/postgres/db";

interface StockProfileResult {
  dbStock: typeof schema.stockSymbols.$inferSelect | null;
}

export const getStockProfileSF = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ symbol: z.string() }))
  .handler(
    async ({ context, data: { symbol } }): Promise<StockProfileResult> => {
      context.ensureViewer();
      const upperSymbol = symbol.trim().toUpperCase();

      const dbStock = await db.query.stockSymbols.findFirst({
        where: eq(schema.stockSymbols.symbol, upperSymbol),
      });

      return {
        dbStock: dbStock ?? null,
      };
    },
  );
