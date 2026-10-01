import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Entry point and network clients are exercised by the scheduled workflow (dry-run locally).
      exclude: ["src/main.ts", "src/perplexity.ts", "src/github.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
