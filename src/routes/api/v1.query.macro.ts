import { createAPIFileRoute } from "@tanstack/react-start/api";
import { run } from "@openai/agents";
import { z } from "zod";
import { authenticate } from "~/server/api-keys";
import { createQueryMacroAgent } from "~/inngest/insights/agents/query-macro-agent";

const apiError = (message: string, status: number) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const APIRoute = createAPIFileRoute("/api/v1/query/macro")({
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
      const agent = createQueryMacroAgent();
      // maxTurns: 15 — these are simple data lookups, not open-ended research.
      const result = await run(agent, query, { maxTurns: 15 });

      if (!result.finalOutput || result.finalOutput instanceof Error) {
        return apiError("Agent did not produce output", 500);
      }

      const outputSchema = z.object({
        data: z.string(),
        seriesQueried: z.array(z.string()),
      });
      const parsed = outputSchema.safeParse(result.finalOutput);
      if (!parsed.success) {
        return apiError("Agent produced invalid output", 500);
      }

      // The agent returns `data` as a JSON string (see query-macro-agent.ts for
      // why). We parse it here so the API consumer gets real structured JSON.
      // If the agent produced malformed JSON, we fall back to the raw string —
      // the consumer still gets the data, just as a string instead of an object.
      let data: unknown;
      try {
        data = JSON.parse(parsed.data.data);
      } catch {
        data = parsed.data.data;
      }

      return new Response(
        JSON.stringify({
          data,
          seriesQueried: parsed.data.seriesQueried,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Query macro agent error:", error);
      return apiError("Internal server error", 500);
    }
  },
});
