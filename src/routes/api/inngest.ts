/**
 * Discord thread about standing up Inngest with TanStack Start and Vercel:
 * https://discord.com/channels/842170679536517141/1324205318690832446
 *
 * This approach did not work when deployed to Vercel:
 * https://discord.com/channels/842170679536517141/1324205318690832446/1326578673498718319
 *
 * This approach does work:
 * https://github.com/inngest/inngest-tanstack-start-example/blob/main/app/routes/api/inngest.ts
 *
 * See also configuration of Vercel serverless functions `maxDuration` in
 * app.config.ts and at:
 * https://discord.com/channels/719702312431386674/1334599711075864577/1334603005139484685
 *
 * Other notes about Vercel serverless functions configuration:
 * https://vercel.com/docs/functions/configuring-functions/duration
 * https://vercel.com/docs/errors/error-list#unmatched-function-pattern
 */
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { inngest } from "~/inngest/client";
import { ServeHandlerOptions, InngestCommHandler } from "inngest";
import { inngestFunctions } from "~/inngest/functions";

const serve = (options: ServeHandlerOptions) => {
  const handler = new InngestCommHandler({
    frameworkName: "tanstack-start",
    fetch: fetch.bind(globalThis),
    ...options,
    handler: (req: Request) => {
      return {
        body: () => req.json(),
        headers: (key) => req.headers.get(key),
        method: () => req.method,
        url: () => new URL(req.url, `https://${req.headers.get("host") ?? ""}`),
        transformResponse: ({ body, status, headers }) => {
          return new Response(body, { status, headers });
        },
      };
    },
  });

  const requestHandler = handler.createHandler();
  return {
    GET: ({ request }: { request: Request }) => {
      return requestHandler(request);
    },
    POST: ({ request }: { request: Request }) => {
      return requestHandler(request);
    },
    PUT: ({ request }: { request: Request }) => {
      return requestHandler(request);
    },
  };
};

export const APIRoute = createAPIFileRoute("/api/inngest")(
  serve({
    client: inngest,
    functions: inngestFunctions,
  }),
);
