import type { EarningsScheduleSelect } from "~/postgres/schema";

/**
 * Fiscal quarter information parsed from earnings schedule data.
 */
export interface FiscalQuarter {
  year: number;
  quarter: number;
}

/**
 * A pending or failed job with its associated earnings schedule.
 */
export interface PendingJob {
  id: string;
  earningsSchedule: EarningsScheduleSelect;
}

/**
 * Result of processing an earnings fetch job.
 */
export type ProcessResult =
  | { status: "completed"; documentId: string }
  | { status: "pending"; reason: string }
  | { status: "failed"; reason: string }
  | { status: "skipped"; reason: string };

/**
 * Result for job processing that includes job ID.
 */
export type JobResult =
  | { success: true; documentId: string; jobId: string }
  | { success: false; error: string };

/**
 * Symbol info for fetching transcripts.
 */
export interface SymbolInfo {
  symbol: string;
  name: string;
}

/**
 * User info for event data.
 */
export interface UserInfo {
  id: string;
  email: string;
}
