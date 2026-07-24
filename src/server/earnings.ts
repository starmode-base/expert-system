import { createServerFn } from "@tanstack/react-start";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  isNotNull,
  or,
} from "drizzle-orm";
import { z } from "zod";
import { activateCatalogStocks } from "~/inngest/earnings/services/catalog-repository";
import { getMonthlyEarningsApiRequestCount } from "~/inngest/earnings/services/api-usage-repository";
import {
  queueAllActiveStockHydrations,
  queueStockHydration,
} from "~/inngest/earnings/services/hydration-repository";
import { inngest } from "~/inngest/client";
import { assertDevUser } from "~/lib/dev-user";
import { authMiddleware } from "~/middleware/auth-middleware";
import { db, schema } from "~/postgres/db";
import type {
  EarningsCallStatus,
  EarningsHydrationStatus,
} from "~/postgres/schema";
import type { PaginatedResult } from "./pagination";

export interface TrackedStockView {
  id: string;
  symbol: string;
  companyName: string;
  exchange: string;
  mic: string;
  country: string;
  active: boolean;
  hydrationStatus: EarningsHydrationStatus;
  hydrationLastError: string | null;
  hydrationNextAttemptAt: string | null;
  latestCall: {
    id: string;
    transcriptTitle: string;
    eventDateTime: string;
    status: EarningsCallStatus;
    documentId: string | null;
    lastError: string | null;
  } | null;
}

export interface EarningsCatalogCompanyView {
  id: string;
  symbol: string;
  companyName: string;
  sector: string | null;
  industry: string | null;
  exchange: string;
  mic: string;
  callCount: number;
  latestCallAt: string | null;
  trackedStockId: string | null;
  trackedActive: boolean;
}

const catalogCursorSchema = z.object({
  companyName: z.string(),
  symbol: z.string(),
  mic: z.string(),
});

const catalogFiltersSchema = z.object({
  search: z.string().optional(),
  sector: z.string().optional(),
});

function buildCatalogConditions(filters: z.infer<typeof catalogFiltersSchema>) {
  const conditions = [eq(schema.earningsCompanyCatalog.country, "US")];
  const search = filters.search?.trim();
  if (search) {
    const pattern = `%${search}%`;
    const searchCondition = or(
      ilike(schema.earningsCompanyCatalog.symbol, pattern),
      ilike(schema.earningsCompanyCatalog.companyName, pattern),
      ilike(schema.earningsCompanyCatalog.sector, pattern),
      ilike(schema.earningsCompanyCatalog.industry, pattern),
      ilike(schema.earningsCompanyCatalog.exchange, pattern),
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const sector = filters.sector?.trim();
  if (sector) {
    conditions.push(eq(schema.earningsCompanyCatalog.sector, sector));
  }

  return conditions;
}

function ensureDev(clerkUserId: string): void {
  assertDevUser(clerkUserId);
}

export const listTrackedStocksSF = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<TrackedStockView[]> => {
    ensureDev(context.viewer.clerkUserId);

    const [stocks, calls] = await Promise.all([
      db
        .select()
        .from(schema.trackedStocks)
        .orderBy(
          desc(schema.trackedStocks.active),
          asc(schema.trackedStocks.symbol),
        ),
      db.query.earningsCalls.findMany({
        orderBy: (earningsCalls, { desc }) => [
          desc(earningsCalls.eventDateTime),
        ],
      }),
    ]);

    const latestByStock = new Map<string, (typeof calls)[number]>();
    for (const call of calls) {
      if (!latestByStock.has(call.trackedStockId)) {
        latestByStock.set(call.trackedStockId, call);
      }
    }

    return stocks.map((stock) => {
      const latest = latestByStock.get(stock.id);
      return {
        id: stock.id,
        symbol: stock.symbol,
        companyName: stock.companyName,
        exchange: stock.exchange,
        mic: stock.mic,
        country: stock.country,
        active: stock.active,
        hydrationStatus: stock.hydrationStatus,
        hydrationLastError: stock.hydrationLastError,
        hydrationNextAttemptAt:
          stock.hydrationNextAttemptAt?.toISOString() ?? null,
        latestCall: latest
          ? {
              id: latest.id,
              transcriptTitle: latest.transcriptTitle,
              eventDateTime: latest.eventDateTime.toISOString(),
              status: latest.status,
              documentId: latest.documentId,
              lastError: latest.lastError,
            }
          : null,
      };
    });
  });

export const queryEarningsCatalogSF = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(
    catalogFiltersSchema.extend({
      cursor: z.string().nullable(),
      limit: z.number().int().min(1).max(100).default(50),
    }),
  )
  .handler(
    async ({
      context,
      data,
    }): Promise<PaginatedResult<EarningsCatalogCompanyView>> => {
      ensureDev(context.viewer.clerkUserId);

      const conditions = buildCatalogConditions(data);

      if (data.cursor) {
        const cursor = catalogCursorSchema.parse(JSON.parse(data.cursor));
        const cursorCondition = or(
          gt(schema.earningsCompanyCatalog.companyName, cursor.companyName),
          and(
            eq(schema.earningsCompanyCatalog.companyName, cursor.companyName),
            gt(schema.earningsCompanyCatalog.symbol, cursor.symbol),
          ),
          and(
            eq(schema.earningsCompanyCatalog.companyName, cursor.companyName),
            eq(schema.earningsCompanyCatalog.symbol, cursor.symbol),
            gt(schema.earningsCompanyCatalog.mic, cursor.mic),
          ),
        );
        if (cursorCondition) conditions.push(cursorCondition);
      }

      const rows = await db
        .select({
          id: schema.earningsCompanyCatalog.id,
          symbol: schema.earningsCompanyCatalog.symbol,
          companyName: schema.earningsCompanyCatalog.companyName,
          sector: schema.earningsCompanyCatalog.sector,
          industry: schema.earningsCompanyCatalog.industry,
          exchange: schema.earningsCompanyCatalog.exchange,
          mic: schema.earningsCompanyCatalog.mic,
          callCount: schema.earningsCompanyCatalog.callCount,
          latestCallAt: schema.earningsCompanyCatalog.latestCallAt,
          trackedStockId: schema.trackedStocks.id,
          trackedActive: schema.trackedStocks.active,
        })
        .from(schema.earningsCompanyCatalog)
        .leftJoin(
          schema.trackedStocks,
          and(
            eq(
              schema.earningsCompanyCatalog.symbol,
              schema.trackedStocks.symbol,
            ),
            eq(schema.earningsCompanyCatalog.mic, schema.trackedStocks.mic),
          ),
        )
        .where(and(...conditions))
        .orderBy(
          asc(schema.earningsCompanyCatalog.companyName),
          asc(schema.earningsCompanyCatalog.symbol),
          asc(schema.earningsCompanyCatalog.mic),
        )
        .limit(data.limit + 1);

      const hasMore = rows.length > data.limit;
      const items = (hasMore ? rows.slice(0, data.limit) : rows).map((row) => ({
        ...row,
        latestCallAt: row.latestCallAt?.toISOString() ?? null,
        trackedActive: row.trackedActive ?? false,
      }));
      const last = items[items.length - 1];

      return {
        items,
        nextCursor:
          hasMore && last
            ? JSON.stringify({
                companyName: last.companyName,
                symbol: last.symbol,
                mic: last.mic,
              })
            : null,
      };
    },
  );

export const getEarningsCatalogStatusSF = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    ensureDev(context.viewer.clerkUserId);

    const [catalogCount, latest, requestsUsed, hydrationCounts] =
      await Promise.all([
        db.$count(schema.earningsCompanyCatalog),
        db.query.earningsCompanyCatalog.findFirst({
          columns: { catalogSyncedAt: true },
          orderBy: (catalog, { desc }) => [desc(catalog.catalogSyncedAt)],
        }),
        getMonthlyEarningsApiRequestCount(),
        db
          .select({
            status: schema.trackedStocks.hydrationStatus,
            count: count(),
          })
          .from(schema.trackedStocks)
          .where(eq(schema.trackedStocks.active, true))
          .groupBy(schema.trackedStocks.hydrationStatus),
      ]);

    return {
      count: catalogCount,
      lastSyncedAt: latest?.catalogSyncedAt.toISOString() ?? null,
      requestsUsed,
      requestLimit: 5_000,
      hydrationCounts: Object.fromEntries(
        hydrationCounts.map((row) => [row.status, row.count]),
      ),
    };
  });

export const listEarningsCatalogSectorsSF = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<string[]> => {
    ensureDev(context.viewer.clerkUserId);

    const rows = await db
      .selectDistinct({ sector: schema.earningsCompanyCatalog.sector })
      .from(schema.earningsCompanyCatalog)
      .where(
        and(
          eq(schema.earningsCompanyCatalog.country, "US"),
          isNotNull(schema.earningsCompanyCatalog.sector),
        ),
      )
      .orderBy(asc(schema.earningsCompanyCatalog.sector));

    return rows.flatMap((row) => (row.sector ? [row.sector] : []));
  });

export const activateEarningsCatalogStocksSF = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator(
    z.object({
      catalogIds: z.array(z.string()).min(1).max(100),
    }),
  )
  .handler(async ({ context, data }) => {
    ensureDev(context.viewer.clerkUserId);

    const uniqueIds = [...new Set(data.catalogIds)];
    const hydrationQueued = await activateCatalogStocks(uniqueIds);

    return {
      selected: uniqueIds.length,
      hydrationQueued,
    };
  });

export const deactivateTrackedStockSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ stockId: z.string() }))
  .handler(async ({ context, data }) => {
    ensureDev(context.viewer.clerkUserId);

    const [stock] = await db
      .update(schema.trackedStocks)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(schema.trackedStocks.id, data.stockId))
      .returning({ id: schema.trackedStocks.id });

    if (!stock) {
      throw new Error("Tracked stock not found");
    }

    return { success: true };
  });

export const pullLatestTranscriptSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ stockId: z.string() }))
  .handler(async ({ context, data }) => {
    ensureDev(context.viewer.clerkUserId);

    const stock = await db.query.trackedStocks.findFirst({
      where: eq(schema.trackedStocks.id, data.stockId),
      columns: { active: true },
    });

    if (!stock) {
      throw new Error("Tracked stock not found");
    }
    if (!stock.active) {
      throw new Error("Stock is inactive. Reactivate it first.");
    }

    const catalogId = await queueStockHydration(data.stockId);
    if (!catalogId) {
      throw new Error(
        "Company not found in the catalog. Refresh the catalog first.",
      );
    }

    await inngest.send({
      name: "earnings/stock.hydrate",
      data: { catalogId },
    });

    return { success: true };
  });

export const pullAllLatestTranscriptsSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    ensureDev(context.viewer.clerkUserId);

    const queued = await queueAllActiveStockHydrations();
    return { queued };
  });

export const requestEarningsSyncSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    ensureDev(context.viewer.clerkUserId);
    await inngest.send({ name: "earnings/sync.requested", data: {} });
    return { success: true };
  });

export const requestEarningsCatalogSyncSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    ensureDev(context.viewer.clerkUserId);
    await inngest.send({
      name: "earnings/catalog.sync.requested",
      data: {},
    });
    return { success: true };
  });
