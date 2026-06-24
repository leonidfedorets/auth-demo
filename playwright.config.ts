import { defineConfig } from "@playwright/test";

// Target prod: npm run test:prod
// Target local: npm run test:api (requires npm run build && npm run start first)
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
  // Expose env to worker processes
  env: {
    PLAYWRIGHT_BASE_URL: BASE_URL,
    IS_PROD: IS_REMOTE ? "true" : "false",
  },
  ...(IS_REMOTE ? {} : {
    webServer: {
      command: "npm run start",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 60000,
    },
  }),
});
