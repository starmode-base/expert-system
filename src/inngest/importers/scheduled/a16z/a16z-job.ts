import { inngest } from "~/inngest/client";
import fetch from "node-fetch";
import {
  type A16zCandidate,
  a16zTakeawayPrompt,
  fetchA16zArticleText,
  parseA16zArchiveList,
} from "./a16z-helpers";
import {
  getExistingLinks,
  ingestDocuments,
} from "../../helpers/ingest-pipeline";

type A16zCandidateWithArticle = A16zCandidate & {
  articleText: string;
};

/**
 * Scrape a16z news archive for new posts.
 * Runs daily at 5 AM Phoenix time.
 */
const trigger =
  process.env.NODE_ENV === "production"
    ? ({ cron: "TZ=America/Phoenix 0 5 * * *" } as const)
    : ({ event: "dev/scheduler.a16z-news-scraper.manual" } as const);

export const a16zNewsScraper = inngest.createFunction(
  { id: "scheduler.a16z-news-scraper" },
  trigger,
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

    const existingLinkSet = await getExistingLinks(
      step,
      candidates.map((c) => c.link),
    );

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
          newCandidates.slice(0, 20).map(async (candidate) => {
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

    const { inserted } = await ingestDocuments(
      step,
      candidatesWithArticles.map((c) => ({
        link: c.link,
        title: c.title,
        publicationDate: c.publicationDate,
        articleText: c.articleText,
      })),
      {
        source: "a16z News",
        takeawayPrompt: a16zTakeawayPrompt,
      },
    );

    return {
      inserted: inserted.length,
      skipped: candidates.length - candidatesWithArticles.length,
    };
  },
);
