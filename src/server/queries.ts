import { createServerFn } from "@tanstack/react-start";
import { db, schema } from "../postgres/db";

import { and, desc, eq, isNotNull, lt, or } from "drizzle-orm";
import { z } from "zod";
import type { PaginatedResult } from "./pagination";
import { TakeawaySearchResult } from "./searchSFs";
import {
  vectorConceptSearchTimeWeighted,
  vectorTakeawaySearchTimeWeighted,
} from "./vector-queries";
import {
  DocumentSelect,
  InsightSelect,
  TakeawayReferenceSelect,
} from "~/postgres/schema";
import { authMiddleware } from "~/middleware/auth-middleware";

export const queryDocuments = createServerFn({
  method: "GET",
}).handler(async () => {
  const documents = await db.query.documents
    .findMany
    // {} TODO: add user and org foreign keys
    ();

  return documents;
});

export const queryDocumentsPaginated = createServerFn({
  method: "GET",
})
  .validator(
    z.object({
      cursor: z.string().nullable(),
      limit: z.number().default(25),
    }),
  )
  .handler(
    async ({
      data: { cursor, limit },
    }): Promise<PaginatedResult<DocumentSelect>> => {
      const parsedCursor = cursor
        ? (JSON.parse(cursor) as { publicationDate: string; id: string })
        : null;

      const conditions = [];
      if (parsedCursor) {
        conditions.push(
          or(
            lt(
              schema.documents.publicationDate,
              new Date(parsedCursor.publicationDate),
            ),
            and(
              eq(
                schema.documents.publicationDate,
                new Date(parsedCursor.publicationDate),
              ),
              lt(schema.documents.id, parsedCursor.id),
            ),
          ),
        );
      }

      const documents = await db.query.documents.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [
          desc(schema.documents.publicationDate),
          desc(schema.documents.id),
        ],
        limit: limit + 1,
      });

      const hasMore = documents.length > limit;
      const pageItems = hasMore ? documents.slice(0, limit) : documents;

      const lastItem = pageItems[pageItems.length - 1];
      const nextCursor =
        hasMore && lastItem
          ? JSON.stringify({
              publicationDate: lastItem.publicationDate.toISOString(),
              id: lastItem.id,
            })
          : null;

      return { items: pageItems, nextCursor };
    },
  );

export interface Document {
  id: string;
  title: string;
  description: string;
  publicationDate: Date;
  link: string;
  source: string;
  articleText: string;
  takeaways: Takeaway[];
  selectedTakeawayId?: string;
}

export interface Takeaway {
  id: string;
  documentId?: string;
  title: string;
  publicationDate: Date;
  takeaway: string;
  summary: string;
  concept: string;
  category: string | undefined;
  references: TakeawayReferenceSelect[];
  documentTitle?: string;
  documentSource?: string;
  documentLink?: string;
}

export interface InsightReferenceItem {
  insightReferenceNumber: number;
  referenceId: string;
  reference: string;
  documentId: string;
  documentTitle: string;
  documentSource: string;
  documentLink: string;
  documentPublicationDate: Date;
}

export interface InsightTakeawayItem {
  takeawayId: string;
  title: string;
  summary: string;
  documentId?: string;
  documentTitle?: string;
  documentSource?: string;
  documentLink?: string;
  documentPublicationDate?: Date;
}

export interface InsightsItem {
  insight: InsightSelect;
  insightReferences: InsightReferenceItem[];
  insightTakeaways: InsightTakeawayItem[];
}

export const queryPublicInsightsFeed = createServerFn({
  method: "GET",
}).handler(async (): Promise<InsightsItem[]> => {
  const insights = await db.query.insights.findMany({
    where: isNotNull(schema.insights.insight),
    with: {
      insightTakeaways: {
        with: {
          takeaway: {
            with: {
              document: true,
            },
          },
        },
      },
      insightReferences: {
        with: {
          takeawayReference: {
            with: { takeaway: { with: { document: true } } },
          },
        },
        orderBy: (insightReferences, { asc }) => [
          asc(insightReferences.insightReferenceNumber),
        ],
      },
    },
    orderBy: (insights, { desc }) => [desc(insights.createdAt)],
  });

  return insights.map((insight) => ({
    insight,
    insightReferences: insight.insightReferences.map((row) => ({
      insightReferenceNumber: row.insightReferenceNumber,
      referenceId: row.referenceId,
      reference: row.takeawayReference.reference,
      documentId: row.takeawayReference.takeaway.document.id,
      documentTitle: row.takeawayReference.takeaway.document.title,
      documentSource: row.takeawayReference.takeaway.document.source,
      documentLink: row.takeawayReference.takeaway.document.link,
      documentPublicationDate:
        row.takeawayReference.takeaway.document.publicationDate,
    })),
    insightTakeaways: insight.insightTakeaways
      .filter((row) => row.type === "takeaway")
      .map((row) => ({
        takeawayId: row.takeawayId,
        title: row.takeaway.title,
        summary: row.takeaway.summary,
        documentId: row.takeaway.document.id,
        documentTitle: row.takeaway.document.title,
        documentSource: row.takeaway.document.source,
        documentLink: row.takeaway.document.link,
        documentPublicationDate: row.takeaway.document.publicationDate,
      })),
  }));
});

export const queryPublicInsightById = createServerFn({ method: "GET" })
  .validator(z.string()) // insightId
  .handler(async ({ data: insightId }): Promise<InsightsItem | null> => {
    const insight = await db.query.insights.findFirst({
      where: and(
        eq(schema.insights.id, insightId),
        isNotNull(schema.insights.insight),
      ),
      with: {
        insightTakeaways: {
          with: {
            takeaway: {
              with: {
                document: true,
              },
            },
          },
        },
        insightReferences: {
          with: {
            takeawayReference: {
              with: { takeaway: { with: { document: true } } },
            },
          },
          orderBy: (insightReferences, { asc }) => [
            asc(insightReferences.insightReferenceNumber),
          ],
        },
      },
    });

    if (!insight) {
      return null;
    }

    return {
      insight,
      insightReferences: insight.insightReferences.map((row) => ({
        insightReferenceNumber: row.insightReferenceNumber,
        referenceId: row.referenceId,
        reference: row.takeawayReference.reference,
        documentId: row.takeawayReference.takeaway.document.id,
        documentTitle: row.takeawayReference.takeaway.document.title,
        documentSource: row.takeawayReference.takeaway.document.source,
        documentLink: row.takeawayReference.takeaway.document.link,
        documentPublicationDate:
          row.takeawayReference.takeaway.document.publicationDate,
      })),
      insightTakeaways: insight.insightTakeaways
        .filter((row) => row.type === "takeaway")
        .map((row) => ({
          takeawayId: row.takeawayId,
          title: row.takeaway.title,
          summary: row.takeaway.summary,
          documentId: row.takeaway.document.id,
          documentTitle: row.takeaway.document.title,
          documentSource: row.takeaway.document.source,
          documentLink: row.takeaway.document.link,
          documentPublicationDate: row.takeaway.document.publicationDate,
        })),
    };
  });

export const queryInsightsFeed = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<InsightsItem[]> => {
    const insights = await db.query.insights.findMany({
      where: and(
        eq(schema.insights.userId, context.viewer.id),
        isNotNull(schema.insights.insight),
      ),
      with: {
        insightTakeaways: {
          with: {
            takeaway: {
              with: {
                document: true,
              },
            },
          },
        },
        insightReferences: {
          with: {
            takeawayReference: {
              with: { takeaway: { with: { document: true } } },
            },
          },
          orderBy: (insightReferences, { asc }) => [
            asc(insightReferences.insightReferenceNumber),
          ],
        },
      },
      orderBy: (insights, { desc }) => [desc(insights.createdAt)],
    });

    return insights.map((insight) => ({
      insight,
      insightReferences: insight.insightReferences.map((row) => ({
        insightReferenceNumber: row.insightReferenceNumber,
        referenceId: row.referenceId,
        reference: row.takeawayReference.reference,
        documentId: row.takeawayReference.takeaway.document.id,
        documentTitle: row.takeawayReference.takeaway.document.title,
        documentSource: row.takeawayReference.takeaway.document.source,
        documentLink: row.takeawayReference.takeaway.document.link,
        documentPublicationDate:
          row.takeawayReference.takeaway.document.publicationDate,
      })),
      insightTakeaways: insight.insightTakeaways
        .filter((row) => row.type === "takeaway")
        .map((row) => ({
          takeawayId: row.takeawayId,
          title: row.takeaway.title,
          summary: row.takeaway.summary,
          documentId: row.takeaway.document.id,
          documentTitle: row.takeaway.document.title,
          documentSource: row.takeaway.document.source,
          documentLink: row.takeaway.document.link,
          documentPublicationDate: row.takeaway.document.publicationDate,
        })),
    }));
  });

// Shared relations config and mapping for insight feed queries
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */
const insightFeedWith = {
  insightTakeaways: {
    with: {
      takeaway: {
        with: {
          document: true,
        },
      },
    },
  },
  insightReferences: {
    with: {
      takeawayReference: {
        with: { takeaway: { with: { document: true } } },
      },
    },
    orderBy: (insightReferences: any, { asc }: any) => [
      asc(insightReferences.insightReferenceNumber),
    ],
  },
} as const;

function mapInsightToItem(insight: any): InsightsItem {
  return {
    insight,
    insightReferences: insight.insightReferences.map((row: any) => ({
      insightReferenceNumber: row.insightReferenceNumber,
      referenceId: row.referenceId,
      reference: row.takeawayReference.reference,
      documentId: row.takeawayReference.takeaway.document.id,
      documentTitle: row.takeawayReference.takeaway.document.title,
      documentSource: row.takeawayReference.takeaway.document.source,
      documentLink: row.takeawayReference.takeaway.document.link,
      documentPublicationDate:
        row.takeawayReference.takeaway.document.publicationDate,
    })),
    insightTakeaways: insight.insightTakeaways
      .filter((row: any) => row.type === "takeaway")
      .map((row: any) => ({
        takeawayId: row.takeawayId,
        title: row.takeaway.title,
        summary: row.takeaway.summary,
        documentId: row.takeaway.document.id,
        documentTitle: row.takeaway.document.title,
        documentSource: row.takeaway.document.source,
        documentLink: row.takeaway.document.link,
        documentPublicationDate: row.takeaway.document.publicationDate,
      })),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */

function buildInsightCursorCondition(cursor: string | null) {
  if (!cursor) return undefined;
  const parsed = JSON.parse(cursor) as { createdAt: string; id: string };
  return or(
    lt(schema.insights.createdAt, new Date(parsed.createdAt)),
    and(
      eq(schema.insights.createdAt, new Date(parsed.createdAt)),
      lt(schema.insights.id, parsed.id),
    ),
  );
}

function buildInsightNextCursor(
  items: { createdAt: Date; id: string }[],
  limit: number,
): { pageItems: typeof items; nextCursor: string | null } {
  const hasMore = items.length > limit;
  const pageItems = hasMore ? items.slice(0, limit) : items;
  const lastItem = pageItems[pageItems.length - 1];
  const nextCursor =
    hasMore && lastItem
      ? JSON.stringify({
          createdAt: lastItem.createdAt.toISOString(),
          id: lastItem.id,
        })
      : null;
  return { pageItems, nextCursor };
}

export const queryInsightsFeedPaginated = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      cursor: z.string().nullable(),
      limit: z.number().default(10),
    }),
  )
  .handler(
    async ({
      context,
      data: { cursor, limit },
    }): Promise<PaginatedResult<InsightsItem>> => {
      const cursorCondition = buildInsightCursorCondition(cursor);
      const conditions = [
        eq(schema.insights.userId, context.viewer.id),
        isNotNull(schema.insights.insight),
      ];
      if (cursorCondition) conditions.push(cursorCondition);

      const insights = await db.query.insights.findMany({
        where: and(...conditions),
        with: insightFeedWith,
        orderBy: [desc(schema.insights.createdAt), desc(schema.insights.id)],
        limit: limit + 1,
      });

      const { pageItems, nextCursor } = buildInsightNextCursor(insights, limit);
      return { items: pageItems.map(mapInsightToItem), nextCursor };
    },
  );

export const queryPublicInsightsFeedPaginated = createServerFn({
  method: "GET",
})
  .validator(
    z.object({
      cursor: z.string().nullable(),
      limit: z.number().default(10),
    }),
  )
  .handler(
    async ({
      data: { cursor, limit },
    }): Promise<PaginatedResult<InsightsItem>> => {
      const cursorCondition = buildInsightCursorCondition(cursor);
      const conditions = [isNotNull(schema.insights.insight)];
      if (cursorCondition) conditions.push(cursorCondition);

      const insights = await db.query.insights.findMany({
        where: and(...conditions),
        with: insightFeedWith,
        orderBy: [desc(schema.insights.createdAt), desc(schema.insights.id)],
        limit: limit + 1,
      });

      const { pageItems, nextCursor } = buildInsightNextCursor(insights, limit);
      return { items: pageItems.map(mapInsightToItem), nextCursor };
    },
  );

export const queryDocument = createServerFn({
  method: "GET",
})
  .validator(z.string())
  .handler(async ({ data: documentId }) => {
    const document = await db.query.documents.findFirst({
      where: eq(schema.documents.id, documentId),
      with: {
        takeaways: {
          with: {
            category: true,
            takeawayReferences: true,
          },
        },
      },
    });

    if (!document) {
      return null;
    }

    const flatDc = {
      id: document.id,
      title: document.title,
      description: document.description,
      publicationDate: document.publicationDate,
      link: document.link,
      source: document.source,
      articleText: document.articleText,
      takeaways: document.takeaways.map((takeaway) => ({
        id: takeaway.id,
        documentId: document.id,
        title: takeaway.title,
        takeaway: takeaway.takeaway,
        summary: takeaway.summary,
        publicationDate: document.publicationDate,
        concept: takeaway.concept,
        category: takeaway.category?.name,
        references: takeaway.takeawayReferences,
        documentTitle: document.title,
        documentSource: document.source,
        documentLink: document.link,
      })),
    };

    return flatDc;
  });

export const getFilterValues = createServerFn({
  method: "GET",
}).handler(async () => {
  const categories = await db.query.categories.findMany();
  const documentSources = await db.query.documents.findMany({
    columns: { source: true },
  });

  return {
    categories: categories.map((category) => category.name),
    sources: Array.from(
      new Set(documentSources.map((source) => source.source)),
    ),
  };
});

export const queryTakeaways = createServerFn({
  method: "GET",
}).handler(async (): Promise<TakeawaySearchResult[]> => {
  const takeaways = await db.query.takeaways.findMany({
    with: {
      category: true,
      document: true,
      takeawayReferences: true,
    },
  });

  const orderedResults = takeaways.sort(
    (a, b) =>
      b.document.publicationDate.getTime() -
        a.document.publicationDate.getTime() ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );

  return orderedResults.map((takeaway) => ({
    id: takeaway.id,
    documentId: takeaway.documentId,
    title: takeaway.title,
    publicationDate: takeaway.document.publicationDate,
    createdAt: takeaway.createdAt,
    takeaway: takeaway.takeaway,
    summary: takeaway.summary,
    concept: takeaway.concept,
    source: takeaway.document.source,
    documentTitle: takeaway.document.title,
    documentSource: takeaway.document.source,
    category: takeaway.category?.name,
    similarity: 0,
    references: takeaway.takeawayReferences,
    documentLink: takeaway.document.link,
  }));
});

export const vectorTakeawaySearchTimeWeightedSF = createServerFn({
  method: "GET",
})
  .validator(
    z.object({
      query: z.string(),
      limit: z.number().optional(),
      halfLifeDays: z.number().optional(),
    }),
  )
  .handler(async ({ data }): Promise<TakeawaySearchResult[]> => {
    return await vectorTakeawaySearchTimeWeighted(data.query, {
      limit: data.limit,
      halfLifeDays: data.halfLifeDays,
    });
  });

export const vectorConceptSearchTimeWeightedSF = createServerFn({
  method: "GET",
})
  .validator(
    z.object({
      query: z.string(),
      limit: z.number().optional(),
      halfLifeDays: z.number().optional(),
    }),
  )
  .handler(async ({ data }): Promise<TakeawaySearchResult[]> => {
    return await vectorConceptSearchTimeWeighted(data.query, {
      limit: data.limit,
      halfLifeDays: data.halfLifeDays,
    });
  });

export const getinsightTakeawaysSF = createServerFn({
  method: "GET",
})
  .validator(z.string()) // insightId
  .handler(
    async ({
      data: insightId,
    }): Promise<{
      takeawaysSummary: TakeawaySearchResult[];
      takeawaysConcepts: TakeawaySearchResult[];
    }> => {
      const takeaways = await db.query.insightTakeaways.findMany({
        where: eq(schema.insightTakeaways.insightId, insightId),
        with: {
          takeaway: {
            with: {
              category: true,
              document: true,
              takeawayReferences: true,
            },
          },
        },
      });

      const takeawaysWithType = takeaways.map((takeaway) => ({
        id: takeaway.takeaway.id,
        documentId: takeaway.takeaway.documentId,
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
        similarity: 0,
        references: takeaway.takeaway.takeawayReferences.map(
          (reference) => reference,
        ),
        type: takeaway.type,
        documentLink: takeaway.takeaway.document.link,
      }));
      const takeawaysSummary = takeawaysWithType.filter(
        (takeaway) => takeaway.type === "takeaway",
      );
      const takeawaysConcepts = takeawaysWithType.filter(
        (takeaway) => takeaway.type === "concept",
      );
      return {
        takeawaysSummary,
        takeawaysConcepts,
      };
    },
  );
