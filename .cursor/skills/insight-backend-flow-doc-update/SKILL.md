---
name: insight-backend-flow-doc-update
description: Updates INSIGHT_GENERATION_BACKEND_FLOW.md with accurate, concise changes to the backend flow description. Use when the user asks to update INSIGHT_GENERATION_BACKEND_FLOW.md.
---

# Insight Backend Flow Doc Update

## Quick start

When asked to update `INSIGHT_GENERATION_BACKEND_FLOW.md`:

1. Read the doc to find the relevant section.
2. Update only the affected stages, triggers, or tables.
3. Keep edits concise and in the existing tone and structure.
4. If a flow changes, update the matching Mermaid diagram.
5. If code entry points change, update the “Quick where to look in code” list.

## Editing guidance

- Prefer small, scoped edits over rewrites.
- Preserve headings, bullets, and formatting unless the structure is changing.
- Use the same terminology already in the doc (stage, pipeline, inputs, outputs).
- If accuracy depends on code, read the relevant file before changing the doc.
- Avoid adding speculative details; stick to verified behavior.

## Example

**Change request**: "Add a new daily scraper trigger to Stage 1 ingestion."

**Edit pattern**:
- Add a new bullet in “Stage 1: Document ingestion” under **Inputs**.
- If the trigger affects the diagram, add a new Mermaid node/edge.

