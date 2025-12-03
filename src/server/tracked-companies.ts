import { createServerFn } from "@tanstack/react-start";
import { and, eq, gte, inArray } from "drizzle-orm";
import { z } from "zod";
import { authMiddleware } from "~/middleware/auth-middleware";
import { db, schema } from "~/postgres/db";

interface TrackedCompanyResult {
  id: string;
  stockSymbolId: string;
  symbol: string;
  name: string;
  nextEarningsDate: Date | null;
}

/**
 * List user's tracked companies with next earnings date
 */
export const listTrackedCompaniesSF = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<TrackedCompanyResult[]> => {
    const viewer = context.ensureViewer();

    const trackedCompanies = await db.query.trackedCompanies.findMany({
      where: eq(schema.trackedCompanies.userId, viewer.id),
      with: {
        stockSymbol: true,
      },
    });

    if (trackedCompanies.length === 0) {
      return [];
    }

    // Get symbols from tracked companies
    const symbols: string[] = [];
    for (const tc of trackedCompanies) {
      symbols.push(tc.stockSymbol.symbol);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingEarnings = await db.query.earningsSchedule.findMany({
      where: and(
        inArray(schema.earningsSchedule.symbol, symbols),
        gte(schema.earningsSchedule.reportDate, today),
      ),
    });

    // Create a map of symbol to next earnings date
    const earningsMap = new Map<string, Date>();
    for (const earnings of upcomingEarnings) {
      const existing = earningsMap.get(earnings.symbol);
      if (!existing || earnings.reportDate < existing) {
        earningsMap.set(earnings.symbol, earnings.reportDate);
      }
    }

    return trackedCompanies.map((tc) => ({
      id: tc.id,
      stockSymbolId: tc.stockSymbolId,
      symbol: tc.stockSymbol.symbol,
      name: tc.stockSymbol.name,
      nextEarningsDate: earningsMap.get(tc.stockSymbol.symbol) ?? null,
    }));
  });

/**
 * Add company to user's watchlist
 */
export const addTrackedCompanySF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ stockSymbolId: z.string() }))
  .handler(async ({ context, data: { stockSymbolId } }) => {
    const viewer = context.ensureViewer();

    // Check if already tracked
    const existing = await db.query.trackedCompanies.findFirst({
      where: and(
        eq(schema.trackedCompanies.userId, viewer.id),
        eq(schema.trackedCompanies.stockSymbolId, stockSymbolId),
      ),
    });

    if (existing) {
      return { id: existing.id, alreadyTracked: true };
    }

    const result = await db
      .insert(schema.trackedCompanies)
      .values({
        userId: viewer.id,
        stockSymbolId,
      })
      .returning({ id: schema.trackedCompanies.id });

    return { id: result[0]?.id ?? "", alreadyTracked: false };
  });

/**
 * Remove company from user's watchlist
 */
export const removeTrackedCompanySF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ stockSymbolId: z.string() }))
  .handler(async ({ context, data: { stockSymbolId } }) => {
    const viewer = context.ensureViewer();

    await db
      .delete(schema.trackedCompanies)
      .where(
        and(
          eq(schema.trackedCompanies.userId, viewer.id),
          eq(schema.trackedCompanies.stockSymbolId, stockSymbolId),
        ),
      );

    return { success: true };
  });

type ToggleTrackedCompanyResult =
  | { isTracked: false }
  | { isTracked: true; id: string };

/**
 * Toggle tracking status for a company
 */
export const toggleTrackedCompanySF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ stockSymbolId: z.string() }))
  .handler(
    async ({
      context,
      data: { stockSymbolId },
    }): Promise<ToggleTrackedCompanyResult> => {
      const viewer = context.ensureViewer();

      // Check if already tracked
      const existing = await db.query.trackedCompanies.findFirst({
        where: and(
          eq(schema.trackedCompanies.userId, viewer.id),
          eq(schema.trackedCompanies.stockSymbolId, stockSymbolId),
        ),
      });

      if (existing) {
        // Remove tracking
        await db
          .delete(schema.trackedCompanies)
          .where(eq(schema.trackedCompanies.id, existing.id));
        return { isTracked: false };
      } else {
        // Add tracking
        const [inserted] = await db
          .insert(schema.trackedCompanies)
          .values({
            userId: viewer.id,
            stockSymbolId,
          })
          .returning({ id: schema.trackedCompanies.id });

        if (!inserted) {
          throw new Error("Failed to insert tracked company");
        }

        return { isTracked: true, id: inserted.id };
      }
    },
  );

/**
 * Get tracked status for multiple stocks (for efficient UI updates)
 */
export const getTrackedStatusSF = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const viewer = context.ensureViewer();

    const trackedCompanies = await db.query.trackedCompanies.findMany({
      where: eq(schema.trackedCompanies.userId, viewer.id),
      columns: {
        stockSymbolId: true,
      },
    });

    return trackedCompanies.map((tc) => tc.stockSymbolId);
  });
