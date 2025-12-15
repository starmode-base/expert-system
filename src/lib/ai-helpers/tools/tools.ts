import { vectorTakeawaySearch } from "~/server/vector-queries";
import type { FunctionTool } from "openai/resources/responses/responses";

function computeRecencyWeight(
  publicationDate: Date | string,
  now = new Date(),
) {
  const publishedAt =
    publicationDate instanceof Date
      ? publicationDate
      : new Date(publicationDate);

  const publishedAtMs = publishedAt.getTime();
  if (Number.isNaN(publishedAtMs)) {
    return 1;
  }

  const ageMs = Math.max(0, now.getTime() - publishedAtMs);
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  // S-curve that declines over ~3 months
  const threeMonthsDays = 90;
  const midpointDays = threeMonthsDays / 2;
  const k = Math.log(99) / midpointDays;

  const weight = 1 / (1 + Math.exp(k * (ageDays - midpointDays)));
  return Math.max(0, Math.min(1, weight));
}

export interface FetchTakeawaysArgs {
  query: string;
  timeWeighted?: boolean;
}

export async function fetchTakeaways(args: FetchTakeawaysArgs) {
  const takeaways = await vectorTakeawaySearch(args.query, 10);

  if (args.timeWeighted === false) {
    return takeaways;
  }

  const now = new Date();
  const weightedTakeaways = takeaways
    .map((takeaway) => {
      const recencyWeight = computeRecencyWeight(takeaway.publicationDate, now);
      const weightedSimilarity = takeaway.similarity * recencyWeight;

      return {
        ...takeaway,
        similarity: weightedSimilarity,
        unweightedSimilarity: takeaway.similarity,
        recencyWeight,
      };
    })
    .sort((a, b) => b.similarity - a.similarity);

  return weightedTakeaways;
}

export const toolMap = {
  fetchTakeaways,
} as const;

export const insightTools: FunctionTool[] = [
  {
    type: "function",
    name: "fetchTakeaways",
    description: "Fetch additional relevant takeaways using vector search",
    strict: false,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: {
          type: "string",
          description: "Search query describing what to fetch takeaways about",
        },
        timeWeighted: {
          type: "boolean",
          description:
            "Whether to weight results by recency. Defaults to true if omitted",
        },
      },
      required: ["query"],
    },
  },
];
