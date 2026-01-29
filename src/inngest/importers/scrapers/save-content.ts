import { invariant } from "@tanstack/react-router";
import { and } from "drizzle-orm";
import { db, schema } from "~/postgres/db";

export interface Document {
  publicationDate: Date;
  source: string;
  title: string;
  description: string;
  link: string;
  articleText: string;
}

/**
 * Checks if a document with the given source and title already exists.
 * @returns The document ID if exists, null otherwise
 */
export async function documentExists({
  source,
  title,
}: {
  source: string;
  title: string;
}): Promise<string | null> {
  const doc = await db.query.documents.findFirst({
    where: (documents, { eq }) =>
      and(eq(documents.title, title), eq(documents.source, source)),
    columns: { id: true },
  });

  return doc?.id ?? null;
}

/**
 * Saves a document to the database.
 * @returns The created document ID
 */
export async function saveContent(document: Document): Promise<string> {
  const result = await db
    .insert(schema.documents)
    .values({
      source: document.source,
      title: document.title,
      description: document.description,
      publicationDate: document.publicationDate,
      link: document.link,
      articleText: document.articleText,
    })
    .returning({ id: schema.documents.id });

  invariant(result[0], "Failed to create document");

  return result[0].id;
}
