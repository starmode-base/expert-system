import { inngest } from "~/inngest/client";
import {
  getProcessableJobs,
  markStaleJobsAsSkipped,
  processJob,
} from "../services/job-manager";
import {
  CONFIG,
  EARNINGS_TAKEAWAY_MODEL,
  EARNINGS_TAKEAWAY_PROMPT,
} from "../constants";
import type { JobResult } from "../types";

/**
 * Process pending earnings fetch jobs.
 * Runs daily at 5 AM Phoenix time (day after reports).
 * Retries failed jobs for up to 7 days after report date.
 */
const trigger =
  process.env.NODE_ENV === "production"
    ? ({ cron: "TZ=America/Phoenix 0 5 * * *" } as const)
    : ({ event: "dev/earnings.process-jobs.manual" } as const);

export const processEarningsJobs = inngest.createFunction(
  { id: "earnings.process-jobs" },
  trigger,
  async ({ step }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Step 1: Mark stale jobs as skipped
    const skippedCount = await step.run("mark-stale-jobs", async () => {
      return markStaleJobsAsSkipped(today);
    });

    // Step 2: Get jobs that are ready to process
    const pendingJobs = await step.run("get-pending-jobs", async () => {
      return getProcessableJobs(today);
    });

    if (pendingJobs.length === 0) {
      console.log("No pending earnings jobs to process");
      return { processed: 0, succeeded: 0, failed: 0, skipped: skippedCount };
    }

    console.log(`Processing ${pendingJobs.length} pending earnings jobs`);

    const results: JobResult[] = [];

    // Step 3: Process each job
    for (const job of pendingJobs) {
      const result = await step.run(`process-job-${job.id}`, async () => {
        const processResult = await processJob(job.id);

        if (processResult.status === "completed") {
          return {
            ticker: job.earningsSchedule.symbol,
            reportDate: job.earningsSchedule.reportDate,
            success: true as const,
            documentId: processResult.documentId,
            jobId: job.id,
          };
        }

        return {
          ticker: job.earningsSchedule.symbol,
          reportDate: job.earningsSchedule.reportDate,
          success: false as const,
          error: processResult.reason,
        };
      });

      results.push(result);

      // Rate limit between requests
      await step.sleep(`rate-limit-${job.id}`, CONFIG.RATE_LIMIT_DELAY_MS);
    }

    // Step 4: Generate takeaways for successful fetches
    const successfulResults = results.filter(
      (
        r,
      ): r is {
        ticker: string;
        success: true;
        documentId: string;
        jobId: string;
      } => r.success,
    );

    await Promise.all(
      successfulResults.map((result) =>
        step.sendEvent(`generate-takeaways-${result.jobId}`, {
          name: "app/generate-takeaways",
          data: {
            documentId: result.documentId,
            takeawayPrompt: EARNINGS_TAKEAWAY_PROMPT,
            model: EARNINGS_TAKEAWAY_MODEL,
            user: { id: "", email: "" },
          },
        }),
      ),
    );

    return {
      processed: pendingJobs.length,
      succeeded: successfulResults.length,
      failed: results.length - successfulResults.length,
      skipped: skippedCount,
    };
  },
);
