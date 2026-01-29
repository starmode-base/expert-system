import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "~/postgres/db";
import {
  AlphaVantageRateLimitError,
  AlphaVantageTranscriptMissingError,
} from "../api/alpha-vantage-transcripts";
import { CONFIG } from "../constants";
import { parseFiscalQuarter } from "./fiscal-quarter";
import {
  checkTranscriptExists,
  fetchAndSaveTranscript,
} from "./transcript-service";
import type { PendingJob, ProcessResult, SymbolInfo } from "../types";

/**
 * Creates a fetch job for an earnings schedule entry.
 * Returns the existing job ID if one already exists.
 */
export async function createJob(
  earningsScheduleId: string,
): Promise<{ jobId: string; created: boolean }> {
  // Check if job already exists
  const existing = await db.query.earningsFetchJobs.findFirst({
    where: eq(schema.earningsFetchJobs.earningsScheduleId, earningsScheduleId),
    columns: { id: true },
  });

  if (existing) {
    return { jobId: existing.id, created: false };
  }

  const result = await db
    .insert(schema.earningsFetchJobs)
    .values({
      earningsScheduleId,
      status: "pending",
    })
    .returning({ id: schema.earningsFetchJobs.id });

  if (!result[0]) {
    throw new Error("Failed to create job");
  }

  return { jobId: result[0].id, created: true };
}

/**
 * Creates or gets earnings schedule entries and jobs for the given symbols.
 * Used by manual fetch to ensure jobs exist before processing.
 */
export async function createJobsForSymbols(
  symbols: SymbolInfo[],
  year: number,
  quarter: number,
): Promise<PendingJob[]> {
  const jobs: PendingJob[] = [];

  for (const { symbol, name } of symbols) {
    // Build a fiscalDateEnding from year and quarter
    // This is approximate since we don't know the exact fiscal year end
    const quarterEndMonth = quarter * 3;
    const fiscalDateEnding = `${year}-${String(quarterEndMonth).padStart(2, "0")}-30`;

    // Check if earnings schedule exists, create if not
    let scheduleEntry = await db.query.earningsSchedule.findFirst({
      where: and(
        eq(schema.earningsSchedule.symbol, symbol),
        eq(schema.earningsSchedule.fiscalDateEnding, fiscalDateEnding),
      ),
    });

    if (!scheduleEntry) {
      // Create a minimal earnings schedule entry for manual fetches
      const result = await db
        .insert(schema.earningsSchedule)
        .values({
          symbol,
          name,
          fiscalDateEnding,
          reportDate: new Date(), // Use today as report date for manual fetches
          estimate: null,
          currency: null,
        })
        .onConflictDoNothing()
        .returning();

      // Re-fetch in case of race condition
      scheduleEntry =
        result[0] ??
        (await db.query.earningsSchedule.findFirst({
          where: and(
            eq(schema.earningsSchedule.symbol, symbol),
            eq(schema.earningsSchedule.fiscalDateEnding, fiscalDateEnding),
          ),
        }));

      if (!scheduleEntry) {
        console.error(`Failed to create/find earnings schedule for ${symbol}`);
        continue;
      }
    }

    // Create or get job
    const { jobId } = await createJob(scheduleEntry.id);

    jobs.push({
      id: jobId,
      earningsSchedule: scheduleEntry,
    });
  }

  return jobs;
}

/**
 * Gets jobs that are ready to be processed based on date windows.
 *
 * @param today - Reference date for window calculations
 * @returns Jobs that should be processed
 */
export async function getProcessableJobs(today: Date): Promise<PendingJob[]> {
  const normalizedToday = new Date(today);
  normalizedToday.setHours(0, 0, 0, 0);

  // Pending jobs: within tolerance window around today
  const pendingWindowStart = new Date(normalizedToday);
  pendingWindowStart.setDate(
    pendingWindowStart.getDate() - CONFIG.PROCESS_WINDOW_BEFORE_DAYS,
  );
  const pendingWindowEnd = new Date(normalizedToday);
  pendingWindowEnd.setDate(
    pendingWindowEnd.getDate() + CONFIG.PROCESS_WINDOW_BEFORE_DAYS + 1,
  );

  // Failed jobs: retry window includes additional days after report date
  const retryWindowStart = new Date(normalizedToday);
  retryWindowStart.setDate(
    retryWindowStart.getDate() -
      (CONFIG.PROCESS_WINDOW_AFTER_DAYS + CONFIG.PROCESS_WINDOW_BEFORE_DAYS),
  );

  const jobs = await db.query.earningsFetchJobs.findMany({
    where: inArray(schema.earningsFetchJobs.status, ["pending", "failed"]),
    with: { earningsSchedule: true },
  });

  return jobs
    .filter((job) => {
      const reportDate = new Date(job.earningsSchedule.reportDate);
      reportDate.setHours(0, 0, 0, 0);

      // Pending jobs run within a tolerance window around today
      if (job.status === "pending") {
        return (
          reportDate >= pendingWindowStart && reportDate < pendingWindowEnd
        );
      }

      // Failed jobs retry daily for up to 7 days after report date
      return reportDate >= retryWindowStart && reportDate < pendingWindowEnd;
    })
    .map(
      (job): PendingJob => ({
        id: job.id,
        earningsSchedule: job.earningsSchedule,
      }),
    );
}

/**
 * Gets a job with its associated earnings schedule.
 */
export async function getJobWithSchedule(
  jobId: string,
): Promise<PendingJob | null> {
  const job = await db.query.earningsFetchJobs.findFirst({
    where: eq(schema.earningsFetchJobs.id, jobId),
    with: { earningsSchedule: true },
  });

  if (!job) return null;

  return {
    id: job.id,
    earningsSchedule: job.earningsSchedule,
  };
}

/**
 * Updates the status of a job.
 */
async function updateJobStatus(
  jobId: string,
  status: "pending" | "processing" | "completed" | "failed" | "skipped",
  errorMessage?: string,
): Promise<void> {
  await db
    .update(schema.earningsFetchJobs)
    .set({
      status,
      processedAt: new Date(),
      errorMessage: errorMessage ?? null,
    })
    .where(eq(schema.earningsFetchJobs.id, jobId));
}

/**
 * Processes a single earnings fetch job.
 *
 * This function is idempotent:
 * - If the job is already completed, returns skipped
 * - If the document already exists, marks as completed and returns the ID
 *
 * @param jobId - The job ID to process
 * @returns Processing result with status and optional document ID
 * @throws AlphaVantageRateLimitError - Should be caught and retried by caller
 */
export async function processJob(jobId: string): Promise<ProcessResult> {
  const job = await getJobWithSchedule(jobId);

  if (!job) {
    return { status: "failed", reason: "job_not_found" };
  }

  // Already completed
  if (
    (
      await db.query.earningsFetchJobs.findFirst({
        where: eq(schema.earningsFetchJobs.id, jobId),
        columns: { status: true },
      })
    )?.status === "completed"
  ) {
    return { status: "skipped", reason: "already_completed" };
  }

  const { earningsSchedule } = job;
  const { year, quarter } = parseFiscalQuarter({
    reportDate: new Date(earningsSchedule.reportDate),
    fiscalYearEnd: new Date(earningsSchedule.fiscalDateEnding),
  });

  // Idempotency: check if document already exists
  const existingId = await checkTranscriptExists({
    name: earningsSchedule.name,
    year,
    quarter,
  });

  if (existingId) {
    await updateJobStatus(jobId, "completed");
    return { status: "completed", documentId: existingId };
  }

  try {
    await updateJobStatus(jobId, "processing");

    const documentId = await fetchAndSaveTranscript({
      symbol: earningsSchedule.symbol,
      name: earningsSchedule.name,
      year,
      quarter,
      earningsDate: new Date(earningsSchedule.reportDate),
    });

    await updateJobStatus(jobId, "completed");
    return { status: "completed", documentId };
  } catch (error) {
    // Rate limit errors should bubble up for Inngest retry
    if (error instanceof AlphaVantageRateLimitError) {
      throw error;
    }

    // Transcript not available yet - mark as pending for retry
    if (error instanceof AlphaVantageTranscriptMissingError) {
      await updateJobStatus(jobId, "pending", error.message);
      return { status: "pending", reason: "transcript_not_available" };
    }

    // Other errors - mark as failed
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`Failed to process job ${jobId}:`, error);
    await updateJobStatus(jobId, "failed", errorMessage);
    return { status: "failed", reason: errorMessage };
  }
}

/**
 * Marks jobs as skipped if they are older than the skip threshold.
 * This prevents jobs from being retried indefinitely.
 *
 * @param today - Reference date for calculations
 * @returns Number of jobs marked as skipped
 */
export async function markStaleJobsAsSkipped(today: Date): Promise<number> {
  const normalizedToday = new Date(today);
  normalizedToday.setHours(0, 0, 0, 0);

  const cutoffDate = new Date(normalizedToday);
  cutoffDate.setDate(cutoffDate.getDate() - CONFIG.SKIP_AFTER_DAYS);

  // Find stale pending/failed jobs
  const staleJobs = await db.query.earningsFetchJobs.findMany({
    where: inArray(schema.earningsFetchJobs.status, ["pending", "failed"]),
    with: { earningsSchedule: { columns: { reportDate: true } } },
    columns: { id: true },
  });

  const jobsToSkip = staleJobs.filter((job) => {
    const reportDate = new Date(job.earningsSchedule.reportDate);
    reportDate.setHours(0, 0, 0, 0);
    return reportDate < cutoffDate;
  });

  if (jobsToSkip.length === 0) {
    return 0;
  }

  await db
    .update(schema.earningsFetchJobs)
    .set({ status: "skipped", processedAt: new Date() })
    .where(
      inArray(
        schema.earningsFetchJobs.id,
        jobsToSkip.map((j) => j.id),
      ),
    );

  console.log(`Marked ${jobsToSkip.length} stale jobs as skipped`);
  return jobsToSkip.length;
}

/**
 * Gets a summary of job statuses for reporting.
 */
export async function getJobStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  skipped: number;
}> {
  const jobs = await db.query.earningsFetchJobs.findMany({
    columns: { status: true },
  });

  return {
    pending: jobs.filter((j) => j.status === "pending").length,
    processing: jobs.filter((j) => j.status === "processing").length,
    completed: jobs.filter((j) => j.status === "completed").length,
    failed: jobs.filter((j) => j.status === "failed").length,
    skipped: jobs.filter((j) => j.status === "skipped").length,
  };
}
