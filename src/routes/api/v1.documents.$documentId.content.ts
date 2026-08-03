import { createAPIFileRoute } from "@tanstack/react-start/api";
import { z } from "zod";
import { getDocumentContent } from "~/server/public-api/research";
import { authorizeApiRequest } from "~/server/quota";

const querySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .transform((value) => Math.min(value, 30_000))
    .default(12_000),
});

function invalidRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

export const APIRoute = createAPIFileRoute(
  "/api/v1/documents/$documentId/content",
)({
  GET: async ({ request, params }) => {
    const auth = await authorizeApiRequest(request, "documents.content");
    if (auth.type === "error") return auth.response;

    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      offset: url.searchParams.get("offset") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success) {
      return invalidRequest(
        parsed.error.issues.map((issue) => issue.message).join(", "),
      );
    }

    const result = await getDocumentContent(
      params.documentId,
      parsed.data.offset,
      parsed.data.limit,
    );
    if (!result) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }
    if (parsed.data.offset > result.item.content.totalCharacters) {
      return invalidRequest("offset exceeds document length");
    }

    return Response.json(result);
  },
});
