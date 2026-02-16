/** Central registry of OpenAI models used across the system. */
export const models = {
  /** High-capability reasoning model — takeaway extraction, insight generation, agents */
  reasoning: "gpt-5.2",
  /** Mid-tier model — summaries, categorization, researcher agents */
  standard: "gpt-5-mini",
  /** Lightweight model — document summarization, HTML extraction */
  lightweight: "gpt-5-nano",
  /** Insight summary generation */
  insightSummary: "gpt-4.1",
  /** Takeaway title generation */
  takeawayTitles: "gpt-4o-mini",
  /** Embedding model for vector search */
  embedding: "text-embedding-3-small",
} as const;
