import { z } from "zod";
import {
  getDocumentContent,
  getDocumentsByIds,
  getRecentTakeawayPreviews,
  getTakeawaysByIds,
  MAX_PUBLIC_IDS,
  searchTakeawayPreviews,
} from "./research";
import { invalidInput, result, type Operation } from "./operation";

function previewLimit(value: unknown): number {
  if (
    value !== undefined &&
    typeof value !== "number" &&
    typeof value !== "string"
  )
    invalidInput("Invalid limit: must be a number");
  const limit = value === undefined || value === "" ? 10 : Number(value);
  if (Number.isNaN(limit)) invalidInput("Invalid limit: must be a number");
  return Math.min(Math.max(1, limit), 100);
}

function idsInput(value: unknown): string[] {
  if (!value) invalidInput("Missing required parameter: ids");
  const parsed = z
    .array(z.string())
    .safeParse(typeof value === "string" ? value.split(",") : value);
  if (!parsed.success) invalidInput("ids must be an array of strings");
  const ids = parsed.data.map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) invalidInput("No valid IDs provided");
  if (ids.length > MAX_PUBLIC_IDS)
    invalidInput(`Maximum ${MAX_PUBLIC_IDS} IDs per request`);
  return ids;
}

export const searchTakeaways: Operation = {
  endpoint: "takeaways.search",
  prepare(input) {
    if (!input.query) invalidInput("Missing required parameter: query");
    if (typeof input.query !== "string") invalidInput("query must be a string");
    const query = input.query;
    const limit = previewLimit(input.limit);
    const recent = input.recent === true || input.recent === "true";
    return async () =>
      result({ items: await searchTakeawayPreviews(query, { limit, recent }) });
  },
};
export const recentTakeaways: Operation = {
  endpoint: "takeaways.recent",
  prepare(input) {
    const limit = previewLimit(input.limit);
    return async () =>
      result({ items: await getRecentTakeawayPreviews(limit) });
  },
};
export const takeaways: Operation = {
  endpoint: "takeaways",
  prepare(input) {
    const ids = idsInput(input.ids);
    return async () => result({ items: await getTakeawaysByIds(ids) });
  },
};
export const documents: Operation = {
  endpoint: "documents",
  prepare(input) {
    const ids = idsInput(input.ids);
    return async () => result({ items: await getDocumentsByIds(ids) });
  },
};
export const documentOffsetSchema = z.number().int().min(0);
export const documentLimitSchema = z
  .number()
  .int()
  .min(1)
  .transform((value) => Math.min(value, 30_000));
const contentQuerySchema = z.object({
  offset: z.coerce.number().pipe(documentOffsetSchema).default(0),
  limit: z.coerce.number().pipe(documentLimitSchema).default(12_000),
});
export const documentContent: Operation = {
  endpoint: "documents.content",
  prepare(input) {
    const parsed = contentQuerySchema.safeParse(input);
    if (!parsed.success)
      invalidInput(
        parsed.error.issues.map((issue) => issue.message).join(", "),
      );
    if (typeof input.documentId !== "string")
      invalidInput("Missing required parameter: documentId");
    const documentId = input.documentId;
    return async () => {
      const response = await getDocumentContent(
        documentId,
        parsed.data.offset,
        parsed.data.limit,
      );
      if (!response) return result({ error: "Document not found" }, 404);
      if (parsed.data.offset > response.item.content.totalCharacters)
        invalidInput("offset exceeds document length");
      return result(response);
    };
  },
};
