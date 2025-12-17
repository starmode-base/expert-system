import { FunctionTool } from "openai/resources/responses/responses.mjs";
import { fetchTakeawayPreviews, fetchTakeawayById } from "./tools";

// ------------------------------------------------------------
// TOOL MAP - Tools that are availible to the executor (executeToolCalls)
// ------------------------------------------------------------
export const toolMap = {
  fetchTakeawayPreviews,
  fetchTakeawayById,
} as const;

// ------------------------------------------------------------
// INSIGHT TOOLS - Tools that are availible to the insight generator agent(generate-insight.ts)
// ------------------------------------------------------------
export const insightTools: FunctionTool[] = [
  {
    type: "function",
    name: "fetchTakeawayPreviews",
    description: `Fetch up to 10 relevant takeaway previews via vector search. Returns a single formatted preview string (title, publication date, source, summary) for each takeaway, separated by '------'. Set timeWeighted=false to disable recency re-ranking.
      - use this tool when you need additional information that is not availible in the initial context.
      - This is like a search query. Use fetchTakeawayById to "click through" to the full takeaway.`,
    strict: true,

    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: {
          type: "string",
          description:
            "Search query describing what you want to find takeaways about",
        },
        timeWeighted: {
          type: "boolean",
          description:
            "Whether to weight results by recency. Defaults to true if omitted",
        },
      },
      required: ["query", "timeWeighted"],
    },
  },
  {
    type: "function",
    name: "fetchTakeawayById",
    description: `Fetch a single takeaway by its id and return it as a formatted string suitable for prompting. Includes title, publication date, source, full takeaway text, takeaway id, and references (with each reference_id).
      - use this tool when you need to do deeper reading into a specific takeaway.
      - This will return the full takeaway with specific facts and references`,
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: {
          type: "string",
          description: "The takeaway id to fetch",
        },
      },
      required: ["id"],
    },
  },
];
