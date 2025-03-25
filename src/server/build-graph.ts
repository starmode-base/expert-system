import { invariant } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
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

export interface GraphData {
  nodes: Node[];
  links: Edge[];
}

export const queryTakeawayVectors = createServerFn({
  method: "GET",
}).handler(async () => {
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

  const vectors = takeaways.map((takeaway) => ({
    id: takeaway.id,
    vector: takeaway.embedding,
    label: takeaway.takeaway.document.title,
  }));
  console.log(vectors);
  return vectors;
});

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

function computeZScore(value: number, mean: number, std: number): number {
  return std !== 0 ? value / std : 0;
}

export function buildGraph(
  vectors: { id: string; vector: number[]; label: string }[],
  threshold = 0.3,
): GraphData {
  const nodes: Node[] = vectors.map(({ id, label }) => ({ id, label }));
  const links: Edge[] = [];

  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      invariant(vectors[i]?.vector, "No vectors");
      invariant(vectors[j]?.vector, "No vectors");

      const sim = cosineSimilarity(vectors[i].vector, vectors[j].vector);
      console.log(sim);

      if (sim >= threshold) {
        links.push({
          source: vectors[i].id,
          target: vectors[j].id,
          similarity: sim,
        });
      }
    }
  }

  return { nodes, links };
}

function normalizeGraph(graph: GraphData): GraphData {
  // Extract similarity values to compute the mean and standard deviation
  const { nodes, links: rawEdges } = graph;
  // Normalize each similarity with its z-score
  const links: Edge[] = rawEdges.map((edge) => ({
    ...edge,
    similarity: Math.pow(edge.similarity, 3) * 10,
  }));

  return { nodes, links };
}

export const buildTakewayGraph = createServerFn({
  method: "GET",
}).handler(async () => {
  const vectors = await queryTakeawayVectors();
  const graph = buildGraph(vectors);
  const normalizedGraph = normalizeGraph(graph);
  return normalizedGraph;
});
