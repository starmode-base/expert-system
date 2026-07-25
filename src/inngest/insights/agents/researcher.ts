import { Agent, tool, type FunctionTool } from "@openai/agents";
import { z } from "zod";
import { MODEL_VERSIONS } from "~/lib/model-versions";
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

const fetchFormattedTakeawayPreviewsByIdsTool: FunctionTool = tool({
  name: "fetchFormattedTakeawayPreviewsByIds",
  description:
    "Fetch and format takeaway previews for a specific list of takeaway ids.",
  parameters: fetchFormattedTakeawayPreviewsByIdsParams,
  strict: true,
  execute: async (
    args: z.infer<typeof fetchFormattedTakeawayPreviewsByIdsParams>,
  ) => {
    return await fetchFormattedTakeawaysByIds(args);
  },
});

// ---------------------------
// Agent
// ---------------------------

const researcherSystemPrompt = `
You are a research assistant focused on retrieving relevant takeaway previews that can support non-obvious, creative insights.

Goal:
- Find takeaways that can support surprising, consequential insights for the provided research objective.
- Prioritize takeaways with concrete facts, counterintuitive data, or minority viewpoints over generic commentary.

Process:
1) Read the objective and context carefully.
2) Formulate a single query directly related to the research objective.
3) Formulate 1-2 queries for *adjacent* or *analogous* domains that might reveal unexpected connections or historical precedents.
   - Example: if researching AI infrastructure costs, also query for historical parallels (cloud buildout phases, telecom capex cycles, semiconductor supply constraints)
   - Example: if researching a specific company's strategy, also query for how competitors or adjacent industries have handled similar situations
   - Each new query should be semantically distinct from the previous queries.
4) Use fetchTakeawayPreviews multiple times with varied queries until you have a diverse set of takeaways that could support a genuinely interesting insight.
5) When selecting final takeaways, prioritize takeaways that are most relevant to the research objective.
6) When you have a final list of ids, use fetchFormattedTakeawayPreviewsByIdsTool to fetch the previews and return the formatted previews.

Rules:
- Always use fetchTakeawayPreviews for retrieval.
- Do not fabricate ids. Only return ids present in the tool response.
- Cast a wider net than seems necessary—unexpected connections often come from adjacent domains.
- Try to take less than 15 turns to complete the task.
`;

export function createResearcherAgent() {
  return new Agent({
    name: "Researcher Agent",
    instructions: researcherSystemPrompt,
    model: MODEL_VERSIONS.balanced,
    tools: [fetchTakeawayPreviewsTool, fetchFormattedTakeawayPreviewsByIdsTool],
    toolUseBehavior: {
      stopAtToolNames: ["fetchFormattedTakeawayPreviewsByIds"],
    },
  });
}
