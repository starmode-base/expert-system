import { createAPIFileRoute } from "@tanstack/react-start/api";
import { logout } from "~/server/auth/web";
export const APIRoute = createAPIFileRoute("/api/auth/logout")({
  POST: ({ request }) => logout(request),
});
