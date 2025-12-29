import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { queryTakeaways } from "./queries";
import { vectorTakeawaySearch } from "./vector-queries";
import { TakeawayReferenceSelect } from "~/postgres/schema";

export interface TakeawaySearchResult {
  id: string;
  documentId: string;
  title: string;
  publicationDate: Date;
  createdAt: Date;
  takeaway: string;
  summary: string;
  concept: string;
  source: string;
  documentTitle: string;
  documentSource: string;
  category: string | undefined;
  similarity: number;
  references: TakeawayReferenceSelect[];
}

export const searchTakeawaysSF = createServerFn({
  method: "GET",
})
  .validator(
    z.object({
      searchInput: z.string().optional(),
      filters: z.object({
        sources: z.array(z.string()),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
    }),
  )
  .handler(
    async ({
      data: { searchInput, filters },
    }): Promise<TakeawaySearchResult[]> => {
      console.log("searchEmbedding", filters);

      const withSimilarity: TakeawaySearchResult[] = searchInput
        ? await vectorTakeawaySearch(searchInput, 100)
        : await queryTakeaways();

      // Filter then order results
      const orderedResults = withSimilarity
        .filter((result) => {
          return (
            (!filters.startDate ||
              result.publicationDate >= new Date(filters.startDate)) &&
            (!filters.endDate ||
              result.publicationDate <= new Date(filters.endDate)) &&
            filters.sources.includes(result.source)
          );
        })
        .sort((a, b) => b.similarity - a.similarity);

      return orderedResults.map((result) => ({
        id: result.id,
        documentId: result.documentId,
        title: result.title,
        publicationDate: result.publicationDate,
        createdAt: result.createdAt,
        takeaway: result.takeaway,
        summary: result.summary,
        concept: result.concept,
        source: result.source,
        documentTitle: result.documentTitle,
        documentSource: result.documentSource,
        category: result.category,
        similarity: result.similarity,
        references: result.references,
      }));
    },
  );
