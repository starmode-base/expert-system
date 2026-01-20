import { inngest } from "~/inngest/client";
import fetch from "node-fetch";
import { db, schema } from "~/postgres/db";
import { inArray } from "drizzle-orm";
import {
  A16zCandidate,
  a16zTakeawayPrompt,
  fetchA16zArticleText,
  parseA16zArchiveList,
} from "./a16z-helpers";

type A16zCandidateWithArticle = A16zCandidate & {
  articleText: string;
};

/**
 * Scrape a16z news archive for new posts.
 * Runs daily at 5 AM Phoenix time.
 */
export const a16zNewsScraper = inngest.createFunction(
  { id: "scheduler.a16z-news-scraper" },
  { cron: "TZ=America/Phoenix 0 5 * * *" },
  async ({ step }) => {
    const listUrl = "https://www.a16z.news/archive?sort=new";

    const listHtml = await step.run("fetch-archive-page", async () => {
      const res = await fetch(listUrl);
      return res.text();
    });

    const candidates: A16zCandidate[] = await step.run("parse-archive", () =>
      parseA16zArchiveList(listHtml),
    );

    if (candidates.length === 0) {
      return { inserted: 0, skipped: 0 };
    }

    const uniqueLinks = Array.from(
      new Set(candidates.map((candidate) => candidate.link)),
    );

    const existingLinks = await step.run("get-existing-links", async () => {
      const rows = await db
        .select({ link: schema.documents.link })
        .from(schema.documents)
        .where(inArray(schema.documents.link, uniqueLinks));

      return rows.map((row) => row.link);
    });

    const existingLinkSet = new Set(existingLinks);
    const newCandidates = candidates.filter(
      (candidate) => !existingLinkSet.has(candidate.link),
    );

    if (newCandidates.length === 0) {
      return { inserted: 0, skipped: candidates.length };
    }

    const candidatesWithArticles = await step.run(
      "fetch-articles",
      async () => {
        const results = await Promise.all(
          newCandidates.slice(0, 1).map(async (candidate) => {
            const articleText = await fetchA16zArticleText(candidate.link);
            if (!articleText) {
              return null;
            }

            return { ...candidate, articleText };
          }),
        );

        return results.filter((c): c is A16zCandidateWithArticle => Boolean(c));
      },
    );

    if (candidatesWithArticles.length === 0) {
      return { inserted: 0, skipped: newCandidates.length };
    }

    const inserted = await step.run("insert-documents", async () => {
      const values = candidatesWithArticles.map((doc) => ({
        source: "a16z News",
        title: doc.title,
        description: doc.description,
        publicationDate: new Date(doc.publicationDate),
        link: doc.link,
        articleText: doc.articleText,
      }));

      return await db.insert(schema.documents).values(values).returning({
        id: schema.documents.id,
      });
    });

    await Promise.all(
      inserted.map(async (doc) => {
        await step.sendEvent(`generate-takeaways-${doc.id}`, {
          name: "app/generate-takeaways",
          data: {
            documentId: doc.id,
            takeawayPrompt: a16zTakeawayPrompt,
            model: "gpt-5.2",
            user: { id: "", email: "" },
          },
        });
      }),
    );

    return {
      inserted: inserted.length,
      skipped: candidates.length - candidatesWithArticles.length,
    };
  },
);
