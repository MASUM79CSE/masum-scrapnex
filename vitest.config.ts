import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

export default defineConfig({
  define: { __PRODUCT_VERSION__: JSON.stringify(version) },
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary"],
      include: ["src/core/**", "src/browser/**", "src/ui/**"],
      // Ratchet, not an aspiration: unit coverage was 26.17 % lines when this was
      // recorded. Most behaviour is exercised through the packaged extension in
      // Playwright, which v8 coverage here cannot see, so the floor only exists to
      // stop unit coverage regressing, and it must be raised whenever it improves.
      thresholds: {
        lines: 24,
        functions: 28,
        statements: 24,
        branches: 24,
      },
    },
  },
});
