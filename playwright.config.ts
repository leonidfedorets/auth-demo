// @ts-check
import { defineConfig } from "@playwright/test";

// npm run test:prod  → targets https://auth-demo-rouge.vercel.app
// npm run test:api   → targets http://localhost:3000 (run npm start first)
const BASE_URL = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:3000";
const IS_REMOTE = BASE_URL.startsWith("https://");

// Pass env vars to worker processes via process.env (set before require)
process.env["PLAYWRIGHT_BASE_URL"] = BASE_URL;
process.env["IS_PROD"] = IS_REMOTE ? "true" : "false";

export default defineConfig({
  testDir: "./tests",
  timeout: 45000,
  retries: IS_REMOTE ? 1 : 0,
  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders: { "Content-Type": "application/json" },
    ignoreHTTPSErrors: false,
  },
  ...(IS_REMOTE
    ? {}
    : {
        webServer: {
          command: "npm run start",
          url: "http://localhost:3000",
          reuseExistingServer: true,
          timeout: 60000,
        },
      }),
});
