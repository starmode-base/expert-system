import { invariant } from "@tanstack/react-router";
import OpenAI from "openai";
const openai = new OpenAI();

export async function generateEmbedding(text: string) {
  const input = text.replaceAll("\n", " ");

  const { data } = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input,
  });
  invariant(data[0]?.embedding, "No embedding");

  return data[0].embedding;
}
