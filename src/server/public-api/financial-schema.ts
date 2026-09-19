import { z } from "zod";
import { financialMetricIds } from "~/server/financials/catalog";
export const financialPeriodSchema = z.enum(["quarterly", "annual"]);
export const financialLimitSchema = z.number().int().min(1).max(40);
export const financialIncludeSchema = z.literal("provenance");

export const financialBatchSchema = z
  .object({
    symbol: z.string().trim().min(1),
    metrics: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(financialMetricIds.length),
    period: financialPeriodSchema.default("quarterly"),
    limit: financialLimitSchema.default(8),
    include: financialIncludeSchema.optional(),
  })
  .strict()
  .refine((body) => new Set(body.metrics).size === body.metrics.length, {
    path: ["metrics"],
    message: "metrics must be unique",
  });
