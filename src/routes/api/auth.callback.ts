import { createAPIFileRoute } from "@tanstack/react-start/api";
import { callback } from "~/server/auth/web";
export const APIRoute = createAPIFileRoute("/api/auth/callback")({
  GET: ({ request }) => callback(request),
});
