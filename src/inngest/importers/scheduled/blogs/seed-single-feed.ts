import fetch from "node-fetch";
import { inngest } from "~/inngest/client";
import { db, schema } from "~/postgres/db";
import {
  extractFeedMetadata,
  detectContentInFeedFromXml,
} from "./blog-helpers";

/**
 * Per-feed seed worker: fetches a single RSS/Atom feed, extracts metadata,
 * detects whether content is included, and upserts into the `blogs` table.
 */
export const seedSingleFeed = inngest.createFunction(
  { id: "blog.seed-single-feed" },
  { event: "blog/seed-single-feed" },
  async ({ event, step }) => {
    const { xmlUrl, title: opmlTitle, htmlUrl } = event.data;

    const feedData = await step.run("fetch-and-analyze-feed", async () => {
      const res = await fetch(xmlUrl, {
        headers: { "User-Agent": "ExpertSystem/1.0 RSS Reader" },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        throw new Error(`Feed fetch failed (${String(res.status)}): ${xmlUrl}`);
      }

      const xml = await res.text();
      const metadata = await extractFeedMetadata(xml);
      const contentInFeed = await detectContentInFeedFromXml(xml);

      return {
        title: metadata.title ?? opmlTitle,
        description: metadata.description,
        contentInFeed,
      };
    });

    await step.run("upsert-blog", async () => {
      await db
        .insert(schema.blogs)
        .values({
          title: feedData.title,
          description: feedData.description,
          xmlUrl,
          htmlUrl: htmlUrl || null,
          enabled: false,
          contentInFeed: feedData.contentInFeed,
        })
        .onConflictDoUpdate({
          target: schema.blogs.xmlUrl,
          set: {
            title: feedData.title,
            description: feedData.description,
            htmlUrl: htmlUrl || null,
            contentInFeed: feedData.contentInFeed,
          },
        });
    });

    return {
      xmlUrl,
      title: feedData.title,
      contentInFeed: feedData.contentInFeed,
    };
  },
);
