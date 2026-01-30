import { Agent, run, tool, type FunctionTool } from "@openai/agents";
import { z } from "zod";
import {
  buildUserPrompt,
  insightSchema,
  systemPrompt,
} from "../insight-prompts";
import { fetchTakeawayById } from "../tool-functions/tools-takeaways";
import { invariant } from "@tanstack/react-router";
import { createFinancialAnalysisAgent } from "./financial-analyst";
import { createResearcherAgent } from "./researcher";

// ---------------------------
// Tools
// ---------------------------

const fetchTakeawayByIdParams = z.object({
  id: z.string().describe("The takeaway id to fetch"),
});

const fetchTakeawayByIdTool: FunctionTool<
  unknown,
  typeof fetchTakeawayByIdParams,
  Awaited<ReturnType<typeof fetchTakeawayById>>
> = tool({
  name: "fetchTakeawayById",
  description: `Fetch a single takeaway by its id and return it as a formatted string. Includes title, publication date, source, full takeaway text, takeaway id, and references (with each reference_id).
      - use this tool when you need to do deeper reading into a specific takeaway.
      - This will return the full takeaway with specific facts and references`,
  parameters: fetchTakeawayByIdParams,
  strict: true,
  execute: async (args: z.infer<typeof fetchTakeawayByIdParams>) => {
    return await fetchTakeawayById(args);
  },
});

const finacialAnalyst = createFinancialAnalysisAgent();

const financialAnalystTool = finacialAnalyst.asTool({
  toolName: "financialAnalyst",
  toolDescription: `This tool provides autonomous financial analysis and data retrieval for public companies and macro context.

Capabilities:
- Query standardized company fundamentals, including overview data, valuation ratios, profitability, growth, and analyst sentiment.
- Retrieve full financial statements (income statement, balance sheet, cash flow) across historical periods.
- Analyze cash generation, capital structure, leverage, and shareholder returns.
- Access U.S. Treasury yield curve data across short- and long-duration maturities.
- Perform comparative analysis, trend analysis, and high-level financial reasoning based on retrieved data.
- Do not iterate on the same financial analysis for the same objective. Only use this tool once unless you need a new and distict analysis.

Usage:
Use this tool whenever financial data, company fundamentals, macro rate context, or investment-oriented analysis will add value to the insight.

Provide the following sructured information to the financialAnalyst:

  Today's date:
  Objective:
  Request:
  Scope: (tickers / macro series / other)
  Timeframe: (quarters/years; as-of date)
  Constraints: (no speculation, cite numbers, handle missing data)`,
});

const researcher = createResearcherAgent();
const researcherTool = researcher.asTool({
  toolName: "researcher",
  toolDescription: `This tool provides autonomous research and data retrieval for tech and business news, poducasts, fed reserve speeches, articles, blog posts, and public companies and macro context from a large corpus of documents.

Capabilities:
- Retrieves a new list of takeaways based on the query.

Usage:
- Use this tool whenever you need to find more supporting information (takeaways) for the research objective.

Provide the following sructured information to the researcher:

  Today's date:
  Research Objective:
  Context:
`,
});

// ---------------------------
// Agent
// ---------------------------

function createInsightAgent() {
  return new Agent({
    name: "Insight Generator",
    instructions: systemPrompt,
    model: "gpt-5.2",
    tools: [financialAnalystTool, researcherTool, fetchTakeawayByIdTool],
    outputType: insightSchema,
    modelSettings: {
      parallelToolCalls: false,
      reasoning: { effort: "high" },
    },
  });
}

// ---------------------------
// Run Agent
// ---------------------------

export interface InsightAgentInput {
  takeawayPreviewFormatted: string;
  recentInsights: string;
  insightPrompt?: string;
}

export type InsightStructuredOutput = z.infer<typeof insightSchema>;

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
