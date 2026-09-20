import { createAPIFileRoute } from "@tanstack/react-start/api";
import { backchannel } from "~/server/auth/web";
export const APIRoute = createAPIFileRoute("/api/auth/backchannel")({
  POST: ({ request }) => backchannel(request),
});
