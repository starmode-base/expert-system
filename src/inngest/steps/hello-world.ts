import { invariant } from "@tanstack/react-router";
import OpenAI from "openai";

const client = new OpenAI();

export async function makeBedtimeStoryLLM(animal: string) {
  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: `Write a one-sentence bedtime story about a ${animal}.`,
      },
    ],
  });

  invariant(completion.choices[0]?.message.content, "No content");
  return completion.choices[0].message.content;
}
