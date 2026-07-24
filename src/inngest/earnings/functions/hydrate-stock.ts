import { NonRetriableError } from "inngest";
import { inngest } from "~/inngest/client";
import { EarningsCallsApiError, fetchLatestCall } from "../api/earnings-calls";
import { upsertTrackedStockAndCall } from "../services/earnings-repository";
import {
  claimStockHydration,
  completeStockHydration,
  failStockHydration,
} from "../services/hydration-repository";

function nextHydrationAttemptAt(error: unknown): Date {
  const now = new Date();
  if (
    error instanceof EarningsCallsApiError &&
    error.status === 429 &&
    !error.retryable
  ) {
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 1),
    );
  }
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

export const hydrateEarningsStock = inngest.createFunction(
  {
    id: "earnings.hydrate-stock",
    retries: 5,
    concurrency: { limit: 5 },
  },
  { event: "earnings/stock.hydrate" },
  async ({ event, step }) => {
    const company = await step.run("claim-stock-hydration", () =>
      claimStockHydration(event.data.catalogId),
    );

    if (!company) {
      return { status: "ignored" as const };
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

      await step.run("complete-stock-hydration", () =>
        completeStockHydration(company.trackedStockId),
      );

      await step.sendEvent("process-latest-earnings-call", {
        name: "earnings/call.discovered",
        data: { callId },
      });

      return { status: "queued" as const, callId };
    } catch (error) {
      await step.run("record-stock-hydration-failure", () =>
        failStockHydration(
          company.trackedStockId,
          error,
          nextHydrationAttemptAt(error),
        ),
      );
      if (error instanceof EarningsCallsApiError && !error.retryable) {
        throw new NonRetriableError(error.message);
      }
      throw error;
    }
  },
);
