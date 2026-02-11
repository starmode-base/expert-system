---
name: pr-cleanup
description: Find and remove unused code on the current branch before merging. Use when the user asks to clean up a PR, remove dead code, or find unused exports/functions on a branch.
---

# PR Cleanup

Find and remove dead code introduced (or left behind) by the current branch.

## Steps

1. **Get the branch diff:**

```bash
git diff origin/main...HEAD --stat
git diff origin/main...HEAD
```

2. **Identify candidates** — scan the diff for:

   - Old functions/exports that were replaced by new ones (e.g. `queryFoo` replaced by `queryFooPaginated`)
   - Planning artifacts (e.g. `*_PLAN.md`, scratch files) that were used during development

3. **Verify each candidate is truly unused** — for every function/export/file identified, search the codebase for remaining callers:

```bash
# Search for callers outside the definition file
rg "functionName" --glob "**/*.{ts,tsx}"
```

If the only hit is the definition itself, it's dead code.

4. **Remove dead code:**

   - Delete unused function/export bodies
   - Remove orphaned imports that were only needed by the deleted code
   - Delete planning or scratch files

5. **Run checks:**

```bash
npx tsc --noEmit && bun run lint && bun run format
```

Fix any errors introduced by the removals before finishing.
