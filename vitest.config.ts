import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", ".next/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/domain/**/*.ts", "src/lib/reports/service.ts", "src/lib/validation/**/*.ts"],
      thresholds: {
        // This is an intentionally conservative first ratchet below the
        // measured baseline. Raise it as additional services gain focused
        // tests; never lower it merely to make a regression pass.
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 75,
      },
    },
  },
});
