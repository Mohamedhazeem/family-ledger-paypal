import { defineConfig } from "@playwright/test";
import { env } from "./src/env";

const appUrl = env.APP_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: appUrl },
  webServer: {
    command: "npm run dev",
    url: appUrl,
    reuseExistingServer: !process.env.CI,
  },
});
