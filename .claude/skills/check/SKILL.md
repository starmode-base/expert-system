---
name: check
description: Run TypeScript type check, ESLint, and Prettier formatting. Always run this check before returning code to the user.
---

Run all code quality checks and formatting:

```bash
npx tsc --noEmit && bun run lint && bun run format
```

This runs TypeScript type checking, ESLint with auto-fix, and Prettier formatting across the project.
