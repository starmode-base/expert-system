// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import hooksPlugin from "eslint-plugin-react-hooks";
import pluginRouter from "@tanstack/eslint-plugin-router";
import { FlatCompat } from "@eslint/eslintrc";

// https://eslint.org/docs/latest/use/configure/migration-guide
// https://www.npmjs.com/package/@eslint/eslintrc
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default tseslint.config(
  {
    ignores: ["*.mjs", ".vinxi/*", ".output/*", ".vercel/*"],
  },

  // https://eslint.org/docs/latest/rules
  eslint.configs.recommended,

  // https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/src/configs/strict-type-checked.ts
  tseslint.configs.strictTypeChecked,

  // https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/src/configs/stylistic-type-checked.ts
  tseslint.configs.stylisticTypeChecked,

  // https://github.com/jsx-eslint/eslint-plugin-react?tab=readme-ov-file#list-of-supported-rules
  reactPlugin.configs.flat["jsx-runtime"],

  // https://github.com/facebook/react/tree/main/packages/eslint-plugin-react-hooks
  hooksPlugin.configs["recommended-latest"],

  // https://tanstack.com/router/latest/docs/eslint/eslint-plugin-router
  ...pluginRouter.configs["flat/recommended"],

  // https://www.npmjs.com/package/@inngest/eslint-plugin
  ...compat.plugins("@inngest"),
  ...compat.extends("plugin:@inngest/recommended"),

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    rules: {
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { ignoreRestSiblings: true },
      ],
      // https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/src/configs/strict-type-checked.ts#L93-L103
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowAny: false,
          allowBoolean: false,
          allowNever: false,
          allowNullish: false,
          allowNumber: true,
          allowRegExp: false,
        },
      ],
      eqeqeq: "error",
      "guard-for-in": "error",
      "no-duplicate-imports": "error",
      "no-useless-rename": "error",
      "object-shorthand": "error",
      "react/jsx-no-leaked-render": "error",
      "react/no-unescaped-entities": "off",
      "react/self-closing-comp": "error",
    },
  },

  {
    ignores: [
      "app.config.ts",
      "src/api.ts",
      "src/ssr.tsx",
      "drizzle.config.ts",
    ],
    rules: {
      "no-restricted-exports": [
        "error",
        { restrictDefaultExports: { direct: true } },
      ],
    },
  },

  {
    files: ["app/routes/**/*.tsx"],
    rules: {
      "@typescript-eslint/only-throw-error": "off",
    },
  },

  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-unsafe-argument": "off",
    },
  },
);
