import { EventSchemas, Inngest } from "inngest";
import { z } from "zod";

const userSchema = z.object({
  id: z.string(),
  email: z.string(),
});

// Create a client to send and receive events
export const inngest = new Inngest({
  id: "expert-system",
  schemas: new EventSchemas().fromZod({
    /**
     * Hello world
     */
    "test/hello.world.expert": {
      data: z.object({
        animal: z.string(),
      }),
      user: userSchema,
    },

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
      user: userSchema,
    },

    "app/generate-takeaways": {
      data: z.object({ documentId: z.string() }),
      user: userSchema,
    },
  }),
});
