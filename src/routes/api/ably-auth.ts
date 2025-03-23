/**
 * https://ably.com/docs/auth/token?lang=javascript#token-request
 * https://vercel.com/docs/functions/runtimes#max-duration
 * https://vercel.com/docs/functions/configuring-functions/duration
 */
import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { createTokenRequest } from "~/lib/ably";
import { getViewerId } from "~/server/auth";

export const APIRoute = createAPIFileRoute("/api/ably-auth")({
  POST: async ({ request }) => {
    const viewerId = await getViewerId(request);

    if (!viewerId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const tokenRequest = await createTokenRequest(viewerId);

    return json(tokenRequest);
  },
});
