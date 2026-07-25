import { invariant } from "@tanstack/react-router";
import OpenAI from "openai";
import { MODEL_VERSIONS } from "~/lib/model-versions";
const openai = new OpenAI();

export async function generateEmbedding(text: string) {
  const input = text.replaceAll("\n", " ");

  const { data } = await openai.embeddings.create({
    model: MODEL_VERSIONS.embedding,
    input,
  });
  invariant(data[0]?.embedding, "No embedding");

  return data[0].embedding;
}
