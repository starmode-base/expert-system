import { generateEmbedding } from "~/postgres/generate-embedding";
import { db, schema } from "~/postgres/db";
import { cosineSimilarity } from "~/lib/vector-similarity";
import { cosineDistance, gt, sql } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface TakeawaySearchResult {
  id: string;
  documentId: string;
  title: string;
  publicationDate: Date;
  takeaway: string;
  concept: string;
  category: string | undefined;
  similarity: number;
}

export const searchTakeawaysSF = createServerFn({
  method: "GET",
})
  .validator(z.string())
  .handler(async ({ data: searchString }): Promise<TakeawaySearchResult[]> => {
    const searchEmbedding = await generateEmbedding(searchString);
    const similarity = sql<number>`1 - (${cosineDistance(schema.takeawayEmbeddings.embedding, searchEmbedding)})`;

    const similarTakeaways = await db.query.takeawayEmbeddings.findMany({
      with: {
        takeaway: {
          with: {
            category: true,
            document: true,
          },
        },
      },
      where: gt(similarity, 0.2),
    });

    //   compute cosine similarity
    const withSimilarity = similarTakeaways.map((takeaway) => {
      return {
        ...takeaway,
        similarity: cosineSimilarity(searchEmbedding, takeaway.embedding),
      };
    });

    // order by similarity
    const orderedResults = withSimilarity.sort(
      (a, b) => b.similarity - a.similarity,
    );

    return orderedResults.map((result) => ({
      id: result.takeaway.id,
      documentId: result.takeaway.documentId,
      title: result.takeaway.title,
      publicationDate: result.takeaway.document.publicationDate,
      takeaway: result.takeaway.takeaway,
      concept: result.takeaway.concept,
      category: result.takeaway.category?.name,
      similarity: result.similarity,
    }));
  });
