import { run } from "@openai/agents";
import { createResearcherAgent } from "~/inngest/insights/agents/researcher";

const objective =  "Find recent takeaways about enterprise AI adoption and productivity gains.";
const context =  "Focus on software vendors, CIO surveys, or case studies from 2024 onward.";

const agent = createResearcherAgent();

const prompt = `Today's date: ${new Date().toDateString()}
Research Objective:
${objective}

Context:
${context}`;

  console.log("Running researcher agent with prompt:", prompt);
  const result = await run(agent, prompt);

  if (!result.finalOutput) {
    throw new Error("No final output returned by researcher agent.");
  }

  const output = result.finalOutput;

  console.log("Researcher agent output:");
  console.log(output);
  process.exit(0);
