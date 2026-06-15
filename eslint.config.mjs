import next from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "src/generated/**",
      "prisma/**",
      "*.config.*",
      "next-env.d.ts",
    ],
  },
  ...next,
  ...nextTypescript,
  ...tseslint.configs.recommended,
  prettier, // MUST be last — disables ESLint stylistic rules that conflict with Prettier
];
