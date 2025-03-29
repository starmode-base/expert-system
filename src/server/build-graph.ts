import { invariant } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "~/postgres/db";

interface Vector {
  id: string;
  documentId: string;
  vector: number[];
  label: string;
  category: string;
  source: string;
}
export interface Node {
  id: string;
  documentId: string;
  label: string;
  category: string;
  source: string;
}

export interface Edge {
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
          category: true,
        },
      },
    },
  });
  invariant(takeaways, "No takeaways");

  const vectors = takeaways.map((takeaway) => ({
    id: takeaway.takeaway.id,
    documentId: takeaway.takeaway.document.id,
    vector: takeaway.embedding,
    label: takeaway.takeaway.document.title,
    category: takeaway.takeaway.category?.name ?? "None",
    source: takeaway.takeaway.document.source,
  }));

  return vectors;
});

export const queryConceptVectors = createServerFn({
  method: "GET",
}).handler(async () => {
  const takeaways = await db.query.conceptEmbeddings.findMany({
    with: {
      takeaway: {
        with: {
          document: true,
          category: true,
        },
      },
    },
  });
  invariant(takeaways, "No takeaways");

  const vectors = takeaways.map((takeaway) => ({
    id: takeaway.takeaway.id,
    vector: takeaway.embedding,
    documentId: takeaway.takeaway.document.id,
    label: takeaway.takeaway.document.title,
    category: takeaway.takeaway.category?.name ?? "None",
    source: takeaway.takeaway.document.source,
  }));

  return vectors;
});

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("Both vectors must have the same length");
  }
  // (vecB[i] ?? 0) is for typing. vecB[i]
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * (vecB[i] ?? 0), 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

export function buildGraph(vectors: Vector[], threshold = 0.35): GraphData {
  const nodes: Node[] = vectors.map(
    ({ id, documentId, label, category, source }) => ({
      id,
      documentId,
      label,
      category,
      source,
    }),
  );
  const links: Edge[] = [];

  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const vector_i = vectors[i];
      const vector_j = vectors[j];
      invariant(vector_i, "No vectors");
      invariant(vector_j, "No vectors");

      // Skip self-loops
      if (vector_i.id === vector_j.id) {
        continue;
      }

      const sim = cosineSimilarity(vector_i.vector, vector_j.vector);

      if (sim >= threshold) {
        links.push({
          source: vector_i.id,
          target: vector_j.id,
          similarity: sim,
        });
      }
    }
  }

  return { nodes, links };
}

function amplifyGraph(graph: GraphData): GraphData {
  // Extract similarity values to compute the mean and standard deviation
  const { nodes, links: rawEdges } = graph;
  // amplify similarity
  const links = rawEdges.map((edge) => ({
    ...edge,
    similarity: Math.pow(edge.similarity, 3) * 10,
  }));

  return { nodes, links };
}

export async function buildTakewayGraph() {
  const vectors = await queryTakeawayVectors();
  const graph = buildGraph(vectors, 0);
  const normalizedGraph = amplifyGraph(graph);
  return normalizedGraph;
}

export async function buildConceptGraph() {
  const vectors = await queryConceptVectors();
  const graph = buildGraph(vectors, 0);
  const normalizedGraph = amplifyGraph(graph);
  return normalizedGraph;
}

export const loadGraphData = createServerFn({
  method: "GET",
})
  .validator(z.string())
  .handler(async ({ data: graphType }) => {
    if (graphType === "topic") {
      return await buildTakewayGraph();
    } else if (graphType === "concept") {
      return await buildConceptGraph();
    }

    return null;
  });
