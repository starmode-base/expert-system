import { createServerFn } from "@tanstack/react-start";
import { db, schema } from "../postgres/db";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { TakeawaySearchResult } from "./searchSFs";

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
}

export interface Takeaway {
  id: string;
  title: string;
  publicationDate: Date;
  takeaway: string;
  concept: string;
  category: string | undefined;
}

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
        publicationDate: document.publicationDate,
        concept: takeaway.concept,
        category: takeaway.category?.name,
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
              with: { category: true },
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
        concept: tw.concept,
        category: tw.category?.name,
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
    },
  });

  const orderedResults = takeaways.sort(
    (a, b) =>
      b.document.publicationDate.getTime() -
      a.document.publicationDate.getTime(),
  );

  return orderedResults.map((takeaway) => ({
    id: takeaway.id,
    documentId: takeaway.documentId,
    title: takeaway.title,
    publicationDate: takeaway.document.publicationDate,
    takeaway: takeaway.takeaway,
    concept: takeaway.concept,
    category: takeaway.category?.name,
    similarity: 0,
  }));
});
