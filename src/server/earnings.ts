import { createServerFn } from "@tanstack/react-start";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  EarningsCallsApiError,
  fetchLatestCall,
} from "~/inngest/earnings/api/earnings-calls";
import { upsertTrackedStockAndCall } from "~/inngest/earnings/services/earnings-repository";
import { inngest } from "~/inngest/client";
import { assertDevUser } from "~/lib/dev-user";
import { authMiddleware } from "~/middleware/auth-middleware";
import { db, schema } from "~/postgres/db";

export interface TrackedStockView {
  id: string;
  symbol: string;
  companyName: string;
  exchange: string;
  mic: string;
  country: string;
  active: boolean;
  latestCall: {
    id: string;
    transcriptTitle: string;
    eventDateTime: string;
    status: "pending" | "processing" | "takeaways_queued" | "failed";
    documentId: string | null;
    lastError: string | null;
  } | null;
}

const symbolSchema = z
  .string()
  .trim()
  .min(1)
  .max(16)
  .regex(/^[a-z0-9.-]+$/i, "Enter a valid stock symbol");

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

export const trackStockSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ symbol: symbolSchema }))
  .handler(async ({ context, data }) => {
    ensureDev(context.viewer.clerkUserId);

    try {
      const latestCall = await fetchLatestCall(data.symbol);
      const result = await upsertTrackedStockAndCall(latestCall);

      await inngest.send({
        name: "earnings/call.discovered",
        data: { callId: result.callId },
      });

      return {
        stockId: result.stock.id,
        callId: result.callId,
        symbol: result.stock.symbol,
      };
    } catch (error) {
      if (error instanceof EarningsCallsApiError && error.status === 404) {
        throw new Error(
          `No US earnings calls found for ${data.symbol.toUpperCase()}`,
        );
      }
      throw error;
    }
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

export const requestEarningsSyncSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    ensureDev(context.viewer.clerkUserId);
    await inngest.send({ name: "earnings/sync.requested", data: {} });
    return { success: true };
  });
