import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests for the db service layer run against a mocked Prisma client
// (vitest-mock-extended) — no database. `@/*` resolves to `src/*` to match the
// app's tsconfig path alias.
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["src/lib/db/__tests__/prismaSingleton.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
