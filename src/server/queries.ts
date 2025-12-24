import { createServerFn } from "@tanstack/react-start";
import { db, schema } from "../postgres/db";

import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { TakeawaySearchResult } from "./searchSFs";
import {
  vectorConceptSearch,
  vectorConceptSearchTimeWeighted,
  vectorTakeawaySearch,
  vectorTakeawaySearchTimeWeighted,
} from "./vector-queries";
import { InsightSelect, TakeawayReferenceSelect } from "~/postgres/schema";
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
  similarTakeaways?: TakeawaySearchResult[];
  similarConcepts?: TakeawaySearchResult[];
}

export interface Takeaway {
  id: string;
  title: string;
  publicationDate: Date;
  takeaway: string;
  summary: string;
  concept: string;
  category: string | undefined;
  references: TakeawayReferenceSelect[];
  documentTitle?: string;
  documentSource?: string;
}

export interface InsightReferenceItem {
  insightReferenceNumber: number;
  referenceId: string;
  reference: string;
  documentTitle: string;
  documentSource: string;
}

export interface InsightsItem {
  insight: InsightSelect;
  insightReferences: InsightReferenceItem[];
}

export const queryPublicInsightsFeed = createServerFn({
  method: "GET",
}).handler(async (): Promise<InsightsItem[]> => {
  const insights = await db.query.insights.findMany({
    where: isNotNull(schema.insights.insight),
    with: {
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
      documentTitle: row.takeawayReference.takeaway.document.title,
      documentSource: row.takeawayReference.takeaway.document.source,
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
        documentTitle: row.takeawayReference.takeaway.document.title,
        documentSource: row.takeawayReference.takeaway.document.source,
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
        documentTitle: row.takeawayReference.takeaway.document.title,
        documentSource: row.takeawayReference.takeaway.document.source,
      })),
    }));
  });

export const queryInsightReferences = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.string()) // insightId
  .handler(
    async ({ data: insightId, context }): Promise<InsightReferenceItem[]> => {
      const insight = await db.query.insights.findFirst({
        where: and(
          eq(schema.insights.id, insightId),
          eq(schema.insights.userId, context.viewer.id),
        ),
        columns: { id: true },
      });

      if (!insight) {
        return [];
      }

      const insightReferences = await db.query.insightReferences.findMany({
        where: eq(schema.insightReferences.insightId, insightId),
        with: {
          takeawayReference: {
            with: { takeaway: { with: { document: true } } },
          },
        },
        orderBy: (insightReferences, { asc }) => [
          asc(insightReferences.insightReferenceNumber),
        ],
      });

      return insightReferences.map((row) => ({
        insightReferenceNumber: row.insightReferenceNumber,
        referenceId: row.referenceId,
        reference: row.takeawayReference.reference,
        documentTitle: row.takeawayReference.takeaway.document.title,
        documentSource: row.takeawayReference.takeaway.document.source,
      }));
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
        title: takeaway.title,
        takeaway: takeaway.takeaway,
        summary: takeaway.summary,
        publicationDate: document.publicationDate,
        concept: takeaway.concept,
        category: takeaway.category?.name,
        references: takeaway.takeawayReferences,
        documentTitle: document.title,
        documentSource: document.source,
      })),
    };

    return flatDc;
  });

export const queryDocumentByTakeaway = createServerFn({
  method: "GET",
})
  .validator(z.string()) // takeawayId
  .handler(async ({ data: takeawayId }) => {
    const takeaway = await db.query.takeaways.findFirst({
      where: eq(schema.takeaways.id, takeawayId),
      with: {
        document: {
          with: {
            takeaways: {
              with: { category: true, takeawayReferences: true },
            },
          },
        },
      },
    });

    // Either the ID is bad, or the FK was severed
    if (!takeaway?.document) {
      return null;
    }

    const { document } = takeaway;

    // Fetch similar takeaways and concepts in parallel
    // Fetch 11 to ensure we have 10 after filtering out the current takeaway
    const [similarTakeawaysRaw, similarConceptsRaw] = await Promise.all([
      vectorTakeawaySearch(takeaway.takeaway, 11),
      vectorConceptSearch(takeaway.concept, 11),
    ]);

    // Filter out the current takeaway and limit to top 10
    const similarTakeaways = similarTakeawaysRaw.filter(
      (t) => t.id !== takeawayId,
    );

    const similarConcepts = similarConceptsRaw.filter(
      (c) => c.id !== takeawayId,
    );

    // Same flattened response object used in `queryDocument`
    const flatDc: Document = {
      id: document.id,
      title: document.title,
      description: document.description,
      publicationDate: document.publicationDate,
      link: document.link,
      source: document.source,
      articleText: document.articleText,
      takeaways: document.takeaways.map((tw) => ({
        id: tw.id,
        title: tw.title,
        publicationDate: document.publicationDate,
        takeaway: tw.takeaway,
        summary: tw.summary,
        concept: tw.concept,
        category: tw.category?.name,
        references: tw.takeawayReferences,
        documentTitle: document.title,
        documentSource: document.source,
      })),
      selectedTakeawayId: takeawayId,
      similarTakeaways,
      similarConcepts,
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
