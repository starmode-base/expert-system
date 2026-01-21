import { asc, cosineDistance, sql } from "drizzle-orm";
import { cosineSimilarity } from "~/lib/vector-similarity";
import { db, schema } from "~/postgres/db";
import { generateEmbedding } from "~/postgres/generate-embedding";
import type { TakeawaySearchResult } from "./searchSFs";

// ------------------------------------------------------------
// Helper functions
// ------------------------------------------------------------

/**
 * Compute a recency weight (0..1) to down-rank older content
 *
 * The curve is an S-shape that declines over ~3 months and clamps to [0, 1].
 * If the publication date is invalid, returns 1 to avoid accidental suppression.
 */
function computeRecencyWeight(
  publicationDate: Date,
  now = new Date(),
  halfLifeDays = 90,
) {
  const publishedAtMs = publicationDate.getTime();
  if (Number.isNaN(publishedAtMs)) {
    return 1;
  }

  const ageMs = Math.max(0, now.getTime() - publishedAtMs);
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  // S-curve that declines over ~3 months

  const k = Math.log(9) / halfLifeDays;

  const floor = 0.1;
  const weight =
    floor + (1 - floor) / (1 + Math.exp(k * (ageDays - halfLifeDays)));
  return Math.max(floor, Math.min(1, weight));
}

function rerankByTimeWeightedSimilarity(
  results: TakeawaySearchResult[],
  options?: {
    now?: Date;
    halfLifeDays?: number;
  },
) {
  return results
    .map((result) => {
      const recencyWeight = computeRecencyWeight(
        result.publicationDate,
        options?.now,
        options?.halfLifeDays,
      );
      const weightedSimilarity = result.similarity * recencyWeight;

      return {
        ...result,
        similarity: weightedSimilarity,
      };
    })
    .sort((a, b) => b.similarity - a.similarity);
}
// ------------------------------------------------------------
// Helper functions <END>
// ------------------------------------------------------------

// ------------------------------------------------------------
// Query functions
// ------------------------------------------------------------
export async function vectorTakeawaySearch(
  searchInput: string,
  limit = 10,
): Promise<TakeawaySearchResult[]> {
  const searchEmbedding = await generateEmbedding(searchInput);
  const distance = sql<number>`${cosineDistance(schema.takeawayEmbeddings.embedding, searchEmbedding)}`;

  const similarTakeaways = await db.query.takeawayEmbeddings.findMany({
    with: {
      takeaway: {
        with: {
          category: true,
          document: true,
          takeawayReferences: true,
        },
      },
    },
    orderBy: [asc(distance)],
    limit,
  });
  return similarTakeaways.map((takeaway) => {
    return {
      id: takeaway.takeaway.id,
      documentId: takeaway.takeaway.document.id,
      title: takeaway.takeaway.title,
      publicationDate: takeaway.takeaway.document.publicationDate,
      createdAt: takeaway.takeaway.createdAt,
      takeaway: takeaway.takeaway.takeaway,
      summary: takeaway.takeaway.summary,
      concept: takeaway.takeaway.concept,
      source: takeaway.takeaway.document.source,
      documentTitle: takeaway.takeaway.document.title,
      documentSource: takeaway.takeaway.document.source,
      category: takeaway.takeaway.category?.name,
      similarity: cosineSimilarity(searchEmbedding, takeaway.embedding),
      references: takeaway.takeaway.takeawayReferences,
      documentLink: takeaway.takeaway.document.link,
    };
  });
}

export async function vectorTakeawaySearchTimeWeighted(
  searchInput: string,
  options?: {
    limit?: number;
    halfLifeDays?: number;
  },
): Promise<TakeawaySearchResult[]> {
  const defaultLimit = options?.limit ?? 10;
  const candidateLimit = Math.min(500, Math.max(defaultLimit, 50));

  const candidates = await vectorTakeawaySearch(searchInput, candidateLimit);
  const reranked = rerankByTimeWeightedSimilarity(candidates, options);

  return reranked.slice(0, defaultLimit);
}

export async function vectorConceptSearch(
  searchInput: string,
  limit = 10,
): Promise<TakeawaySearchResult[]> {
  const searchEmbedding = await generateEmbedding(searchInput);
  const distance = sql<number>`${cosineDistance(schema.conceptEmbeddings.embedding, searchEmbedding)}`;

  const similarConcepts = await db.query.conceptEmbeddings.findMany({
    with: {
      takeaway: {
        with: {
          category: true,
          document: true,
          takeawayReferences: true,
        },
      },
    },
    // Order by vector distance to allow index usage
    orderBy: [asc(distance)],
    limit,
  });

  return similarConcepts.map((concept) => {
    return {
      id: concept.takeaway.id,
      documentId: concept.takeaway.document.id,
      title: concept.takeaway.title,
      publicationDate: concept.takeaway.document.publicationDate,
      createdAt: concept.takeaway.createdAt,
      takeaway: concept.takeaway.takeaway,
      summary: concept.takeaway.summary,
      concept: concept.takeaway.concept,
      category: concept.takeaway.category?.name,
      source: concept.takeaway.document.source,
      documentTitle: concept.takeaway.document.title,
      documentSource: concept.takeaway.document.source,
      similarity: cosineSimilarity(searchEmbedding, concept.embedding),
      references: concept.takeaway.takeawayReferences,
      documentLink: concept.takeaway.document.link,
    };
  });
}

export async function vectorConceptSearchTimeWeighted(
  searchInput: string,
  options?: {
    limit?: number;
    halfLifeDays?: number;
  },
): Promise<TakeawaySearchResult[]> {
  const defaultLimit = options?.limit ?? 10;
  const candidateLimit = Math.min(500, Math.max(defaultLimit, 50));

  const candidates = await vectorConceptSearch(searchInput, candidateLimit);
  const reranked = rerankByTimeWeightedSimilarity(candidates, options);

  return reranked.slice(0, defaultLimit);
}

// ------------------------------------------------------------
// Query functions <END>
// ------------------------------------------------------------
