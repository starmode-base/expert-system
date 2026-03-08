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
import { createMacroResearcherAgent } from "./macro-researcher";
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
  toolDescription: `This tool provides autonomous financial analysis and data retrieval for public companies.

Capabilities:
- Query standardized company fundamentals, including overview data, valuation ratios, profitability, growth, and analyst sentiment.
- Retrieve full financial statements (income statement, balance sheet, cash flow) across historical periods.
- Analyze cash generation, capital structure, leverage, and shareholder returns.
- Perform comparative analysis, trend analysis, and high-level financial reasoning based on retrieved data.
- Do not iterate on the same financial analysis for the same objective. Only use this tool once unless you need a new and distinct analysis.

Note: For macroeconomic data (GDP, inflation, rates, yield curves, credit spreads, etc.) use macroResearcher instead.

Usage:
Use this tool whenever company-specific financial data, fundamentals, or investment-oriented analysis will add value to the insight.

Provide the following structured information to the financialAnalyst:

  Today's date:
  Objective:
  Request:
  Scope: (tickers)
  Timeframe: (quarters/years; as-of date)
  Constraints: (no speculation, cite numbers, handle missing data)`,
  runOptions: { maxTurns: 40 },
});

const macroResearcher = createMacroResearcherAgent();

const macroResearcherTool = macroResearcher.asTool({
  toolName: "macroResearcher",
  toolDescription: `This tool provides autonomous macroeconomic research and data retrieval using FRED (Federal Reserve Economic Data).

Capabilities:
- Growth & output: Real GDP, industrial production, capacity utilization, real consumption, business investment.
- Labor market: Unemployment, participation, employment-population ratio, payrolls, jobless claims, job openings, quits rate.
- Inflation & prices: CPI, core CPI, PCE, core PCE, trimmed mean PCE (Dallas Fed), median CPI (Cleveland Fed).
- Wages & income: Average hourly earnings, employment cost index, real disposable income.
- Monetary policy & liquidity: Fed funds rate, IORB, Fed balance sheet, bank reserves, reverse repo, M2.
- Rates & yield curve: 2Y and 10Y Treasury yields, 10Y-2Y spread, term premium, breakeven inflation.
- Credit & financial stress: Baa corporate spread, high yield OAS, Senior Loan Officer Survey, Chicago Fed NFCI, bank credit.
- Housing: Starts, permits, existing home sales, Case-Shiller home prices, 30-year mortgage rate.
- Sentiment: University of Michigan consumer sentiment.
- Fetch latest observations or data within specific date ranges.
- Request data transformations (percent change, year-over-year change, etc.).
- Compare multiple macro indicators side-by-side.
- Analyze trends, inflection points, divergences, and policy implications.
- Do not iterate on the same macro analysis for the same objective. Only use this tool once unless you need a new and distinct analysis.

Usage:
Use this tool whenever macroeconomic data, business cycle context, monetary policy analysis, or broad economic trends will add value to the insight.

Provide the following structured information to the macroResearcher:

  Today's date:
  Objective:
  Request:
  Scope: (indicators / time range / other)
  Timeframe: (months/quarters/years; as-of date)
  Constraints: (no speculation, cite numbers, handle missing data)`,
  runOptions: { maxTurns: 40 },
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
  runOptions: { maxTurns: 40 },
});

// ---------------------------
// Agent
// ---------------------------

function createInsightAgent() {
  return new Agent({
    name: "Insight Generator",
    instructions: systemPrompt,
    model: "gpt-5.4",
    tools: [
      financialAnalystTool,
      macroResearcherTool,
      researcherTool,
      fetchTakeawayByIdTool,
    ],
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
  seedText: string;
  insightPrompt?: string;
}

export type InsightStructuredOutput = z.infer<typeof insightSchema>;

export async function runInsightAgent(
  input: InsightAgentInput,
): Promise<InsightStructuredOutput> {
  const agent = createInsightAgent();
  const result = await run(agent, buildUserPrompt(input), { maxTurns: 40 });

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
