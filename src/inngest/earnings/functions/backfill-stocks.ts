import { inngest } from "~/inngest/client";
import { getMonthlyEarningsApiRequestCount } from "../services/api-usage-repository";
import { listDueStockHydrations } from "../services/hydration-repository";

const MONTHLY_REQUEST_LIMIT = 5_000;
const REQUEST_RESERVE = 500;
const ESTIMATED_REQUESTS_PER_HYDRATION = 2;
const MAX_HYDRATIONS_PER_RUN = 5;

export const backfillEarningsStocks = inngest.createFunction(
  {
    id: "earnings.backfill-stocks",
    retries: 2,
    concurrency: { limit: 1 },
  },
  { cron: "30 */4 * * *" },
  async ({ step }) => {
    const requestsUsed = await step.run(
      "load-monthly-api-usage",
      getMonthlyEarningsApiRequestCount,
    );
    const availableRequests = Math.max(
      0,
      MONTHLY_REQUEST_LIMIT - REQUEST_RESERVE - requestsUsed,
    );
    const hydrationLimit = Math.min(
      MAX_HYDRATIONS_PER_RUN,
      Math.floor(availableRequests / ESTIMATED_REQUESTS_PER_HYDRATION),
    );

    if (hydrationLimit === 0) {
      return {
        status: "budget_exhausted" as const,
        requestsUsed,
        queued: 0,
      };
    }

    const stocks = await step.run("list-due-stock-hydrations", () =>
      listDueStockHydrations(hydrationLimit),
    );

    if (stocks.length > 0) {
      await step.sendEvent(
        "dispatch-stock-hydrations",
        stocks.map((stock) => ({
          name: "earnings/stock.hydrate" as const,
          data: { catalogId: stock.catalogId },
        })),
      );
    }

    return {
      status: "dispatched" as const,
      requestsUsed,
      queued: stocks.length,
    };
  },
);
