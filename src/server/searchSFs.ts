import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { queryTakeawaysPaginated } from "./queries";
import type { PaginatedResult } from "./pagination";
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
  documentLink: string;
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
      cursor: z.string().nullable().optional(),
      limit: z.number().default(20),
    }),
  )
  .handler(
    async ({
      data: { searchInput, filters, cursor, limit },
    }): Promise<PaginatedResult<TakeawaySearchResult>> => {
      if (searchInput) {
        // Vector search: return all results (already capped at 100), no pagination
        const results = await vectorTakeawaySearch(searchInput, 100);

        const filtered = results
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

        return { items: filtered, nextCursor: null };
      }

      // Browse mode: paginated with filters pushed to SQL
      return await queryTakeawaysPaginated({
        data: {
          cursor: cursor ?? null,
          limit,
          filters,
        },
      });
    },
  );
