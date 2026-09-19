import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { authenticateApiRequest } from "~/server/quota";
import { runOperation } from "~/server/public-api/operation";
import {
  mcpInstructions,
  toolDefinitions,
  toolInputSchema,
  toolOperation,
} from "./tools";

const registrations = toolDefinitions.map((tool) => ({
  ...tool,
  inputSchema: toolInputSchema(tool.discoverySchema ?? tool.schema),
  operation: toolOperation(tool),
}));

export async function handleMcpRequest(request: Request): Promise<Response> {
  const auth = await authenticateApiRequest(request, {
    structuredErrors: true,
  });
  if (auth.type === "error") return auth.response;

  // The identity is captured by this request only, never a shared server/global.
  // The adapter owns discovery, protocol negotiation and HTTP method handling.
  const handler = createMcpHandler(
    (server) => {
      for (const tool of registrations) {
        server.registerTool(
          tool.name,
          {
            description: tool.description,
            inputSchema: tool.inputSchema,
            annotations: {
              readOnlyHint: true,
              destructiveHint: false,
              idempotentHint: false,
              openWorldHint: true,
            },
          },
          async (input) => {
            const outcome = await runOperation(
              tool.operation,
              auth.userId,
              input,
            );
            // Round-trip dates/undefined exactly as REST JSON serialization does.
            const text = JSON.stringify(outcome.body);
            const body: unknown = JSON.parse(text);
            return {
              content: [{ type: "text", text }],
              structuredContent: z.record(z.string(), z.unknown()).parse(body),
              ...(outcome.status >= 400 ? { isError: true } : {}),
              _meta: {
                httpStatus: outcome.status,
                ...(outcome.headers ? { httpHeaders: outcome.headers } : {}),
              },
            };
          },
        );
      }
    },
    {
      serverInfo: { name: "expert-system", version: "1.0.0" },
      instructions: mcpInstructions,
      maxSubscriptions: 0,
    },
  );
  const response = await handler(request);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
