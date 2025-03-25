import { db, schema } from "~/postgres/db";

export interface Article {
  pubDate: string;
  source: string;
  title: string;
  description: string;
  link: string;
  articleText: string;
  tags: string[];
}

export async function saveContent(articles: Article[]) {
  // TODO - add user and org foreign keys

  // Check if article already exists
  const extistingArticles = await db.query.documents.findMany({
    where: (documents, { inArray, and }) =>
      and(
        inArray(
          documents.source,
          articles.map((article) => article.source),
        ),
        inArray(
          documents.title,
          articles.map((article) => article.title),
        ),
      ),
  });
  // Filter out existing articles
  const newArticles = articles.filter(
    (article) =>
      !extistingArticles.some(
        (existingArticle) =>
          existingArticle.title.toLowerCase() ===
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
      newArticles.map((article) => ({
        source: article.source,
        title: article.title,
        description: article.description,
        pubDate: article.pubDate,
        link: article.link,
        articleText: article.articleText,
        tags: article.tags,
      })),
    )
    .returning({ id: schema.documents.id });

  return results.map((result) => result.id);
}
