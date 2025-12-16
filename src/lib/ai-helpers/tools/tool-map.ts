import { FunctionTool } from "openai/resources/responses/responses.mjs";
import { fetchTakeaways, fetchTakeawayById } from "./tools";

export const toolMap = {
  fetchTakeaways,
  fetchTakeawayById,
} as const;

export const insightTools: FunctionTool[] = [
  // {
  //   type: "function",
  //   name: "fetchTakeaways",
  //   description:
  //     "Fetch additional relevant takeaways using vector search. Use this tool to additional information (takeaways) that are relevant to the current conversation.",
  //   strict: true,

  //   parameters: {
  //     type: "object",
  //     additionalProperties: false,
  //     properties: {
  //       query: {
  //         type: "string",
  //         description: "Search query describing what to fetch takeaways about",
  //       },
  //       timeWeighted: {
  //         type: "boolean",
  //         description:
  //           "Whether to weight results by recency. Defaults to true if omitted",
  //       },
  //     },
  //     required: ["query", "timeWeighted"],
  //   },
  // },
  {
    type: "function",
    name: "fetchTakeawayById",
    description:
      "Fetch a single takeaway by its id. Use this tool when you have a takeaway id and need the full details (title, text, summary, concept, source, references).",
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
