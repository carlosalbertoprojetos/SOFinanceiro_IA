import eslint from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/.next/**",
      "apps/api/src/generated/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ["apps/api/**/*.ts", "prisma.config.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["apps/api/src/**/*.module.ts"],
    rules: {
      // NestJS modules are metadata-bearing decorated classes by design.
      "@typescript-eslint/no-extraneous-class": "off",
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
);
