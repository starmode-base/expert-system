import { EventSchemas, Inngest } from "inngest";
import { z } from "zod";

const userSchema = z.object({
  id: z.string(),
  email: z.string(),
});

// Create a client to send and receive events
export const inngest = new Inngest({
  id: "starmode-sworks",
  schemas: new EventSchemas().fromZod({
    /**
     * Hello world
     */
    "test/hello.world": {
      data: z.object({
        animal: z.string(),
      }),
      user: userSchema,
    },
  }),
});
