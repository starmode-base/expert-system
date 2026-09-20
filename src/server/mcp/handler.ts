import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { authenticateMcpRequest, oauthOptions } from "~/server/auth/mcp";
import { authConfig, MCP_SCOPE, METADATA_PATH } from "~/server/auth/config";
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
  if (process.env.AUTH0_DISABLED === "true")
    return new Response("OAuth requires a stable environment.", {
      status: 503,
    });
  if (request.method === "OPTIONS") return oauthOptions();
  const auth = await authenticateMcpRequest(request);
  if (auth.type === "error") return auth.response;

  // The identity is captured by this request only, never a shared server/global.
  // The adapter owns discovery, protocol negotiation and HTTP method handling.
  const handler = createMcpHandler(
    (server) => {
      server.registerTool(
        "get_profile",
        {
          description:
            "The authenticated user's profile. Does not consume quota.",
          inputSchema: z.object({}).strict(),
          outputSchema: z
            .object({
              id: z
                .string()
                .min(1)
                .regex(/\S/)
                .describe(
                  "Opaque profile identifier, unique within this app and unchanged across token refresh, reconnection, and display-metadata changes. Never reassigned to another profile.",
                ),
              email: z
                .string()
                .describe(
                  "Email address for display; not used as the profile identity.",
                )
                .optional(),
              name: z
                .string()
                .describe("Display name for the authenticated profile.")
                .optional(),
              nickname: z
                .string()
                .describe(
                  "A useful label that helps users distinguish connected profiles.",
                )
                .optional(),
            })
            .strict(),
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
          _meta: { "openai/profile": true },
        },
        () => {
          const profile = {
            id: auth.userId,
            ...(auth.user.email ? { email: auth.user.email } : {}),
            ...(auth.user.displayName ? { name: auth.user.displayName } : {}),
            ...(auth.user.nickname ? { nickname: auth.user.nickname } : {}),
          };
          return {
            content: [{ type: "text", text: JSON.stringify(profile) }],
            structuredContent: profile,
          };
        },
      );
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
  const response = await withMcpAuth(handler, () => auth.info, {
    required: true,
    requiredScopes: [MCP_SCOPE],
    resourceMetadataPath: METADATA_PATH,
    resourceUrl: authConfig().resource,
  })(request);
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
