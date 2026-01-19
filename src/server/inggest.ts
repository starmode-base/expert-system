import { invariant } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { inngest } from "~/inngest/client";
import { authMiddleware } from "~/middleware/auth-middleware";

export const sendEventScienceDailyScraperSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  //   .validator()
  .handler(async ({ context }) => {
    await inngest.send({
      name: "scraper/daily-science",
      data: {},
      user: {
        id: context.viewer.id,
        email: context.viewer.email,
      },
    });

    return context.viewer.email;
  });

export const sendEventEarningsCallscraperSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      symbols: z.array(z.object({ symbol: z.string(), name: z.string() })),
      year: z.number(),
      quarter: z.number(),
    }),
  )
  .handler(async ({ context, data }) => {
    await inngest.send({
      name: "scraper/earnings-calls",
      data: {
        symbols: data.symbols,
        year: data.year,
        quarter: data.quarter,
        user: {
          id: context.viewer.id,
          email: context.viewer.email,
        },
      },

    });

    return context.viewer.email;
  });

export const sendEventGenerateTakeawaysSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      documentId: z.string(),
      takeawayPrompt: z.string().optional(),
      model: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    console.log(
      "Using OpenAI key ending in:",
      process.env.OPENAI_API_KEY?.slice(-5),
    );
    await inngest.send({
      name: "app/generate-takeaways",
      data: {
        ...data,
        user: {
          id: context.viewer.id,
          email: context.viewer.email,
        },
      },
      user: {
        id: context.viewer.id,
        email: context.viewer.email,
      },
    });

    return context.viewer.email;
  });

// app/generate-insight

export const sendEventGenerateInsightSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      seedText: z.string(),
      insightPrompt: z.string(),
      model: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    invariant(data.seedText, "seedText is required");

    await inngest.send({
      name: "app/generate-insight",
      data: {
        ...data,
        user: {
          id: context.viewer.id,
          email: context.viewer.email,
        },
      },
      user: {
        id: context.viewer.id,
        email: context.viewer.email,
      },
    });

    return context.viewer.email;
  });
