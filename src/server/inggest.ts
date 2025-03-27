import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { inngest } from "~/inngest/client";
import { authMiddleware } from "~/middleware/auth-middleware";

/**
 * Aggregate server function for this route
 */
export const sendEventSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ animal: z.string() }))
  .handler(async ({ context, data }) => {
    await inngest.send({
      name: "test/hello.world.expert",
      data: {
        animal: data.animal,
      },
      user: {
        id: context.viewer.id,
        email: context.viewer.email,
      },
    });

    return context.viewer.email;
  });

export const sendEventScienceDailyScraperSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  //   .validator()
  .handler(async ({ context }) => {
    await inngest.send({
      name: "scraper/daily-science",
      user: {
        id: context.viewer.id,
        email: context.viewer.email,
      },
    });

    return context.viewer.email;
  });
