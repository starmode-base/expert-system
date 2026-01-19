import { EventSchemas, Inngest } from "inngest";
import { z } from "zod-v3";

const userSchema = z.object({
  id: z.string(),
  email: z.string(),
});

// Create a client to send and receive events
export const inngest = new Inngest({
  id: "expert-system",
  schemas: new EventSchemas().fromZod({
    /**
     * Daily Science Scrapper
     */
    "scraper/daily-science": {
      user: userSchema,
    },

    /**
     * Earnings Calls
     */
    "scraper/earnings-calls": {
      data: z.object({
        symbols: z.array(z.object({ symbol: z.string(), name: z.string() })),
        year: z.number(),
        quarter: z.number(),
      }),
      user: userSchema,
    },

    "app/generate-takeaways": {
      data: z.object({
        documentId: z.string(),
        takeawayPrompt: z.string().optional(),
        model: z.string().optional(),
      }),
      user: userSchema,
    },

    "app/generate-insight": {
      data: z.object({
        seedText: z.string(),
        insightPrompt: z.string(),
        model: z.string().optional(),
      }),
      user: userSchema,
    },

    /**
     * Sync earnings calendar from Alpha Vantage
     */
    "scheduler/sync-earnings-calendar": {
      data: z.object({}),
    },

    /**
     * Process pending earnings fetch jobs
     */
    "scheduler/process-earnings-jobs": {
      data: z.object({}),
    },
  }),
});
