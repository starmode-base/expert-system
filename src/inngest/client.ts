import { EventSchemas, Inngest } from "inngest";
import { z } from "zod";

const userSchema = z.object({
  id: z.string(),
  email: z.string(),
});

const eventSchemas = {
  /**
   * Daily Science Scrapper
   */
  "scraper/daily-science": z.object({}),
  "earnings/sync.requested": z.object({}),
  "earnings/call.discovered": z.object({
    callId: z.string(),
  }),
  "app/generate-takeaways": z.object({
    documentId: z.string(),
    takeawayPrompt: z.string().optional(),
    model: z.string().optional(),
    user: userSchema,
  }),
  "app/generate-insight": z.object({
    insightPrompt: z.string().optional(),
    seedText: z.string(),
    user: userSchema,
  }),
  "scheduler/daily-x-post": z.object({
    data: z.object({}),
  }),
  "scheduler.daily-insight.manual": z.object({}),
  "dev/scheduler.macrovoices-scraper.manual": z.object({}),
  "dev/scheduler.fed-speeches-scraper.manual": z.object({}),
  "dev/scheduler.dwarkesh-podcast-scraper.manual": z.object({}),
  "dev/scheduler.a16z-news-scraper.manual": z.object({}),
  "blog/scrape-all-blogs": z.object({}),
  "blog/scrape-single-blog": z.object({
    blogId: z.string(),
  }),
  "dev/blog.scrape-all-blogs.manual": z.object({}),
  "stock/backfill-company-overviews": z.object({}),
  "stock/fetch-company-overview": z.object({
    stockSymbolId: z.string(),
    symbol: z.string(),
  }),
};

// Create a client to send and receive events
export const inngest = new Inngest({
  id: "expert-system",
  schemas: new EventSchemas().fromSchema(eventSchemas),
});
