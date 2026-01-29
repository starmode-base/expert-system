import { publishNotifyUI } from "~/lib/ably";
import { inngest } from "~/inngest/client";
import {
  AlphaVantageRateLimitError,
  AlphaVantageTranscriptMissingError,
} from "../api/alpha-vantage-transcripts";
import { findOrPrepareForFetch, processJob } from "../services/job-manager";
import { fetchAndSaveTranscript } from "../services/transcript-service";
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
 * Processes a direct fetch (no job tracking) for symbols not in earningsSchedule.
 */
async function processDirectFetch(target: {
  symbol: string;
  name: string;
  year: number;
  quarter: number;
}): Promise<ProcessResult> {
  try {
    const documentId = await fetchAndSaveTranscript({
      symbol: target.symbol,
      name: target.name,
      year: target.year,
      quarter: target.quarter,
    });
    return { status: "completed", documentId };
  } catch (error) {
    if (error instanceof AlphaVantageRateLimitError) {
      throw error;
    }
    if (error instanceof AlphaVantageTranscriptMissingError) {
      return { status: "pending", reason: "transcript_not_available" };
    }
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Manual trigger for fetching earnings transcripts.
 *
 * If a matching earningsSchedule exists, uses job tracking.
 * Otherwise, fetches directly without creating fake schedule entries.
 */
export const fetchEarningsTranscripts = inngest.createFunction(
  { id: "earnings.fetch-transcripts" },
  { event: "scraper/earnings-calls" },
  async ({ step, event }) => {
    console.log("Fetch transcripts started:", event.data);

    const { symbols, year, quarter, user } = event.data;

    // Step 1: Find existing jobs or prepare for direct fetch
    const targets = await step.run("find-targets", async () => {
      return findOrPrepareForFetch(symbols, year, quarter);
    });

    if (targets.length === 0) {
      await step.run("notify-no-targets", async () => {
        await publishNotifyUI(user.id, "No valid symbols to process");
      });
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    // Step 2: Process each target (job or direct)
    const results: FetchResult[] = [];

    for (const target of targets) {
      const symbol =
        target.type === "job"
          ? target.job.earningsSchedule.symbol
          : target.symbol;

      const result = await step.run(`fetch-transcript-${symbol}`, async () => {
        try {
          if (target.type === "job") {
            return await processJob(target.job.id);
          } else {
            return await processDirectFetch(target);
          }
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
      return {
        processed: targets.length,
        succeeded: 0,
        failed: targets.length,
      };
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
      processed: targets.length,
      succeeded: successful.length,
      failed: targets.length - successful.length,
    };
  },
);
