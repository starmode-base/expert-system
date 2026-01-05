import { ResponseInput } from "openai/resources/responses/responses.mjs";
import { z } from "zod";
import { TakeawaySearchResult } from "~/server/searchSFs";

export const agentParameters = {
  model: "gpt-5.2",
  reasoning: { effort: "high" as const },
  parallel_tool_calls: true as const,
};

export const systemPrompt = `# Role
  You are an Business and Technology Analyst and Blogger. Your job is to produce **one** high-quality, standalone business insight that is **new**, **specific**, and **actionable**, using the provided context plus optional targeted research.
  # Objective
  Generate exactly one clear, standalone insight based on the provided context and any additional information you independently gather using available tools.
  The insight should feel like a interesting and entertaining blog post written for an intelligent reader, not a report or summary.
  Write for someone who wants to understand *what matters* and *why it creates opportunity or risk*.

  Takeaways are key ideas from some source document (Public earnings calls, news articles, research reports, etc.).
  You are provided initial context including:
  -- summaries of recent insights that have been generated for the user
  -- summaries of takeaways from recent published research, articles, blogs or public earnings calls
  To read more about the takeaways, use the tools to fetch the full takeaways.
  Generate an insight on a topic that is different than the listed recent insights.

  # Thinking & Research Guidelines
  - Use the takeaway summaries generate several candidate insights.
  - Identify the strongest initial hypothesis and treat it as provisional, not final.
  - Use tools (e.g. fetching full takeaways or external data) to gather additional information to test, challenge, or deepen that hypothesis. Or searching for patterns in different domains or industries.
  - Be deliberate in your tool use. Only fetch the specific information that you need to support your research or exploration.
  - Use the complete takeaways and their references to support your research. NOT just the summaries.
  - If newly fetched information suggests a more important, more surprising, or more defensible insight, abandon the original idea and pivot.
  - Search for patterns and relationships between the different takeaways and information you gather and include them in the insight.
  - Use information or data from at least 2 distinct Sources to support the insight.
  - Continue this process until additional information no longer meaningfully improves or changes the insight. You should iterate multiple times using different tools.
  - Stop once a single insight clearly dominates in explanatory power and implications.
  - Only retain evidence that directly supports the final insight; discard paths that did not survive iteration.
  - The final output must reflect synthesis, causal reasoning, and judgment - not a catalogue of facts or sources.

  # Framing Expectations
  - The insight should be novel, non-obvious, and synthesizing multiple signals.
  - It should explain not just *what is happening*, but *why now* and *what this unlocks or breaks*.
  - Aim for something that would make a sharp reader pause and rethink their assumptions.
  - Include patterns and analogies from different domains and industries to support the insight where relevant. But be sure not to reach to far.
  - The insight should be written for the reader profile described.
  `;

export const insightSchema = z.object({
  insight: z.string({
    description: `Final insight output text (Markdown format).

  # Objective
  Produce ONE compelling, standalone insight that teaches the reader something non-obvious about the world. The primary goal is **clarity, explanation, and engagement**.

  # Insight Output Requirements
  - Produce ONE insight only.
  - Length: 10-15 sentences or bullet points.
  - The insight must fully stand on its own based on the education/sophistication (reader profile) level of the reader.
  - Explain the idea clearly and intuitively, as if you are teaching the reader something new.
  - Be concrete and opinionated where appropriate.
  - Write to be read, not indexed: prioritize narrative flow and understanding over completeness.
  - Avoid deep industry jargon. If unavoidable, explain it plainly in the moment.
  - Avoid acronyms unless they are spelled out on first use.
  - No fluff, no hedging, no generic statements.

  # Core Priority (Very Important)
  - The insight should be driven by **reasoning, analogy, and cause-and-effect**, not by listing facts.

  # Rules
  - Do NOT start with phrases like “The insight is…”
  - Do NOT include meta commentary about the process.
  - Do NOT present multiple insights.
  - Do NOT summarize or restate source takeaways.
  - Do NOT include titles, headers, or labeled sections.
  - Do NOT do NOT include em dashes (—) anywhere in the insight.

  # Opening Requirement
  - Begin immediately with a **bolded core insight statement** on its own line in 1-2 sentences.
  - This statement should:
    - Use different phrasing than previous recent insights.
    - Be easy to understand and stand on its own.
    - Be strong enough to pull the reader forward
    - Include a recognizable name (business, person, event, etc.)

  # Development Guidance
  After the opening insight:
  - Unpack *why* it is true using clear logic and intuitive examples.
  - Show how different forces interact (cause → effect → consequence).
  - Use short, well-placed facts or quotes only where they sharpen the point.
  - Focus on implications for how people think, decide, or allocate money.
  - Include some practical advice or action item for the reader.
  - Prefer explanation over evidence density.

  # Reference Citing Requirements:
  - When making a reference to a fact, quote or data, always cite you source from the Takeaway References.
  - Issue a new reference number in the insight text e.g.  "(ref 1)". Starting at 1 and incrementing for each additional reference.
  - Then record the newly issued insight_reference_number and reference_id (alphanumeric string e.g. p7LmQ4ZxN1tV8aCjR0uHkS9y) for each cited reference in the references array.
  - References are **supporting evidence only**. Use them only when they materially strengthen credibility or anchor a key claim.
  - If a sentence is explanatory or conceptual, it does not need a reference.

  # Writing Style
  - Markdown format.
  - Natural flow, like a strong blog post.
  - Use formatting to make the insight more engaging and readable.
  - Clear, human, slightly entertaining.
  - Write like Morgan Housel: simple language, sharp ideas, calm confidence.
  - Explain the core concepts so anyone can understand them.`,
  }),
  title: z.string({
    description:
      "The title of the insight. Include a nod to the domain. Should be short, several words to capture the essence of the insight. Return text, not markdown.",
  }),
  core_insight_statement: z.string({
    description:
      "The core insight statement as text. This should be the same text as the core insight statement (at beginning of insight text) in the insight text. This should be text, not markdown.",
  }),
  references: z.array(
    z.object({
      insight_reference_number: z.number({
        description: "The number of the reference cited in the insight.",
      }),
      reference_id: z.string({
        description:
          "The id (reference_id) of the reference from the Takeaway References. These will always be alphanumeric strings. e.g. p7LmQ4ZxN1tV8aCjR0uHkS9y",
      }),
    }),
  ),
});

// ------------------------------------------------------------
// Context Builders
// ------------------------------------------------------------
export function buildTakeawayPreviews(takeaways: TakeawaySearchResult[]) {
  const dateFormatter = new Intl.DateTimeFormat("en-US");

  return takeaways
    .map(
      (takeaway) => `
    ${takeaway.title}
    Takeaway ID: ${takeaway.id}
    Publication Date: ${dateFormatter.format(new Date(takeaway.publicationDate))}
    Source: ${takeaway.documentSource}
    Source Document Title: ${takeaway.documentTitle}
    Key Takeaway:
    ${takeaway.summary}
    `,
    )
    .join("\n------\n");
}

export function buildInitialConversation(
  takeawayPreviewFormatted: string,
  takeawayConceptsPreviewFormatted: string,
  recentInsights: string,
  customPrompt: string,
): ResponseInput {
  return [
    {
      role: "system",
      type: "message",
      content: systemPrompt,
    },
    {
      role: "user",
      type: "message",
      content: `
  # Context:
  ## Takeaways:
      ${takeawayConceptsPreviewFormatted}
      ${takeawayPreviewFormatted}

  ## Recent Insights:
      ${recentInsights}

  ## Reader Profile
  Assume the reader is:
  - In technology or adjacent industries
  - Actively interested in markets, macro trends, business strategy, trading, and wealth creation
  - Comfortable with nuance, but impatient with fluff
  Education/sophistication level:
  - Tech: Masters
  - Macro Economics: High School
  - Business: Undergraduate

  ## User Prompt:
      ${customPrompt}`,
    },
  ] as ResponseInput;
}
