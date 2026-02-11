import fetch from "node-fetch";
import { eq, inArray } from "drizzle-orm";
import { inngest } from "~/inngest/client";
import { db, schema } from "~/postgres/db";
import { parseFeedItems, type BlogArticleCandidate } from "./blog-helpers";
import { extractBodyTextFromUrl } from "~/inngest/importers/scrapers/extract-body-text";
import { getDocumentSummary } from "../../helpers/get-document-summary";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_ARTICLES_PER_RUN = 2;

/**
 * Per-blog scraper worker: fetches and parses the RSS feed, deduplicates
 * against existing documents, extracts article text (from feed or via
 * GPT-5-nano), generates summaries, inserts documents, and fans out
 * takeaway generation.
 */
export const scrapeSingleBlog = inngest.createFunction(
  {
    id: "blog.scrape-single-blog",
    concurrency: { limit: 10 },
  },
  { event: "blog/scrape-single-blog" },
  async ({ event, step }) => {
    const { blogId } = event.data;

    const blog = await step.run("get-blog-config", async () => {
      const row = await db.query.blogs.findFirst({
        where: (blogs, { eq: eqFn }) => eqFn(blogs.id, blogId),
      });
      if (!row) {
        throw new Error(`Blog not found: ${blogId}`);
      }
      return row;
    });

    const candidates = await step.run("fetch-and-parse-feed", async () => {
      const res = await fetch(blog.xmlUrl, {
        headers: { "User-Agent": "ExpertSystem/1.0 RSS Reader" },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        throw new Error(
          `Feed fetch failed (${String(res.status)}): ${blog.xmlUrl}`,
        );
      }

      const xml = await res.text();
      return await parseFeedItems(xml, blog.contentInFeed);
    });

    if (candidates.length === 0) {
      return { inserted: 0, skipped: 0, blogTitle: blog.title };
    }

    // Deduplicate against existing documents
    const uniqueLinks = Array.from(new Set(candidates.map((c) => c.link)));

    const existingLinks = await step.run("get-existing-links", async () => {
      const rows = await db
        .select({ link: schema.documents.link })
        .from(schema.documents)
        .where(inArray(schema.documents.link, uniqueLinks));
      return rows.map((r) => r.link);
    });

    const existingLinkSet = new Set(existingLinks);
    const cutoffDate = new Date(Date.now() - NINETY_DAYS_MS);

    const newCandidates = candidates
      .filter(
        (c) =>
          !existingLinkSet.has(c.link) &&
          new Date(c.publicationDate) >= cutoffDate,
      )
      .sort(
        (a, b) =>
          new Date(b.publicationDate).getTime() -
          new Date(a.publicationDate).getTime(),
      )
      .slice(-MAX_ARTICLES_PER_RUN);

    if (newCandidates.length === 0) {
      await step.run("update-last-scraped", async () => {
        await db
          .update(schema.blogs)
          .set({ lastScrapedAt: new Date() })
          .where(eq(schema.blogs.id, blogId));
      });
      return { inserted: 0, skipped: candidates.length, blogTitle: blog.title };
    }

    // Extract article text for candidates that don't have it from the feed
    type CandidateWithText = BlogArticleCandidate & { articleText: string };

    const withText: CandidateWithText[] = await step.run(
      "extract-article-text",
      async () => {
        if (blog.contentInFeed) {
          // Filter out any that failed to extract from feed
          return newCandidates.filter(
            (c): c is CandidateWithText => c.articleText !== null,
          );
        }

        // Fetch article text from URLs via GPT-5-nano
        const results = await Promise.allSettled(
          newCandidates.map(async (c) => {
            const text = await extractBodyTextFromUrl(c.link);
            return { ...c, articleText: text };
          }),
        );

        return results
          .filter(
            (r): r is PromiseFulfilledResult<CandidateWithText> =>
              r.status === "fulfilled" && r.value.articleText.length > 0,
          )
          .map((r) => r.value);
      },
    );

    if (withText.length === 0) {
      await step.run("update-last-scraped-no-text", async () => {
        await db
          .update(schema.blogs)
          .set({ lastScrapedAt: new Date() })
          .where(eq(schema.blogs.id, blogId));
      });
      return {
        inserted: 0,
        skipped: newCandidates.length,
        blogTitle: blog.title,
      };
    }

    // Generate summaries and assess substantiveness
    const withSummaries = await Promise.all(
      withText.map(async (doc, index) => {
        const summaryResult = await step.run(
          `generate-summary-${index}`,
          async () => {
            return await getDocumentSummary(doc.articleText, doc.title);
          },
        );
        return { ...doc, summaryResult };
      }),
    );

    // Insert all documents
    const inserted = await step.run("insert-documents", async () => {
      const values = withSummaries.map((doc) => ({
        source: blog.title,
        title: doc.title,
        description: doc.summaryResult.summary,
        publicationDate: new Date(doc.publicationDate),
        link: doc.link,
        articleText: doc.articleText,
        isSubstantive: doc.summaryResult.isSubstantive,
      }));

      return await db.insert(schema.documents).values(values).returning({
        id: schema.documents.id,
        isSubstantive: schema.documents.isSubstantive,
      });
    });

    // Only fan out takeaway generation for substantive articles
    const substantive = inserted.filter((doc) => doc.isSubstantive);

    await Promise.all(
      substantive.map(async (doc) => {
        await step.sendEvent(`generate-takeaways-${doc.id}`, {
          name: "app/generate-takeaways",
          data: {
            documentId: doc.id,
            user: { id: "", email: "" },
          },
        });
      }),
    );

    // Update lastScrapedAt
    await step.run("update-last-scraped-done", async () => {
      await db
        .update(schema.blogs)
        .set({ lastScrapedAt: new Date() })
        .where(eq(schema.blogs.id, blogId));
    });

    return {
      inserted: inserted.length,
      skipped: candidates.length - inserted.length,
      blogTitle: blog.title,
    };
  },
);
