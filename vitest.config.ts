import path from "node:path";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // `server-only` throws outside a React Server Component; tests run in
      // Node, so alias it to an empty stub. Next.js builds keep the real guard.
      "server-only": path.resolve(process.cwd(), "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: [],
    globals: true,
    exclude: ["**/node_modules/**","**/dist/**","tests/e2e/**"],
  },
});
