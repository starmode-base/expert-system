export function authConfig() {
  if (process.env.AUTH0_DISABLED === "true")
    throw new Error("Authentication is disabled for this environment");
  const required = (name: string) => {
    const value = process.env[name];
    if (!value) throw new Error(`Missing ${name}`);
    return value;
  };
  return {
    issuer: new URL(required("AUTH0_ISSUER")).href,
    clientId: required("AUTH0_WEB_CLIENT_ID"),
    resource: required("AUTH0_MCP_RESOURCE"),
    origin: new URL(required("SITE_ORIGIN")).origin,
  };
}
export const MCP_SCOPE = "expert-system:read";
export const METADATA_PATH = "/.well-known/oauth-protected-resource/api/mcp";
