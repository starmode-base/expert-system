import { createServerFn } from "@tanstack/react-start";
import { db, schema } from "../postgres/db";

import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { TakeawaySearchResult } from "./searchSFs";
import {
  vectorConceptSearchTimeWeighted,
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
