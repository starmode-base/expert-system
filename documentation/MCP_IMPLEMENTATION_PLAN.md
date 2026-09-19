# MCP implementation plan

## Prerequisite: API validation before quota

Ship the REST validation-order change as a separate PR before implementing MCP.
This PR splits authentication from quota enforcement, preserves authentication-first
responses, and moves request validation ahead of usage accounting in all public
data routes. No database migration is required.

The billing contract for both interfaces is:

1. Authenticate the API key.
2. Decode and validate request inputs, including JSON bodies and canonical metric IDs.
3. Charge and enforce the existing endpoint quota.
4. Execute the operation and format its response.

Authentication and request-validation failures do not count. Valid operations,
including provider failures and partial results, count once. Resource-dependent
errors discovered during execution (missing documents, offsets beyond actual
document length, unresolved companies, unavailable metrics) still count. Existing
over-quota attempt accounting and free/unlimited plan behavior remain unchanged.

The MCP follow-up must reuse this contract rather than implement another billing policy.

## Shared operations and interface parity

Add a transport-independent operation layer with shared validation, defaults,
execution, result types, and existing quota identifiers. REST and MCP call services
directly; neither should make HTTP requests back into this application.

| REST operation                             | MCP tool                       |
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

Preserve REST URLs, response bodies, error envelopes, ordering, defaults, limits,
clamping, provenance options, and partial-success behavior. Keep the company metric
catalog routing workaround. MCP uses native arrays for IDs and a boolean for
recent; path parameters become tool arguments.

Return REST-equivalent JSON in MCP structured content and a serialized text block.
Application failures become MCP tool errors with the original error body and
equivalent HTTP status metadata.

## MCP hosting and authentication

Mount /api/mcp in the existing TanStack/Vercel app using compatible, locked versions
of mcp-handler v2 and @modelcontextprotocol/server v2. Support current MCP and the
adapter's older Streamable HTTP compatibility path. Use stateless request handling
and delegate HTTP method handling to the adapter.

Reuse Bearer API-key authentication and request-local identity. Protocol discovery,
initialization compatibility, and protocol errors are free. Catalog tool calls
are billed like their REST equivalents. Both interfaces share the same monthly
allowance and endpoint buckets, including the financials bucket.

Include field mappings and common aliases in tool descriptions and schemas, derive
financial enums from the existing catalog, and provide macro series discovery.
Document transformations, dates, units, citations, and bounded document reads.
No separate skill download, Redis, additional deployment, OAuth, or marketplace
packaging is required for this release.

## Verification and rollout

- Add REST/MCP parity tests for all 11 operations, defaults, limits, errors,
  response shapes, and usage accounting.
- Test authentication, revoked keys, free-tier boundaries, unlimited tracking,
  concurrent user isolation, protocol discovery, and both protocol generations.
- Run TypeScript, lint, formatting, and relevant tests. Let TanStack generate routes
  through its normal workflow.
- Deploy through the existing Git-connected Vercel project. Check preview variables,
  deployment protection, function configuration, and the build-time migration target
  before triggering a preview.
- Verify with MCP Inspector and real Claude Code/Codex clients. Use the Vercel
  automation bypass header for protected previews.
- Verify production discovery, tool execution, revocation, logs, and latency;
  use Vercel deployment rollback if needed.

Acceptance: agents can use every public data operation with only the MCP URL and
an existing API key, and REST/MCP validation and billing cannot drift independently.
