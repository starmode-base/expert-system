import { eq, inArray } from "drizzle-orm";
import { db, schema } from "~/postgres/db";
import { inngest } from "../../../client";
import { fetchAndSaveTranscript } from "../../scrapers/save-content";
import {
  AlphaVantageRateLimitError,
  AlphaVantageTranscriptMissingError,
} from "~/inngest/importers/scrapers/earnings-transcripts";
import {
  earningsCallTakeawayPrompt,
  JobResult,
  parseFiscalQuarter,
  PendingJob,
} from "./process-earnings-jobs-helpers";

/**
 * Process pending earnings fetch jobs.
 * Runs daily at 5 AM Phoenix time (day after reports).
 * Retries failed jobs for up to 7 days after report date.
 */
export const processEarningsJobs = inngest.createFunction(
  { id: "scheduler.process-earnings-jobs" },
  { cron: "TZ=America/Phoenix 0 5 * * *" },
  async ({ step }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Allow a few days of date drift in the calendar.
    const pendingToleranceDays = 3;
    const pendingWindowStart = new Date(today);
    pendingWindowStart.setDate(
      pendingWindowStart.getDate() - pendingToleranceDays,
    );
    const pendingWindowEnd = new Date(today);
    pendingWindowEnd.setDate(
      pendingWindowEnd.getDate() + pendingToleranceDays + 1,
    );

    // Retry window for failed jobs, inclusive of the last 7 days plus tolerance.
    const retryWindowStart = new Date(today);
    retryWindowStart.setDate(
      retryWindowStart.getDate() - (7 + pendingToleranceDays),
    );

    const pendingJobs = await step.run("get-pending-jobs", async () => {
      const jobs = await db.query.earningsFetchJobs.findMany({
        where: inArray(schema.earningsFetchJobs.status, ["pending", "failed"]),
        with: { earningsSchedule: true },
      });

      return jobs
        .filter((job) => {
          const reportDate = new Date(job.earningsSchedule.reportDate);
          reportDate.setHours(0, 0, 0, 0);
          // Pending jobs run within a tolerance window around today.
          if (job.status === "pending") {
            return (
              reportDate >= pendingWindowStart && reportDate < pendingWindowEnd
            );
          }

          // Failed jobs retry daily for up to 7 days after report date.
          return (
            reportDate >= retryWindowStart && reportDate < pendingWindowEnd
          );
        })
        .map(
          (job): PendingJob => ({
            id: job.id,
            earningsSchedule: job.earningsSchedule,
          }),
        );
    });

    if (pendingJobs.length === 0) {
      console.log("No pending earnings jobs to process");
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    console.log(`Processing ${pendingJobs.length} pending earnings jobs`);

    const results: JobResult[] = [];

    for (const job of pendingJobs) {
      const result = await step.run(`process-job-${job.id}`, async () => {
        await db
          .update(schema.earningsFetchJobs)
          .set({ status: "processing" })
          .where(eq(schema.earningsFetchJobs.id, job.id));

        const { earningsSchedule } = job;
        const { year, quarter } = parseFiscalQuarter({
          reportDate: new Date(earningsSchedule.reportDate),
          fiscalYearEnd: new Date(earningsSchedule.fiscalDateEnding),
        });

        try {
          const documentId = await fetchAndSaveTranscript({
            symbol: earningsSchedule.symbol,
            name: earningsSchedule.name,
            year,
            quarter,
            earningsDate: new Date(earningsSchedule.reportDate),
          });

          await db
            .update(schema.earningsFetchJobs)
            .set({ status: "completed", processedAt: new Date() })
            .where(eq(schema.earningsFetchJobs.id, job.id));

          return { success: true as const, documentId, jobId: job.id };
        } catch (error) {
          if (error instanceof AlphaVantageRateLimitError) {
            throw error;
          }

          if (error instanceof AlphaVantageTranscriptMissingError) {
            await db
              .update(schema.earningsFetchJobs)
              .set({
                status: "pending",
                processedAt: new Date(),
                errorMessage: error.message,
              })
              .where(eq(schema.earningsFetchJobs.id, job.id));

            return {
              success: false as const,
              error: error.message,
            };
          }

          console.error(`Failed to process job ${job.id}:`, error);

          await db
            .update(schema.earningsFetchJobs)
            .set({
              status: "failed",
              processedAt: new Date(),
              errorMessage:
                error instanceof Error ? error.message : "Unknown error",
            })
            .where(eq(schema.earningsFetchJobs.id, job.id));

          return {
            success: false as const,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      });

      results.push(result);

      await step.sleep(`sleep-1-second-${job.id}`, 1000);
    }

    const successfulResults = results.filter(
      (r): r is { success: true; documentId: string; jobId: string } =>
        r.success,
    );

    await Promise.all(
      successfulResults.map((result) =>
        step.sendEvent(`generate-takeaways-${result.jobId}`, {
          name: "app/generate-takeaways",
          data: {
            documentId: result.documentId,
            takeawayPrompt: earningsCallTakeawayPrompt,
            model: "gpt-5.2",
            user: { id: "", email: "" },
          },
        }),
      ),
    );

    return {
      processed: pendingJobs.length,
      succeeded: successfulResults.length,
      failed: results.length - successfulResults.length,
    };
  },
);
