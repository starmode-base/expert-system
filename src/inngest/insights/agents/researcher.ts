import { Agent, tool, type FunctionTool } from "@openai/agents";
import { z } from "zod";
import {
  fetchTakeawayPreviews,
    fetchFormattedTakeawaysByIds,
} from "../tool-functions/tools-takeaways";

// ---------------------------
// Tools
// ---------------------------

const fetchTakeawayPreviewsParams = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      "Semantic search query used to retrieve relevant takeaway previews.",
    ),
  count: z
    .number()
    .int()
    .min(1)
    .max(20)
    .describe("Number of takeaway previews to return (default 5)"),
});

const fetchTakeawayPreviewsTool: FunctionTool<
  unknown,
  typeof fetchTakeawayPreviewsParams,
  Awaited<ReturnType<typeof fetchTakeawayPreviews>>
> = tool({
  name: "fetchTakeawayPreviews",
  description: `Fetch relevant takeaway previews by query. Each preview includes a Takeaway ID.
    This tool uses vector embeddings to retrieve relevant document takeaways based on their semantic similarity to the query.
    Formulate your queries accurately to ensure relevant results are returned.`,
  parameters: fetchTakeawayPreviewsParams,
  strict: true,
  execute: async (args: z.infer<typeof fetchTakeawayPreviewsParams>) => {
    return await fetchTakeawayPreviews(args);
  },
});

const fetchFormattedTakeawayPreviewsByIdsParams = z.object({
  ids: z
    .array(z.string().min(1))
    .min(1)
    .describe("Takeaway ids to fetch previews for"),
});

const fetchFormattedTakeawayPreviewsByIdsTool: FunctionTool= tool({
  name: "fetchFormattedTakeawayPreviewsByIds",
  description:
    "Fetch and format takeaway previews for a specific list of takeaway ids.",
  parameters: fetchFormattedTakeawayPreviewsByIdsParams,
  strict: true,
  execute: async (args: z.infer<typeof fetchFormattedTakeawayPreviewsByIdsParams>) => {
    return await fetchFormattedTakeawaysByIds(args);
  },
});

// ---------------------------
// Agent
// ---------------------------

const researcherSystemPrompt = `
You are a research assistant focused on retrieving relevant takeaway previews.

Goal:
- Find the most relevant takeaways for the provided research objective and context.

Process:
1) Read the objective and context carefully.
2) Formulate a few distinct concise search queries to use in fetchTakeawayPreviews that fully captures the research objective. These queries should be semantiacally distinct so as to fetch different takeaways.
3) Use fetchTakeawayPreviews multiple times with new queries if until you feel that you have the information needed to support the research objective.
4) When you have a final list of ids, use fetchFormattedTakeawayPreviewsByIdsTool to fetch the previews and return the formatted previews.

Rules:
- Always use fetchTakeawayPreviews for retrieval.
- Do not fabricate ids. Only return ids present in the tool response.
`;

export function createResearcherAgent() {
  return new Agent({
    name: "Researcher Agent",
    instructions: researcherSystemPrompt,
    model: "gpt-5.2",
    tools: [fetchTakeawayPreviewsTool, fetchFormattedTakeawayPreviewsByIdsTool],
    toolUseBehavior:  { stopAtToolNames: ["fetchFormattedTakeawayPreviewsByIdsTool"]  } ,
  });
}
