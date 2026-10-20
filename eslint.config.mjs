import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Eval runners are deliberately CommonJS so the CLI can load them without a TS loader.
  {
    files: ["evals/**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build output from the Vercel CLI. Minified bundles are not source, and
    // linting them buries real findings under thousands of false ones.
    ".vercel/**",
    "drizzle/**",
    "evals/artifacts/**",
  ]),
]);

export default eslintConfig;
