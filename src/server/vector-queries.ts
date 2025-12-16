import { cosineDistance, desc, gt, sql } from "drizzle-orm";
import { cosineSimilarity } from "~/lib/vector-similarity";
import { db, schema } from "~/postgres/db";
import { generateEmbedding } from "~/postgres/generate-embedding";

export async function vectorTakeawaySearch(searchInput: string, limit = 10) {
  const searchEmbedding = await generateEmbedding(searchInput);
  const similarity = sql<number>`1 - (${cosineDistance(schema.takeawayEmbeddings.embedding, searchEmbedding)})`;

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
    where: gt(similarity, 0.2),
    orderBy: [desc(similarity)],
    limit,
  });

  return similarTakeaways.map((takeaway) => {
    return {
      id: takeaway.takeaway.id,
      documentId: takeaway.takeaway.document.id,
      title: takeaway.takeaway.title,
      publicationDate: takeaway.takeaway.document.publicationDate,
      takeaway: takeaway.takeaway.takeaway,
      concept: takeaway.takeaway.concept,
      source: takeaway.takeaway.document.source,
      category: takeaway.takeaway.category?.name,
      similarity: cosineSimilarity(searchEmbedding, takeaway.embedding),
      references: takeaway.takeaway.takeawayReferences,
    };
  });
}

export async function vectorConceptSearch(searchInput: string, limit = 10) {
  const searchEmbedding = await generateEmbedding(searchInput);
  const similarity = sql<number>`1 - (${cosineDistance(schema.conceptEmbeddings.embedding, searchEmbedding)})`;

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
    //order by similarity
    orderBy: [desc(similarity)],
    limit,
  });

  return similarConcepts.map((concept) => {
    return {
      id: concept.takeaway.id,
      documentId: concept.takeaway.document.id,
      title: concept.takeaway.title,
      publicationDate: concept.takeaway.document.publicationDate,
      takeaway: concept.takeaway.takeaway,
      concept: concept.takeaway.concept,
      category: concept.takeaway.category?.name,
      source: concept.takeaway.document.source,
      similarity: cosineSimilarity(searchEmbedding, concept.embedding),
      references: concept.takeaway.takeawayReferences,
    };
  });
}
