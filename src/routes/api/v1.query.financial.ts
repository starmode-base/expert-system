import { createAPIFileRoute } from "@tanstack/react-start/api";
import { run } from "@openai/agents";
import { z } from "zod";
import { authenticate } from "~/server/api-keys";
import { createQueryFinancialAgent } from "~/inngest/insights/agents/query-financial-agent";

const apiError = (message: string, status: number) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const APIRoute = createAPIFileRoute("/api/v1/query/financial")({
  POST: async ({ request }) => {
    const userId = await authenticate(request);
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError("Invalid JSON body", 400);
    }

    const query =
      typeof body === "object" &&
      body !== null &&
      "query" in body &&
      typeof (body as Record<string, unknown>).query === "string"
        ? ((body as Record<string, unknown>).query as string).trim()
        : "";

    if (!query) {
      return apiError("Missing required field: query", 400);
    }

    try {
      const agent = createQueryFinancialAgent();
      const result = await run(agent, query, { maxTurns: 15 });

      if (!result.finalOutput || result.finalOutput instanceof Error) {
        return apiError("Agent did not produce output", 500);
      }

      const outputSchema = z.object({
        Analysis: z.string(),
        "Supporting Data": z.string(),
      });
      const parsed = outputSchema.safeParse(result.finalOutput);
      if (!parsed.success) {
        return apiError("Agent produced invalid output", 500);
      }

      return new Response(
        JSON.stringify({
          analysis: parsed.data.Analysis,
          supportingData: parsed.data["Supporting Data"],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Query financial agent error:", error);
      return apiError("Internal server error", 500);
    }
  },
});
