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

  // Check if article already exists
  const extistingDocument = await db.query.documents.findMany({
    where: (documents, { inArray, and }) =>
      and(
        inArray(
          documents.source,
          document.map((article) => article.source),
        ),
        inArray(
          documents.title,
          document.map((article) => article.title),
        ),
      ),
  });
  // Filter out existing articles
  const newDocument = document.filter(
    (article) =>
      !extistingDocument.some(
        (existingDocument) =>
          existingDocument.title.toLowerCase() ===
          article.title
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, ""),
      ),
  );

  // Only save new articles
  const results = await db
    .insert(schema.documents)
    .values(
      newDocument.map((document) => ({
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
