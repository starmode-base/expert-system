import { eq } from "drizzle-orm";
import { inngest } from "~/inngest/client";
import { db, schema } from "~/postgres/db";

/**
 * Daily cron orchestrator: queries all enabled blogs and fans out
 * individual scrape events.
 */
const trigger =
  process.env.NODE_ENV === "production"
    ? ({ cron: "TZ=America/Phoenix 30 5 * * *" } as const)
    : ({ event: "dev/blog.scrape-all-blogs.manual" } as const);

export const scrapeAllBlogs = inngest.createFunction(
  { id: "blog.scrape-all-blogs" },
  trigger,
  async ({ step }) => {
    const enabledBlogs = await step.run("get-enabled-blogs", async () => {
      return await db
        .select({ id: schema.blogs.id })
        .from(schema.blogs)
        .where(eq(schema.blogs.enabled, true));
    });

    if (enabledBlogs.length === 0) {
      return { dispatched: 0 };
    }

    await step.sendEvent(
      "fan-out-scrape",
      enabledBlogs.map((blog) => ({
        name: "blog/scrape-single-blog" as const,
        data: { blogId: blog.id },
      })),
    );

    return { dispatched: enabledBlogs.length };
  },
);
