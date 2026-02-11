# PR Wrap-Up

Run all pre-review steps for the current branch. Complete each step in order before moving to the next.

## Step 1 — PR Cleanup

Read and follow the **pr-cleanup** skill at `.cursor/skills/pr-cleanup/SKILL.md`. Remove any dead code, planning artifacts, or scratch files introduced by this branch.

## Step 2 — Check for Missing Migrations

The project uses Drizzle Kit with migrations output to `./drizzle/`. Compare the current schema (`src/postgres/schema.ts`) against the latest migration snapshot to see if a new migration is needed.

```bash
bunx drizzle-kit generate --name check-only 2>&1
```

- If it generates a new migration file, **delete** the generated file and warn me: "Schema changes detected that are not covered by a migration. Run `bun run db:generate` to create one."
- If the output says nothing to migrate, report that migrations are up to date.

Clean up any generated artifacts:

```bash
git checkout -- drizzle/
```

## Step 3 — Developer Review Notes

Analyze the full branch diff (`git diff origin/main...HEAD`) and surface a concise list of items for me to consider before merging. Look for:

- **Potential issues** — race conditions, missing error handling, unvalidated inputs, N+1 queries, hardcoded values that should be config
- **Complications** — changes that touch shared utilities or types and could affect other features, breaking API contract changes
- **Areas of opportunity** — repeated patterns that could be extracted, missing indexes on new queries, TODO/FIXME comments left in the diff, test coverage gaps
- **Schema / data concerns** — nullable columns that might need backfills, missing cascade rules, new columns without defaults on existing tables

Present these as a bulleted list grouped by category. Skip any category with no findings. Keep each bullet to one or two sentences.

## Step 4 — PR Summary

Read and follow the **pr-description** skill at `.cursor/skills/pr-description/SKILL.md`. Produce a `## Summary` and `## Test plan` for this branch.

## Step 5 — Run Checks

```bash
npx tsc --noEmit && bun run lint && bun run format
```

Report any errors so they can be fixed before the PR is opened.
