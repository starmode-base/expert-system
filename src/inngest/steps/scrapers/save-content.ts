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

export async function saveContent(document: Document[]) {
  // TODO - add user and org foreign keys
  console.log(
    "saveContent",
    document.map((d) => d.title),
  );
  // Only save new articles
  const results = await db
    .insert(schema.documents)
    .values(
      document.map((document) => ({
        source: document.source,
        title: document.title,
        description: document.description,
        pubDate: document.pubDate,
        link: document.link,
        articleText: document.articleText,
        tags: document.tags,
      })),
    )
    .returning({ id: schema.documents.id });

  return results.map((result) => result.id);
}
