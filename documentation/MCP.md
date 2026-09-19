# MCP interface

Connect an HTTP MCP client to `https://expert-system.starmode.dev/api/mcp`
(or `/api/mcp` on your local/preview host). Send the existing API key in
`Authorization: Bearer esak_<your-key>`. No OAuth, Redis, extra deployment,
plugin, or skill installation is required.

The server's discovery instructions and tool schemas include all operation
mappings, canonical financial IDs and common aliases, macro discovery,
transformation semantics, dates, units, citations, and bounded document reads.
The same operation functions validate, charge quota, and execute for REST and MCP;
neither transport sends HTTP requests back to the application.

## Client configuration

For Codex, set `EXPERT_SYSTEM_API_KEY` in the client environment and add:

```toml
[mcp_servers.expert-system]
url = "https://expert-system.starmode.dev/api/mcp"
bearer_token_env_var = "EXPERT_SYSTEM_API_KEY"
```

For Claude Code, use an HTTP MCP server entry (environment substitution keeps the
key out of the configuration):

```json
{
  "mcpServers": {
    "expert-system": {
      "type": "http",
      "url": "https://expert-system.starmode.dev/api/mcp",
      "headers": { "Authorization": "Bearer ${EXPERT_SYSTEM_API_KEY}" }
    }
  }
}
```

For protected Vercel previews, additionally supply the
`x-vercel-protection-bypass` header from your automation bypass secret. That
header does not replace the API key. Do not commit either secret.

## Wire contract

| REST                                       | MCP tool                       |
| ------------------------------------------ | ------------------------------ |
| GET /api/v1/takeaways/search               | search_takeaways               |
| GET /api/v1/takeaways/recent               | get_recent_takeaways           |
| GET /api/v1/takeaways                      | get_takeaways                  |
| GET /api/v1/documents                      | get_documents                  |
| GET /api/v1/documents/{documentId}/content | get_document_content           |
| GET /api/v1/macro/series                   | list_macro_series              |
| POST /api/v1/macro/observations            | get_macro_observations         |
| GET /api/v1/financials/metrics             | list_financial_metrics         |
| GET /api/v1/financials/{symbol}/metrics    | list_company_financial_metrics |
| GET /api/v1/financials/{symbol}/{metric}   | get_company_financial_metric   |
| POST /api/v1/financials                    | get_company_financials         |

Names are unchanged; REST path parameters become arguments, `ids` uses a native
array, and `recent` uses a boolean. GET numeric arguments are native numbers.
POST arguments match the JSON body. Defaults, bounds, clamping, requested order,
provenance, and partial results come from shared operations.

`structuredContent` contains the REST JSON body; a text block contains that same
serialized JSON. Application errors set `isError: true` and preserve the body,
including financial codes and macro partial-failure details. `_meta.httpStatus`
carries the equivalent REST status; `_meta.httpHeaders` carries response headers
when present. The MCP transport itself can return HTTP 200 for a tool error.
Malformed protocol messages and unknown methods/tools remain SDK protocol errors.

Authentication runs on every HTTP request, so revocation takes effect on the next
request. Identity is captured in a request-local handler. Authentication, request
validation, discovery, initialization, and protocol errors consume no quota.
Valid operations count once, including catalogs, partial results, missing
resources, and provider failures. REST and MCP share monthly allowances and
endpoint buckets; all financial tools use `financials`. Over-quota attempts are
still recorded, and unlimited users still have usage tracked.

The SDK's Standard Schema hook advertises precise JSON schemas while deferring
application validation to the shared operations. This preserves REST error bodies
and statuses rather than replacing them with SDK validation messages. MCP native
argument types are checked before charging. Financial discovery enums are derived
from the canonical catalog, while batch validation retains REST whitespace
normalization and duplicate detection.

## Dependencies and protocol support

Verified against current upstream documentation on 2026-09-19 and locked to
`mcp-handler` **2.2.0**, `@modelcontextprotocol/server` **2.0.0**, with the existing
Zod v4 dependency and project Node 22 engine.

- [MCP TypeScript SDK v2](https://ts.sdk.modelcontextprotocol.io/v2/)
- [SDK HTTP serving](https://ts.sdk.modelcontextprotocol.io/v2/serving/http.html)
- [SDK Standard Schema support](https://ts.sdk.modelcontextprotocol.io/v2/advanced/schema-libraries.html)
- [Vercel adapter documentation](https://github.com/vercel-labs/mcp-handler)
- [Codex HTTP MCP configuration](https://developers.openai.com/codex/mcp/)

The adapter handles current `2026-07-28` discovery and older Streamable HTTP
initialization on the same stateless endpoint. No session store is used. HTTP
methods are delegated to the adapter, including 405 responses for GET/DELETE.
Subscriptions are disabled. The removed 2024 HTTP+SSE transport is not exposed.
Current raw HTTP callers must include the protocol's per-request `_meta` envelope
and matching `Mcp-Method` / `Mcp-Name` headers; use an MCP client to manage these.

## Verification and rollout

Run:

```sh
npx tsc --noEmit && bun run lint && bun run format
npx vitest run
VERCEL_ENV=preview npx --yes --package=node@22 --call 'vinxi build'
```

Use the direct Vinxi build for local packaging verification: `bun run build`
also runs `drizzle-kit migrate`. This feature requires no database migration.
TanStack generates the API route manifest through its normal dev/build workflow.

Automated tests use the real MCP adapter for all 11 operations across
`2026-07-28`, `2025-11-25`, and `2025-03-26`. They compare REST bodies, status
metadata, validation errors, defaults, bounds, partial/provider failures and quota
buckets. Billing tests exercise real key authentication and quota code with an
in-memory database substitute, including key revocation, the 100-request boundary,
unlimited tracking, over-quota attempts, and concurrent caller isolation.

Local Inspector discovery (strict schema validation) passes in modern and legacy
modes, and its financial catalog call succeeds against the running TanStack app
with an existing key. A real Codex client retrieves UNRATE from macro discovery. Claude Code 2.1.109
connects successfully and discovers all 11 tools; its model-driven tool-call
check is blocked by an invalid Anthropic OAuth access token (401), unrelated to
the MCP API key. The Node 22 build generates a streaming-enabled Node 22 Vercel
function with the MCP route.

Vercel CLI credentials are unavailable in this environment, so preview variables,
deployment protection and the preview database target cannot be verified. The
branch-specific `vercel.json` rule disables automatic deployment of
`codex/mcp-interface`; other branches keep their existing behavior. Before enabling
this branch's preview, verify the project's Node 22 runtime, provider variables,
automation bypass header, function configuration, and especially that the build's
`DATABASE_URL` migration target is an isolated preview database. Remove that branch
rule once the preflight is complete. Local packaging is not a deployment.

Production deployment, production checks, merge and rollback are intentionally
left to a separately authorized rollout.
