import { invariant } from "@tanstack/react-router";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { db } from "~/postgres/db";

const client = new OpenAI();

/**
 * JSON schema for OpenAI structured output
 */
const schema = z.object({
  categoryName: z.string({
    description: "Select the most relevant category for this text.",
  }),
  categoryId: z.string({
    description:
      "The id of the category. Return only the text of the Id associated with the category",
  }),
});
const responseFormat = zodResponseFormat(schema, "response");

export async function getCategory(text: string) {
  const availableCategories = await db.query.categories.findMany({
    columns: {
      id: true,
      name: true,
    },
  });

  // build category string
  const availableTags = availableCategories
    .map((category) => `Id: ${category.id} - Name: ${category.name}`)
    .join("\n");

  const completion = await client.beta.chat.completions.parse({
    model: "gpt-4o-mini",
    response_format: responseFormat,
    messages: [
      {
        role: "user",
        content: ` Categories:
        ${availableTags}

        Select the relevent category and its id for the following text.
        Select only from the available categories.

        Text:
        ${text}`,
      },
    ],
  });

  invariant(completion.choices[0]?.message.parsed, "No content");

  // validate that the id is in the list of available categories
  const id = completion.choices[0].message.parsed.categoryId;
  const category = availableCategories.find((category) => category.id === id);
  invariant(category, "Invalid id");

  return completion.choices[0].message.parsed;
}
