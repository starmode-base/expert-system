<proposed_plan>

# Expert System Plugin for Claude Code and Codex

## Summary

Convert the repository into one portable plugin that works in Claude Code and Codex, with shared skills and a single remote MCP server. The three skill summaries—research, macro, and financials—will be visible in initial agent context; individual MCP tool schemas will remain discoverable on demand to control context size.

OAuth availability is the release gate. Plugin integration begins only after
the MCP endpoint supports OAuth. The authoritative implementation specification
is the sibling [Auth0 OAuth 2.1 plan](./expert-system-mcp-oauth-plan.md).

## Order of Operations

1. **Freeze the cross-client contract**

   - Retain the plugin ID and MCP server name `expert-system`.
   - Keep the existing endpoint: `https://expert-system.starmode.dev/api/mcp`.
   - Define the 11 current MCP tools as the initial supported surface.
   - Set the release target to `2.0.0` because installation, authentication, and execution change materially.

2. **Complete the OAuth server milestone**

   - Implement and validate the sibling
     [Auth0 OAuth 2.1 plan](./expert-system-mcp-oauth-plan.md).
   - Make OAuth available on the production MCP endpoint.
   - Confirm that both Codex and Claude Code can discover authentication, sign in, reconnect, refresh an expired session, and sign out.
   - Keep API keys only for REST `/api/v1`; MCP is OAuth-only.
   - Do not begin plugin integration or end-to-end testing until this gate passes.

3. **Create the dual-client plugin package**

   - Add canonical portable `plugin.json` and `mcp.json` files following the [Agent Plugins format](https://developers.openai.com/plugins/build/plugins).
   - Keep `.claude-plugin/plugin.json` for Claude Code and `.codex-plugin/plugin.json` as a Codex compatibility overlay.
   - Add `.mcp.json` for Claude Code, pointing at the same remote HTTP MCP endpoint.
   - Remove `userConfig.api_key` and all hardcoded authorization headers.
   - Do not use Claude’s `alwaysLoad`; capability routing through skills is the intended initial-context behavior.
   - Move the Claude marketplace manifest from root `marketplace.json` to `.claude-plugin/marketplace.json` and use the documented GitHub source form.

4. **Convert the existing skills from REST to MCP**

   - Preserve the shared `skills/research`, `skills/macro`, and `skills/financials` paths so both clients use the same instructions.
   - Rewrite each skill around MCP tool sequences rather than direct `/api/v1` requests.
   - Give each skill a concise, trigger-rich description so its capability is visible and routable from initial context.
   - Add `agents/openai.yaml` to all three skills, declaring the `expert-system` MCP dependency and user-facing metadata as described in the [Codex skill guidance](https://developers.openai.com/plugins/build/skills).
   - Preserve the existing Claude command names where possible: `/expert-system:research`, `/expert-system:macro`, and `/expert-system:financials`.

5. **Map workflows to tools**

   - Research: `search_takeaways` → `get_takeaways` → optional `get_document_content`; use `get_recent_takeaways` for recent-feed requests.
   - Macro: `list_macro_series` when resolution is needed, followed by `get_macro_observations`.
   - Financials: discover supported metrics as needed, then use single- or multi-metric company-financial tools and return source provenance.
   - Define consistent responses for empty results, ambiguity, pagination, partial batch failures, and unavailable tools.
   - Preserve source links and document provenance in user-facing answers.

6. **Validate through GitHub before directory submission**

   - Run both manifest validators and repository-level static checks.
   - Install Claude Code directly from the GitHub marketplace and install the Codex package from a clean checkout through a temporary personal marketplace.
   - Test clean profiles so previously cached MCP or skill registrations cannot mask packaging failures.
   - Publish a GitHub prerelease, run a short interoperability soak, then tag the stable `2.0.0` release.
   - After the GitHub release is stable, submit it to the Claude plugin marketplace and the OpenAI universal plugin directory.

7. **Update documentation and release operations**
   - Replace the Claude-only/API-key README with separate Claude Code and Codex installation sections.
   - Describe OAuth sign-in only from the user’s perspective.
   - Document the three capabilities, expected permission prompts, update/uninstall steps, and `/mcp` troubleshooting.
   - Add the privacy, terms, support, and repository metadata required by the public directories.
   - Monitor MCP connection/authentication failures, skill-routing misses, tool errors, and regressions after release; retain the previous Git tag as the rollback point.

## Public Interfaces and Repository Shape

```text
plugin.json
mcp.json
.mcp.json
.claude-plugin/
  plugin.json
  marketplace.json
.codex-plugin/
  plugin.json
skills/
  research/
    SKILL.md
    agents/openai.yaml
  macro/
    SKILL.md
    agents/openai.yaml
  financials/
    SKILL.md
    agents/openai.yaml
README.md
```

The portable MCP declaration will identify `expert-system` as a remote `streamable-http` server. Claude’s `.mcp.json` will declare the equivalent HTTP connection. Neither configuration will contain tokens, client secrets, or user-specific headers.

## Test Plan

- Validate every JSON/YAML manifest and ensure names, versions, URLs, and descriptions remain synchronized.
- Run `claude plugin validate .` plus the Codex plugin validator.
- Verify clean installation, removal, upgrade from v1, and reinstall in both clients.
- Confirm each capability activates from representative natural-language requests and unrelated prompts do not activate it.
- Confirm the skill summaries are initially available while MCP tool schemas are discovered only when needed.
- Exercise every documented tool chain with successful, empty, ambiguous, paginated, and partially failed responses.
- Verify source attribution and financial period semantics.
- At a high level, test first sign-in, reconnect, expired-session recovery, cancellation, logout, and denied authorization in both clients.
- Confirm no API keys, bearer tokens, or credentials are stored in the repository or plugin configuration.

## Assumptions and Defaults

- One repository and one shared set of skills will serve both clients; there will not be separate Claude and Codex forks.
- OAuth is mandatory for the v2 plugin release and is completed before plugin integration begins.
- Deferred MCP schemas are intentional; the initial-context requirement is satisfied through concise skill metadata, not eager-loading all 11 tools.
- Existing REST API-key users remain supported; MCP and the distributed plugin expose OAuth only.
- GitHub is the first distribution and validation channel; public marketplace submissions follow a successful stable release.
  </proposed_plan>
