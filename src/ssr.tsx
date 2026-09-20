/// <reference types="vinxi/types/server" />
import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";
import { getRouterManifest } from "@tanstack/react-start/router-manifest";
import { eventHandler, getWebRequest } from "vinxi/http";
import { createRouter } from "./router";
import { oauthMetadata, oauthOptions } from "./server/auth/mcp";
import { METADATA_PATH } from "./server/auth/config";
const render = createStartHandler({ createRouter, getRouterManifest })(
  (context) => defaultStreamHandler(context),
);
// This version of Start mounts file API routes only under /api. Public OAuth
// discovery belongs at the origin root, so handle it before page rendering.
export default eventHandler((event) => {
  const request = getWebRequest(event);
  const path = new URL(request.url).pathname;
  if (
    path === METADATA_PATH ||
    path === "/.well-known/oauth-protected-resource"
  ) {
    if (process.env.AUTH0_DISABLED === "true")
      return new Response("OAuth is disabled", { status: 503 });
    if (request.method === "OPTIONS") return oauthOptions();
    if (request.method === "GET") return oauthMetadata();
    return new Response(null, {
      status: 405,
      headers: { Allow: "GET, OPTIONS" },
    });
  }
  return render(event);
});
