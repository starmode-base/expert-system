import { createServerFn } from "@tanstack/react-start";
import { and, asc, gt, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { authMiddleware } from "~/middleware/auth-middleware";
import { db, schema } from "~/postgres/db";
import type { PaginatedResult } from "./pagination";

export const queryStocksPaginatedSF = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      search: z.string().optional(),
      cursor: z.string().nullable(),
      limit: z.number().default(50),
    }),
  )
  .handler(
    async ({
      context,
      data: { search, cursor, limit },
    }): Promise<PaginatedResult<typeof schema.stockSymbols.$inferSelect>> => {
      context.ensureViewer();

      const conditions = [];

      if (search) {
        const pattern = `%${search}%`;
        conditions.push(
          or(
            ilike(schema.stockSymbols.name, pattern),
            ilike(schema.stockSymbols.symbol, pattern),
            ilike(schema.stockSymbols.sector, pattern),
            ilike(schema.stockSymbols.industry, pattern),
          ),
        );
      }

      if (cursor) {
        const parsed = JSON.parse(cursor) as {
          name: string;
          symbol: string;
          id: string;
        };
        conditions.push(
          or(
            gt(schema.stockSymbols.name, parsed.name),
            and(
              eq(schema.stockSymbols.name, parsed.name),
              gt(schema.stockSymbols.symbol, parsed.symbol),
            ),
            and(
              eq(schema.stockSymbols.name, parsed.name),
              eq(schema.stockSymbols.symbol, parsed.symbol),
              gt(schema.stockSymbols.id, parsed.id),
            ),
          ),
        );
      }

      const rows = await db
        .select()
        .from(schema.stockSymbols)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(
          asc(schema.stockSymbols.name),
          asc(schema.stockSymbols.symbol),
          asc(schema.stockSymbols.id),
        )
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;

      const lastItem = items[items.length - 1];
      const nextCursor =
        hasMore && lastItem
          ? JSON.stringify({
              name: lastItem.name,
              symbol: lastItem.symbol,
              id: lastItem.id,
            })
          : null;

      return { items, nextCursor };
    },
  );
