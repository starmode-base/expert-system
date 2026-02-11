import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";
import { inngest } from "~/inngest/client";
import { db, schema } from "~/postgres/db";

const OPML_URL =
  "https://gist.githubusercontent.com/emschwartz/e6d2bf860ccc367fe37ff953ba6de66b/raw/426957f043dc0054f95aae6c19de1d0b4ecc2bb2/hn-popular-blogs-2025.opml";

interface OpmlOutline {
  $: {
    type?: string;
    text?: string;
    title?: string;
    xmlUrl?: string;
    htmlUrl?: string;
  };
}

interface OpmlResult {
  opml: {
    body: [{ outline: [{ outline: OpmlOutline[] }] }];
  };
}

/**
 * One-time seed orchestrator: fetches the remote OPML file, deduplicates
 * against existing `blogs` rows, and fans out per-feed seed events.
 */
export const seedBlogs = inngest.createFunction(
  { id: "blog.seed-blogs" },
  [{ event: "blog/seed-blogs" }, { event: "dev/blog.seed-blogs.manual" }],
  async ({ step }) => {
    const feeds = await step.run("fetch-and-parse-opml", async () => {
      const res = await fetch(OPML_URL);
      if (!res.ok) {
        throw new Error(`Failed to fetch OPML: ${String(res.status)}`);
      }
      const opmlContent = await res.text();
      const result = (await parseStringPromise(opmlContent)) as OpmlResult;

      const outlines = result.opml.body[0].outline[0].outline;

      return outlines
        .filter(
          (o): o is OpmlOutline & { $: { xmlUrl: string } } =>
            o.$.type === "rss" && typeof o.$.xmlUrl === "string",
        )
        .map((o) => ({
          title: o.$.title ?? o.$.text ?? "Unknown",
          xmlUrl: o.$.xmlUrl,
          htmlUrl: o.$.htmlUrl ?? "",
        }));
    });

    const existingUrls = await step.run("get-existing-urls", async () => {
      const rows = await db
        .select({ xmlUrl: schema.blogs.xmlUrl })
        .from(schema.blogs);
      return rows.map((r) => r.xmlUrl);
    });

    const existingUrlSet = new Set(existingUrls);
    const newFeeds = feeds.filter((f) => !existingUrlSet.has(f.xmlUrl));

    if (newFeeds.length === 0) {
      return { seeded: 0, skipped: feeds.length };
    }

    await step.sendEvent(
      "fan-out-seed",
      newFeeds.map((feed) => ({
        name: "blog/seed-single-feed" as const,
        data: {
          xmlUrl: feed.xmlUrl,
          title: feed.title,
          htmlUrl: feed.htmlUrl,
        },
      })),
    );

    return { seeded: newFeeds.length, skipped: feeds.length - newFeeds.length };
  },
);
