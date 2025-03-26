import { invariant } from "@tanstack/react-router";
import { db, schema } from "~/postgres/db";

export interface Document {
  pubDate: string;
  source: string;
  title: string;
  description: string;
  link: string;
  articleText: string;
  tags: string[];
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
      pubDate: document.pubDate,
      link: document.link,
      articleText: document.articleText,
      tags: document.tags,
    })
    .returning({ id: schema.documents.id });

  invariant(result[0], "Failed to create document");

  return result[0].id;
}
