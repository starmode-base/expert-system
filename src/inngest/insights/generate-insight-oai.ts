import { Agent, run, tool, type FunctionTool } from "@openai/agents";
import { z } from "zod";

import { insightSchema, systemPrompt } from "./insight-prompts";
import { fetchTakeawayById } from "./tools/tools";
import { invariant } from "@tanstack/react-router";

const fetchTakeawayByIdParams = z.object({
  id: z.string().describe("The takeaway id to fetch"),
});

const fetchTakeawayByIdTool: FunctionTool<
  unknown,
  typeof fetchTakeawayByIdParams,
  Awaited<ReturnType<typeof fetchTakeawayById>>
> = tool({
  name: "fetchTakeawayById",
  description:
    "Fetch a single takeaway by id and return it as a formatted string with title, publication date, source, full takeaway text, id, and references.",
  parameters: fetchTakeawayByIdParams,
  strict: true,
  execute: async (args: z.infer<typeof fetchTakeawayByIdParams>) => {
    return await fetchTakeawayById(args);
  },
});

export interface InsightAgentInput {
  takeawayPreviewFormatted: string;
  takeawayConceptsPreviewFormatted: string;
  recentInsights: string;
  insightPrompt: string;
}

export type InsightStructuredOutput = z.infer<typeof insightSchema>;

function buildUserPrompt(input: InsightAgentInput) {
  return `
# Context
## Takeaways
${input.takeawayConceptsPreviewFormatted}
${input.takeawayPreviewFormatted}

## Recent Insights
${input.recentInsights}

## Reader Profile
- In technology or adjacent industries
- Actively interested in markets, macro trends, business strategy, trading, and wealth creation
- Comfortable with nuance, but impatient with fluff
Education/sophistication level:
- Tech: Masters
- Macro Economics: High School
- Business: Undergraduate

## User Prompt
${input.insightPrompt}

# Output format
Return only a JSON object with:
- insight: string
- title: string
- core_insight_statement: string
- references: array of { insight_reference_number: number, reference_id: string }
Do not include markdown fences or any prose outside the JSON.`;
}

function createInsightAgent() {
  return new Agent({
    name: "Insight Generator",
    instructions: systemPrompt,
    model: "gpt-5.2",
    tools: [fetchTakeawayByIdTool],
    outputType: insightSchema,
  });
}

export async function runInsightAgent(
  input: InsightAgentInput,
): Promise<InsightStructuredOutput> {
  const agent = createInsightAgent();
  const result = await run(agent, buildUserPrompt(input));

  invariant(result.finalOutput, "No final output");

  // Guard against errors
  if (result.finalOutput instanceof Error) {
    throw result.finalOutput;
  }

  const parsed = insightSchema.safeParse(result.finalOutput);
  if (!parsed.success) {
    throw new Error(`Invalid insight output: ${parsed.error.message}`);
  }

  return parsed.data;
}
