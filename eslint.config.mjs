import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import noBarrelFiles from "eslint-plugin-no-barrel-files";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Convention enforced in lint, not prose: no barrel/re-export files.
  // Barrels add indirection depth and inflate files-touched-per-feature —
  // the opposite of the agent-velocity lever this app optimizes for.
  {
    plugins: { "no-barrel-files": noBarrelFiles },
    rules: { "no-barrel-files/no-barrel-files": "error" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
