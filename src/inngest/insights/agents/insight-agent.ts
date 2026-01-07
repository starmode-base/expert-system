// import { Agent, run, tool, type FunctionTool } from "@openai/agents";
// import { z } from "zod";
// import {
//   buildUserPrompt,
//   insightSchema,
//   systemPrompt,
// } from "../insight-prompts";
// import { fetchTakeawayById } from "../tool-functions/tools-takeaways";
// import { invariant } from "@tanstack/react-router";

// // ---------------------------
// // Tools
// // ---------------------------

// const fetchTakeawayByIdParams = z.object({
//   id: z.string().describe("The takeaway id to fetch"),
// });

// const fetchTakeawayByIdTool: FunctionTool<
//   unknown,
//   typeof fetchTakeawayByIdParams,
//   Awaited<ReturnType<typeof fetchTakeawayById>>
// > = tool({
//   name: "fetchTakeawayById",
//   description: `Fetch a single takeaway by its id and return it as a formatted string suitable for prompting. Includes title, publication date, source, full takeaway text, takeaway id, and references (with each reference_id).
//       - use this tool when you need to do deeper reading into a specific takeaway.
//       - This will return the full takeaway with specific facts and references`,
//   parameters: fetchTakeawayByIdParams,
//   strict: true,
//   execute: async (args: z.infer<typeof fetchTakeawayByIdParams>) => {
//     return await fetchTakeawayById(args);
//   },
// });

// // ---------------------------
// // Agent
// // ---------------------------

// function createInsightAgent() {
//   return new Agent({
//     name: "Insight Generator",
//     instructions: systemPrompt,
//     model: "gpt-5.2",
//     tools: [fetchTakeawayByIdTool],
//     outputType: insightSchema,
//   });
// }

// // ---------------------------
// // Run Agent
// // ---------------------------

export interface InsightAgentInput {
  takeawayPreviewFormatted: string;
  takeawayConceptsPreviewFormatted: string;
  recentInsights: string;
  insightPrompt: string;
}

// export type InsightStructuredOutput = z.infer<typeof insightSchema>;

// export async function runInsightAgent(
//   input: InsightAgentInput,
// ): Promise<InsightStructuredOutput> {
//   const agent = createInsightAgent();
//   const result = await run(agent, buildUserPrompt(input));

//   invariant(result.finalOutput, "No final output");

//   // Guard against errors
//   if (result.finalOutput instanceof Error) {
//     throw result.finalOutput;
//   }

//   const parsed = insightSchema.safeParse(result.finalOutput);
//   if (!parsed.success) {
//     throw new Error(`Invalid insight output: ${parsed.error.message}`);
//   }

//   return parsed.data;
// }
