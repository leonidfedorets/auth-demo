import { defineConfig } from "@playwright/test";

// Use PLAYWRIGHT_BASE_URL env var to target prod: PLAYWRIGHT_BASE_URL=https://auth-demo-rouge.vercel.app npx playwright test
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const IS_REMOTE = BASE_URL.startsWith("https://");

export default defineConfig({
  testDir: "./tests",
  timeout: 45000,
  retries: IS_REMOTE ? 1 : 0,
  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders: { "Content-Type": "application/json" },
    ignoreHTTPSErrors: false,
  },
  // Only spin up local server when not targeting remote
  ...(IS_REMOTE ? {} : {
    webServer: {
      command: "npm run start",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 60000,
    },
  }),
});
