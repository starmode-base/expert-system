import { invariant } from "@tanstack/react-router";
import { db } from "~/postgres/db";

interface Node {
  id: string;
  label: string;
}

interface Edge {
  source: string;
  target: string;
  similarity: number;
}

export async function queryTakeawayVectors() {
  const takeaways = await db.query.takeawayEmbeddings.findMany({
    with: {
      takeaway: {
        with: {
          document: true,
        },
      },
    },
  });
  invariant(takeaways, "No takeaways");

  return takeaways.map((takeaway) => ({
    id: takeaway.id,
    vector: takeaway.embedding,
    label: takeaway.takeaway.document.title,
  }));
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

export function buildGraph(
  vectors: { id: string; vector: number[]; label: string }[],
  threshold = 0.85,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = vectors.map(({ id, label }) => ({ id, label }));
  const edges: Edge[] = [];

  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      invariant(vectors[i]?.vector, "No vectors");
      invariant(vectors[j]?.vector, "No vectors");

      const sim = cosineSimilarity(vectors[i].vector, vectors[j].vector);
      if (sim >= threshold) {
        edges.push({
          source: vectors[i].id,
          target: vectors[j].id,
          similarity: sim,
        });
      }
    }
  }

  return { nodes, edges };
}

export async function buildTakewayGraph() {
  const vectors = await queryTakeawayVectors();
  return buildGraph(vectors);
}
