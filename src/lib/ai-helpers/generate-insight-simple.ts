import OpenAI from "openai";

const client = new OpenAI();

interface Takeaway {
  id: string;
  source: string;
  title: string;
  publicationDate: string;
  takeaway: string;
  documentText: string;
}

export async function getInsightSimple(
  takeaways: Takeaway[],
  customPrompt: string,
) {
  const response = await client.responses.create({
    model: "o3-mini",
    input: [
      {
        role: "system",
        content:
          "You are an expert researcher. Your job is to create meaningful insights from a set of summarized research takeaways.",
      },
      {
        role: "user",
        content: `
Context:
        ${takeaways
          .map(
            (takeaway) => `${takeaway.title}
Publication Date: ${takeaway.publicationDate}
Source: ${takeaway.source}
Key Takeaway:
          ${takeaway.takeaway}`,
          )
          .join("\n------\n")}

Instructions
    - The insight should be very detailed and complete. It should be a fully formed, stand alone thought. Use at least 10 sentences to articulate the insight.
    - Think very carfully about the context provided. Look for patterns and relationships between the takeaways.
    - The Insight should be novel and insightful
    - Be concise but thorough. No fluff.
    - Be imaginative about the high level implications of the insight.
    - Do NOT start with "The insight is"... or other such fluff.
    ${customPrompt}`,
      },
    ],
  });

  console.log(response);

  return "";
}
