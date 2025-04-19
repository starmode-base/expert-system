import { generateEmbedding } from "~/postgres/generate-embedding";
import { db, schema } from "~/postgres/db";
import { cosineSimilarity } from "~/lib/vector-similarity";
import { cosineDistance, gt, sql } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { queryTakeaways } from "./queries";

export interface TakeawaySearchResult {
  id: string;
  documentId: string;
  title: string;
  publicationDate: Date;
  takeaway: string;
  concept: string;
  source: string;
  category: string | undefined;
  similarity: number;
}

async function vectorSearch(searchInput: string) {
  const searchEmbedding = await generateEmbedding(searchInput);
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
    };
  });
}
export const searchTakeawaysSF = createServerFn({
  method: "GET",
})
  .validator(
    z.object({
      searchInput: z.string().optional(),
      filters: z.object({
        categories: z.array(z.string()),
        sources: z.array(z.string()),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }),
    }),
  )
  .handler(
    async ({
      data: { searchInput, filters },
    }): Promise<TakeawaySearchResult[]> => {
      console.log("searchEmbedding", filters);

      const withSimilarity = searchInput
        ? await vectorSearch(searchInput)
        : await queryTakeaways();

      // filter,  order by similarity
      const orderedResults = withSimilarity
        .filter((result) => {
          return (
            (!filters.startDate ||
              result.publicationDate >= filters.startDate) &&
            (!filters.endDate || result.publicationDate <= filters.endDate) &&
            // if no categories are selected, show all.
            (!result.category ||
              filters.categories.includes(result.category)) &&
            filters.sources.includes(result.source)
          );
        })
        .sort((a, b) => b.similarity - a.similarity);

      return orderedResults.map((result) => ({
        id: result.id,
        documentId: result.documentId,
        title: result.title,
        publicationDate: result.publicationDate,
        takeaway: result.takeaway,
        concept: result.concept,
        source: result.source,
        category: result.category,
        similarity: result.similarity,
      }));
    },
  );
