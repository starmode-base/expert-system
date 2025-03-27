import { createServerFn } from "@tanstack/react-start";
import { db, schema } from "../postgres/db";

import { eq } from "drizzle-orm";
import { z } from "zod";

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
  pubDate: string;
  link: string;
  source: string;
  articleText: string;
  takeaways: {
    id: string;
    takeaway: string;
    concept: string;
    novelty: string;
    importance: string;
    monetization: string;
    category: string | undefined;
  }[];
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
      pubDate: document.pubDate,
      link: document.link,
      source: document.source,
      articleText: document.articleText,
      takeaways: document.takeaways.map((takeaway) => ({
        id: takeaway.id,
        takeaway: takeaway.takeaway,
        concept: takeaway.concept,
        novelty: takeaway.novelty,
        importance: takeaway.importance,
        monetization: takeaway.monetization,
        category: takeaway.category?.name,
      })),
    };

    return flatDc;
  });
