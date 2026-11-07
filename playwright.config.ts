import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

/**
 * Load .env before importing the validated env module (Node does not
 * auto-load .env the way Next.js does). Same pattern as the
 * integration tests.
 */
function loadEnvFile(): void {
  try {
    const content = readFileSync(join(process.cwd(), ".env"), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1");
      if (key && !(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* ignore */
  }
}
loadEnvFile();

// E2E_BASE_URL targets a deployed instance (Slice 5.3); unset ⇒ local.
// APP_URL is read directly (it is the only value the config needs);
// src/env.ts stays the authority for everything else.
const appUrl = process.env.E2E_BASE_URL || process.env.APP_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: appUrl },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: appUrl,
        reuseExistingServer: !process.env.CI,
      },
});
