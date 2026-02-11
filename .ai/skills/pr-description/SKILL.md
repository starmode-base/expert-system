---
name: pr-description
description: Create clear, concise pull request descriptions from branch diffs and recent commits. Use when a user asks to draft or generate a PR description, summary, or changelog-style overview for a branch.
---

# PR Description

## Overview

Create a PR description by inspecting the branch diff and recent commits, then summarizing the user-facing intent with a minimal test plan.

## Workflow

1. Identify the base branch for the PR.
   - Default to `origin/main` if not specified
   - If a repo uses a different default (e.g. `origin/master`), use that instead
2. Collect the change set.
   - Review `git status -sb` for clean/dirty state
   - Review `git log --oneline --decorate --reverse <base>..HEAD` for commit intent
   - Review `git diff <base>...HEAD` for actual file-level changes
3. Build the PR description.
   - Use `## Summary` and `## Test plan` sections
   - Keep summary to 1-3 bullets, focused on outcomes and scope
   - Note new dependencies, scripts, or migrations explicitly
   - Call out behavior changes, error handling, or data model updates
4. Provide a test plan.
   - If tests were not run, say "Not run (not requested)"
   - If tests were run, list the exact commands

## Output Template

## Summary

- [Outcome-focused bullet]
- [Outcome-focused bullet]

## Test plan

- [e.g. Not run (not requested)]
