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
export const EARNINGS_TRANSCRIPT_SOURCE = "Earnings Call Transcripts";

export const EARNINGS_SYNC_PROVIDER = "earningscalls.dev";
