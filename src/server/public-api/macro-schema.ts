import { z } from "zod";
import {
  fredAggregationMethods,
  fredFrequencies,
  fredSeriesIds,
  fredUnits,
} from "~/server/fred-data-api/fred-api";
import { getInvalidFrequencyMessage } from "~/server/fred-data-api/service";
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
  if (!isoDatePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

const seriesRequestSchema = z
  .object({
    id: z.enum(fredSeriesIds),
    lastN: z.number().int().min(1).max(120).optional(),
    startDate: z
      .string()
      .refine(isValidIsoDate, "must be YYYY-MM-DD")
      .optional(),
    endDate: z.string().refine(isValidIsoDate, "must be YYYY-MM-DD").optional(),
    units: z.enum(fredUnits).optional(),
    frequency: z.enum(fredFrequencies).optional(),
    aggregationMethod: z.enum(fredAggregationMethods).optional(),
  })
  .strict()
  .superRefine((request, context) => {
    const hasStart = request.startDate !== undefined;
    const hasEnd = request.endDate !== undefined;
    if (hasStart !== hasEnd) {
      context.addIssue({
        code: "custom",
        message: "startDate and endDate must be provided together",
      });
    }
    if (hasStart && request.lastN !== undefined) {
      context.addIssue({
        code: "custom",
        message: "lastN cannot be combined with a date range",
      });
    }
    if (
      request.startDate &&
      request.endDate &&
      request.startDate > request.endDate
    ) {
      context.addIssue({
        code: "custom",
        message: "startDate must not be after endDate",
      });
    }
    if (request.aggregationMethod && !request.frequency) {
      context.addIssue({
        code: "custom",
        path: ["aggregationMethod"],
        message: "aggregationMethod requires frequency",
      });
    }
    const frequencyMessage = getInvalidFrequencyMessage(request);
    if (frequencyMessage) {
      context.addIssue({
        code: "custom",
        path: ["frequency"],
        message: frequencyMessage,
      });
    }
  });

export const macroRequestSchema = z
  .object({
    series: z.array(seriesRequestSchema).min(1).max(5),
  })
  .strict()
  .refine(
    (body) =>
      new Set(body.series.map((request) => request.id)).size ===
      body.series.length,
    { path: ["series"], message: "series IDs must be unique" },
  );
