import { publishNotifyUI } from "~/lib/ably";
import { inngest } from "~/inngest/client";
import { AlphaVantageRateLimitError } from "../api/alpha-vantage-transcripts";
import { createJobsForSymbols, processJob } from "../services/job-manager";
import {
  CONFIG,
  EARNINGS_TAKEAWAY_MODEL,
  EARNINGS_TAKEAWAY_PROMPT,
} from "../constants";
import type { ProcessResult } from "../types";

interface FetchResult {
  symbol: string;
  result: ProcessResult;
}

/**
 * Manual trigger for fetching earnings transcripts.
 * Creates jobs for tracking, then processes them.
 *
 * This replaces the old earnings-calls-scraper and unifies
 * manual fetches with the job tracking system.
 */
export const fetchEarningsTranscripts = inngest.createFunction(
  { id: "earnings.fetch-transcripts" },
  { event: "scraper/earnings-calls" },
  async ({ step, event }) => {
    console.log("Fetch transcripts started:", event.data);

    const { symbols, year, quarter, user } = event.data;

    // Step 1: Create jobs for requested symbols
    const jobs = await step.run("create-jobs", async () => {
      return createJobsForSymbols(symbols, year, quarter);
    });

    if (jobs.length === 0) {
      await step.run("notify-no-jobs", async () => {
        await publishNotifyUI(user.id, "No valid symbols to process");
      });
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    // Step 2: Process each job
    const results: FetchResult[] = [];

    for (const job of jobs) {
      const symbol = job.earningsSchedule.symbol;

      const result = await step.run(`fetch-transcript-${symbol}`, async () => {
        try {
          return await processJob(job.id);
        } catch (error) {
          // Re-throw rate limit errors for Inngest retry
          if (error instanceof AlphaVantageRateLimitError) {
            throw error;
          }

          console.log(`Error processing ${symbol}:`, error);
          await publishNotifyUI(user.id, `Error fetching ${symbol} transcript`);

          return {
            status: "failed" as const,
            reason: error instanceof Error ? error.message : "Unknown error",
          };
        }
      });

      results.push({ symbol, result });

      // Rate limit between requests
      await step.sleep(`rate-limit-${symbol}`, CONFIG.RATE_LIMIT_DELAY_MS);
    }

    // Step 3: Collect successful results
    const successful = results.filter(
      (
        r,
      ): r is FetchResult & {
        result: { status: "completed"; documentId: string };
      } => r.result.status === "completed",
    );

    const documentIds = successful.map((r) => r.result.documentId);

    if (documentIds.length === 0 && symbols.length > 0) {
      await step.run("notify-complete-no-results", async () => {
        await publishNotifyUI(user.id, "Complete");
      });
      return { processed: jobs.length, succeeded: 0, failed: jobs.length };
    }

    // Step 4: Notify user of progress
    await step.run("notify-generating-takeaways", async () => {
      await publishNotifyUI(
        user.id,
        `Scrape Complete. Generating takeaways for ${documentIds.length} Transcripts`,
      );
    });

    // Step 5: Trigger takeaway generation for successful fetches
    await Promise.all(
      successful.map((result) =>
        step.sendEvent(`generate-takeaways-${result.result.documentId}`, {
          name: "app/generate-takeaways",
          data: {
            documentId: result.result.documentId,
            takeawayPrompt: EARNINGS_TAKEAWAY_PROMPT,
            model: EARNINGS_TAKEAWAY_MODEL,
            user,
          },
        }),
      ),
    );

    // Step 6: Final notification
    await step.run("notify-complete", async () => {
      await publishNotifyUI(user.id, "Complete");
    });

    return {
      processed: jobs.length,
      succeeded: successful.length,
      failed: jobs.length - successful.length,
    };
  },
);
