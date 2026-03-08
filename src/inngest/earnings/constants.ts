/**
 * Configuration constants for the earnings call system.
 */
export const CONFIG = {
  /** Days before report date to start processing pending jobs */
  PROCESS_WINDOW_BEFORE_DAYS: 3,
  /** Days after report date to continue retrying failed jobs */
  PROCESS_WINDOW_AFTER_DAYS: 7,
  /** Days after report date to mark jobs as skipped */
  SKIP_AFTER_DAYS: 10,
  /** Delay between API requests to respect rate limits (ms) */
  RATE_LIMIT_DELAY_MS: 1000,
  /** Batch size for database upserts */
  UPSERT_BATCH_SIZE: 1000,
  /** Concurrent batches for database operations */
  UPSERT_CONCURRENCY: 4,
} as const;

/**
 * Prompt used when generating takeaways from earnings call transcripts.
 */
export const EARNINGS_TAKEAWAY_PROMPT = `
  Focus on articulating the most notable insight that can be drawn about markets, the economy, new technologies, consumer demand or the business environment at large. Only include financial performance of the company to the extent that it supports insights about any of the afore mentioned themes.
  - The takeaway itself should NOT be earnings results or financial performance.
`;

/**
 * Source identifier for earnings call transcripts in the documents table.
 */
export const EARNINGS_TRANSCRIPT_SOURCE = "Public Earnings Transcripts";

/**
 * Model used for generating takeaways from earnings calls.
 */
export const EARNINGS_TAKEAWAY_MODEL = "gpt-5.4";
