import { invariant } from "@tanstack/react-router";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod.mjs";
import { z } from "zod";

const client = new OpenAI();

const schema = z.object({
  concept: z.string({
    description: `Rewrite the Takeaway as a short, domain-agnostic mechanism description:
	•	Remove all proper nouns, tickers, company names, product names, and field-specific jargon.
	•	Do not mention specific industries (e.g., “biotech,” “social media”) unless absolutely necessary.
	•	Focus on:
	•	Actors (generic roles: “producer,” “intermediary,” “regulator,” “end user,” “agent”)
	•	Resources/Flows (“information,” “capital,” “inventory,” “signals,” “attention,” “fluid,” etc.)
	•	Constraints (“capacity limits,” “latency,” “friction,” “regulation,” “cost”)
	•	Mechanism (what causes what: feedback, diffusion, bottleneck, substitution, coordination, etc.)
	•	Outcome (what changes in the system: growth, failure, delay, saturation, collapse, etc.)
	•	Use 2–4 sentences, concise but precise.
	•	Avoid analogy or metaphor; be literal about the causal structure.`,
  }),
});

const responseFormat = zodResponseFormat(schema, "response");

export async function getConcept(takeaway: string) {
  const completion = await client.beta.chat.completions.parse({
    model: "gpt-5.1",
    response_format: responseFormat,
    messages: [
      {
        role: "user",
        content: `
You are an expert systems thinker.
You will be given a single Takeaway summarizing an event, finding, or situation from news, earnings calls, or scientific papers.

        Takeaway:
        ${takeaway}

        Your task is to:
      1.	Abstract the mechanism behind the takeaway into domain-agnostic language.
      2.	Assign dynamic labels describing the underlying system dynamics.`,
      },
    ],
  });

  invariant(completion.choices[0]?.message.parsed, "No content");

  return completion.choices[0].message.parsed;
}
