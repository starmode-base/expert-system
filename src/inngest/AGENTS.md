# Inngest agents

## OpenAI Agents SDK tool schemas

When defining tool parameter schemas with Zod for the OpenAI Agents SDK (`@openai/agents`), **all fields must be required** when `strict: true` is set. This is an OpenAI Structured Outputs constraint.

- Use `.nullable()` instead of `.optional()` for fields the model can omit. The model will send `null` instead of leaving the key out.
- In the tool's `execute` function, convert `null` back to `undefined` with `?? undefined` before passing values to downstream functions that expect `T | undefined`.

```ts
// Correct — works with strict: true
const params = z.object({
  name: z.string().describe("Required field"),
  units: z
    .enum(["lin", "chg", "pch"])
    .nullable()
    .describe("Pass null for default"),
});

// In execute:
execute: async (args) => {
  return await someFunction(args.name, args.units ?? undefined);
};
```

Reference: https://platform.openai.com/docs/guides/structured-outputs#all-fields-must-be-required
