import { generateEmbedding } from "~/postgres/generate-embedding";
import { db, schema } from "~/postgres/db";
import { cosineSimilarity } from "~/lib/vector-similarity";
import { cosineDistance, gt, sql } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const searchTakeaways = createServerFn({
  method: "GET",
})
  .validator(z.string())
  .handler(async ({ data: searchString }) => {
    const searchEmbedding = await generateEmbedding(searchString);
    const similarity = sql<number>`1 - (${cosineDistance(schema.takeawayEmbeddings.embedding, searchEmbedding)})`;

    const similarTakeaways = await db.query.takeawayEmbeddings.findMany({
      with: {
        takeaway: {
          with: {
            document: true,
            category: true,
          },
        },
      },
      where: gt(similarity, 0.5),
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

    return orderedResults;
  });
