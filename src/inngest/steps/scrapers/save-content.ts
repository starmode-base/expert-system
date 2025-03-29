import { invariant } from "@tanstack/react-router";
import { db, schema } from "~/postgres/db";

export interface Document {
  publicationDate: Date;
  source: string;
  title: string;
  description: string;
  link: string;
  articleText: string;
}

export async function saveContent(document: Document) {
  // TODO - add user and org foreign keys

  // Only save new articles
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
