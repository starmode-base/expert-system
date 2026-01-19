import { invariant } from "@tanstack/react-router";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod.mjs";
import { z } from "zod";

const client = new OpenAI();

const schema = z.object({
  concept: z.string()
    .describe(`Rewrite the Takeaway as a short, domain-agnostic mechanism description:
	•	Remove all proper nouns, tickers, company names, product names, and field-specific jargon.
	•	Do not mention specific industries (e.g., “biotech,” “social media”) unless absolutely necessary.
	•	Focus on:
	•	Actors (generic roles: “producer,” “intermediary,” “regulator,” “end user,” “agent”)
	•	Resources/Flows (“information,” “capital,” “inventory,” “signals,” “attention,” “fluid,” etc.)
	•	Constraints (“capacity limits,” “latency,” “friction,” “regulation,” “cost”)
	•	Mechanism (what causes what: feedback, diffusion, bottleneck, substitution, coordination, etc.)
	•	Outcome (what changes in the system: growth, failure, delay, saturation, collapse, etc.)
	•	Use 2-3 sentences, concise but precise.
	•	Avoid analogy or metaphor; be literal about the causal structure.`),
});

const responseFormat = zodTextFormat(schema, "response");

export async function getConcept(takeaway: string) {
  const response = await client.responses.parse({
    model: "gpt-5.2",
    input: [
      {
        role: "user",
        content: `
You are an expert systems thinker.
You will be given a single Takeaway summarizing an event, finding, or situation from news, earnings calls, or scientific papers.

        Takeaway:
        ${takeaway}

        Your task is to:
      1.	Abstract the mechanism behind the takeaway into domain-agnostic language.
      `,
        // 2.	Assign dynamic labels describing the underlying system dynamics.
      },
    ],
    text: { format: responseFormat },
  });

  const parsed = response.output_parsed;
  invariant(parsed, "No content");

  return parsed;
}
