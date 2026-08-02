import { createAPIFileRoute } from "@tanstack/react-start/api";
import { z } from "zod";
import {
  financialMetricIds,
  isFinancialMetricId,
  type FinancialMetricId,
} from "~/server/financials/catalog";
import {
  FinancialApiError,
  invalidFinancialRequest,
} from "~/server/financials/errors";
import { runFinancialRoute, zodIssueMessage } from "~/server/financials/http";
import { getBatchFinancialMetrics } from "~/server/financials/service";

const batchRequestSchema = z
  .object({
    symbol: z.string().trim().min(1),
    metrics: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(financialMetricIds.length),
    period: z.enum(["quarterly", "annual"]).default("quarterly"),
    limit: z.number().int().min(1).max(40).default(8),
    include: z.literal("provenance").optional(),
  })
  .strict()
  .refine((body) => new Set(body.metrics).size === body.metrics.length, {
    path: ["metrics"],
    message: "metrics must be unique",
  });

export const APIRoute = createAPIFileRoute("/api/v1/financials")({
  POST: ({ request }) =>
    runFinancialRoute(request, async () => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        throw invalidFinancialRequest("Invalid JSON body");
      }

      const parsed = batchRequestSchema.safeParse(body);
      if (!parsed.success) {
        throw invalidFinancialRequest(zodIssueMessage(parsed.error));
      }

      const unknownMetric = parsed.data.metrics.find(
        (metric) => !isFinancialMetricId(metric),
      );
      if (unknownMetric) {
        throw new FinancialApiError(
          "METRIC_NOT_FOUND",
          `Unknown financial metric: ${unknownMetric}`,
          404,
        );
      }

      return getBatchFinancialMetrics(
        parsed.data.symbol,
        parsed.data.metrics as FinancialMetricId[],
        {
          period: parsed.data.period,
          limit: parsed.data.limit,
          includeProvenance: parsed.data.include === "provenance",
        },
      );
    }),
});
