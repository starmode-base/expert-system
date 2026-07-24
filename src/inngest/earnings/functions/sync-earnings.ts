import { inngest } from "~/inngest/client";
import { fetchRecentCalls } from "../api/earnings-calls";
import {
  getSyncCursor,
  ingestRecentCalls,
  listDispatchableCallIds,
  saveSyncCursor,
} from "../services/earnings-repository";

const PAGE_LIMIT = 100;
const MAX_PAGES_PER_RUN = 50;

interface SyncPageResult {
  callIds: string[];
  count: number;
  hasMore: boolean;
  nextAfterId: number;
}

export const syncEarningsCalls = inngest.createFunction(
  {
    id: "earnings.sync",
    retries: 5,
  },
  [{ cron: "0 */4 * * *" }, { event: "earnings/sync.requested" }],
  async ({ step }) => {
    let cursor = await step.run("load-cursor", getSyncCursor);
    let bootstrapped = false;
    let pagesProcessed = 0;
    let callsSeen = 0;

    if (cursor === null) {
      cursor = await step.run("bootstrap-cursor", async () => {
        const page = await fetchRecentCalls({ limit: 1 });
        await saveSyncCursor(page.nextAfterId, { complete: true });
        return page.nextAfterId;
      });
      bootstrapped = true;
    } else {
      let hasMore = true;

      while (hasMore && pagesProcessed < MAX_PAGES_PER_RUN) {
        const pageCursor: number = cursor;
        const page: SyncPageResult = await step.run(
          `sync-page-${String(pageCursor)}`,
          async () => {
            const result = await fetchRecentCalls({
              afterId: pageCursor,
              limit: PAGE_LIMIT,
            });
            const callIds = await ingestRecentCalls(result.calls);
            await saveSyncCursor(result.nextAfterId, {
              complete: !result.hasMore,
            });
            return {
              callIds,
              count: result.calls.length,
              hasMore: result.hasMore,
              nextAfterId: result.nextAfterId,
            };
          },
        );

        cursor = page.nextAfterId;
        hasMore = page.hasMore;
        callsSeen += page.count;
        pagesProcessed += 1;
      }
    }

    const callIds = await step.run(
      "list-dispatchable-calls",
      listDispatchableCallIds,
    );

    if (callIds.length > 0) {
      await step.sendEvent(
        "dispatch-earnings-calls",
        callIds.map((callId) => ({
          name: "earnings/call.discovered" as const,
          data: { callId },
        })),
      );
    }

    return {
      bootstrapped,
      pagesProcessed,
      callsSeen,
      dispatched: callIds.length,
      cursor,
    };
  },
);
