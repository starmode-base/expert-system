import { createAPIFileRoute } from "@tanstack/react-start/api";
import { login } from "~/server/auth/web";
export const APIRoute = createAPIFileRoute("/api/auth/login")({
  GET: ({ request }) => login(request),
});
