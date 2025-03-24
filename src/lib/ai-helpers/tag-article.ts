import { invariant } from "@tanstack/react-router";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const client = new OpenAI();

/**
 * JSON schema for OpenAI structured output
 */
const schema = z.object({
  tags: z.array(z.string({ description: "A tag to describe the article." }), {
    description: `A list of tags to describe and classify the article.`,
  }),
});
const responseFormat = zodResponseFormat(schema, "response");

export async function getArticleTags(articleText: string) {
  const availableTags =
    "AI, Machine Learning, Quantum Computing, Space Exploration, Astrophysics, Robotics, Biotech, Medical Technology, Environmental Science, Renewable Energy, Materials Science, Nanotechnology, Neuroscience, Fusion Energy, Genetics, CRISPR, Sustainability, Cybersecurity, Wearable Technology, Wireless Communication, Virtual Reality, Chemical Engineering, Particle Physics, Health Diagnostics, Climate Change, Energy Storage, 3D Printing, Drug Discovery, Human-Computer Interaction, Earthquake Resilience, Nuclear Physics, Food Technology, Behavioral Science, Sign Language Technology, Scientific Imaging, Biomedical Engineering";

  const completion = await client.beta.chat.completions.parse({
    model: "gpt-4o-mini",
    response_format: responseFormat,
    messages: [
      {
        role: "user",
        content: `Select the relevent tags for this article. Only add highly relevant tags.
        Select only from the following list of tags:\n${availableTags}

        Article Text:
        ${articleText}`,
      },
    ],
  });

  invariant(completion.choices[0]?.message.parsed, "No content");

  return completion.choices[0].message.parsed.tags;
}
