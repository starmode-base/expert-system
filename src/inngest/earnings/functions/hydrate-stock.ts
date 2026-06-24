import { NonRetriableError } from "inngest";
import { inngest } from "~/inngest/client";
import { EarningsCallsApiError, fetchLatestCall } from "../api/earnings-calls";
import { upsertTrackedStockAndCall } from "../services/earnings-repository";
import { db, schema } from "~/postgres/db";
import { and, eq } from "drizzle-orm";

export const hydrateEarningsStock = inngest.createFunction(
  {
    id: "earnings.hydrate-stock",
    retries: 5,
    concurrency: { limit: 5 },
  },
  { event: "earnings/stock.hydrate" },
  async ({ event, step }) => {
    const company = await step.run("load-active-company", async () => {
      const catalog = await db.query.earningsCompanyCatalog.findFirst({
        where: eq(schema.earningsCompanyCatalog.id, event.data.catalogId),
      });
      if (!catalog) {
        throw new NonRetriableError("Catalog company no longer exists");
      }

      const tracked = await db.query.trackedStocks.findFirst({
        where: and(
          eq(schema.trackedStocks.symbol, catalog.symbol),
          eq(schema.trackedStocks.mic, catalog.mic),
          eq(schema.trackedStocks.active, true),
        ),
        columns: { id: true },
      });

      return tracked ? catalog : null;
    });

    if (!company) {
      return { status: "inactive" as const };
    }

    try {
      const callId = await step.run(
        "hydrate-latest-earnings-call",
        async () => {
          const latestCall = await fetchLatestCall(company.symbol, company.mic);
          const result = await upsertTrackedStockAndCall(latestCall);
          return result.callId;
        },
      );

      await step.sendEvent("process-latest-earnings-call", {
        name: "earnings/call.discovered",
        data: { callId },
      });

      return { status: "queued" as const, callId };
    } catch (error) {
      if (error instanceof EarningsCallsApiError && !error.retryable) {
        throw new NonRetriableError(error.message);
      }
      throw error;
    }
  },
);
