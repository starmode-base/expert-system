import { db, schema } from "~/postgres/db";

export interface Article {
  pubDate: string;
  title: string;
  description: string;
  link: string;
  articleText: string;
  tags: string[];
}

export async function saveContent(articles: Article[]) {
  const userId = "JfdOiPJhx9FnAarLLOKi6JOO";
  const organizationId = "Org1";

  const results = await db
    .insert(schema.documents)
    .values(
      articles.map((article) => ({
        userId,
        organizationId,
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
