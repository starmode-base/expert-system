import { desc, eq } from "drizzle-orm";
import { db, schema } from "~/postgres/db";
import {
  vectorTakeawaySearch,
  vectorTakeawaySearchTimeWeighted,
} from "~/server/vector-queries";
import { sliceDocumentContent } from "./document-content";

export const MAX_PUBLIC_IDS = 50;

function publicDocument(document: {
  id: string;
  title: string;
  source: string;
  link: string;
  publicationDate: Date;
}) {
  return {
    id: document.id,
    title: document.title,
    source: document.source,
    link: document.link,
    publicationDate: document.publicationDate,
  };
}

export async function searchTakeawayPreviews(
  query: string,
  options: { limit: number; recent: boolean },
) {
  const results = options.recent
    ? await vectorTakeawaySearchTimeWeighted(query, { limit: options.limit })
    : await vectorTakeawaySearch(query, options.limit);

  return results.map((result) => ({
    id: result.id,
    documentId: result.documentId,
    title: result.title,
    summary: result.summary,
    publicationDate: result.publicationDate,
    document: {
      id: result.documentId,
      title: result.documentTitle,
      source: result.documentSource,
      link: result.documentLink,
      publicationDate: result.publicationDate,
    },
  }));
}

export async function getRecentTakeawayPreviews(limit: number) {
  const rows = await db
    .select({
      id: schema.takeaways.id,
      documentId: schema.takeaways.documentId,
      title: schema.takeaways.title,
      summary: schema.takeaways.summary,
      publicationDate: schema.documents.publicationDate,
      documentTitle: schema.documents.title,
      documentSource: schema.documents.source,
      documentLink: schema.documents.link,
    })
    .from(schema.takeaways)
    .innerJoin(
      schema.documents,
      eq(schema.takeaways.documentId, schema.documents.id),
    )
    .orderBy(desc(schema.documents.publicationDate), desc(schema.takeaways.id))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    documentId: row.documentId,
    title: row.title,
    summary: row.summary,
    publicationDate: row.publicationDate,
    document: {
      id: row.documentId,
      title: row.documentTitle,
      source: row.documentSource,
      link: row.documentLink,
      publicationDate: row.publicationDate,
    },
  }));
}

export async function getTakeawaysByIds(ids: string[]) {
  const takeaways = await db.query.takeaways.findMany({
    columns: {
      id: true,
      title: true,
      summary: true,
      takeaway: true,
    },
    with: {
      document: {
        columns: {
          id: true,
          title: true,
          source: true,
          link: true,
          publicationDate: true,
        },
      },
      takeawayReferences: {
        columns: {
          referenceNumber: true,
          reference: true,
        },
        orderBy: (references, { asc }) => asc(references.referenceNumber),
      },
    },
    where: (takeaway, { inArray }) => inArray(takeaway.id, ids),
  });

  const orderMap = new Map(ids.map((id, index) => [id, index]));
  takeaways.sort(
    (left, right) =>
      (orderMap.get(left.id) ?? 0) - (orderMap.get(right.id) ?? 0),
  );

  return takeaways.map((takeaway) => ({
    ...takeaway,
    url: `https://expert-system.starmode.dev/takeaway/${takeaway.id}`,
  }));
}

export async function getDocumentsByIds(ids: string[]) {
  const documents = await db.query.documents.findMany({
    where: (document, { inArray }) => inArray(document.id, ids),
  });

  const orderMap = new Map(ids.map((id, index) => [id, index]));
  documents.sort(
    (left, right) =>
      (orderMap.get(left.id) ?? 0) - (orderMap.get(right.id) ?? 0),
  );
  return documents;
}

export async function getDocumentContent(
  documentId: string,
  offset: number,
  limit: number,
) {
  const document = await db.query.documents.findFirst({
    where: eq(schema.documents.id, documentId),
    columns: {
      id: true,
      title: true,
      source: true,
      link: true,
      publicationDate: true,
      articleText: true,
    },
  });
  if (!document) return null;

  return {
    item: {
      ...publicDocument(document),
      content: sliceDocumentContent(document.articleText, offset, limit),
    },
  };
}
