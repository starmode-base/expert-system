import { createAPIFileRoute } from "@tanstack/react-start/api";
import { handleMcpRequest } from "~/server/mcp/handler";

const handle = ({ request }: { request: Request }) => handleMcpRequest(request);

export const APIRoute = createAPIFileRoute("/api/mcp")({
  GET: handle,
  POST: handle,
  DELETE: handle,
  PUT: handle,
  PATCH: handle,
  OPTIONS: handle,
  HEAD: handle,
});
