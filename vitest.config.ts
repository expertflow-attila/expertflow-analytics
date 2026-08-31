import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Integration tests hit a real Postgres and must not run concurrently
    // against the same schema.
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
});
