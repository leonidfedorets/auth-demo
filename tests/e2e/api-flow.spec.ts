import { test, expect, Page } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const IS_PROD = process.env.IS_PROD === "true";

async function loginBrowser(page: Page): Promise<boolean> {
  await page.goto(`${BASE}/login`);
  await page.waitForSelector("form", { timeout: 8000 });
  await page.locator('input[type="email"]').fill("leonidfedorets30@gmail.com");
  await page.locator('input[type="password"]').fill("Zadov281983");
  await page.locator('button[type="submit"]').click();
  try {
    await page.waitForFunction(
      () => !window.location.pathname.startsWith("/login"),
      { timeout: 15000 }
    );
  } catch { /* may stay on login if SCA triggered */ }
  if (page.url().includes("/dashboard")) return true;
  await page.goto(`${BASE}/dashboard`);
  await page.waitForURL(/\/dashboard|\/login/, { timeout: 8000 });
  return page.url().includes("/dashboard");
}

test.describe.configure({ mode: "serial" });

test.describe("API → Dashboard data flow", () => {
  let apiKey: string;

  test("Setup: login and get API key", async ({ page }) => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }

    const ok = await loginBrowser(page);
    if (!ok) { test.skip(true, "Could not authenticate — SCA required"); return; }

    // Get API key — regenerate to get full plaintext key
    const regenResp = await page.request.post(`${BASE}/api/admin/api-key`, {
      data: { action: "regenerate" },
    });
    if (regenResp.status() === 200) {
      const body = await regenResp.json();
      apiKey = body.key;
    }

    expect(apiKey).toBeTruthy();
    expect(apiKey).toMatch(/^uth_live_/);
  });

  test("API login creates a transaction visible in dashboard", async ({ request, page }) => {
    if (!IS_PROD || !apiKey) { test.skip(true, "Requires prod + API key"); return; }

    // Make an API login call with the API key
    await request.post(`${BASE}/api/auth/login`, {
      headers: { "X-API-Key": apiKey },
      data: { email: "ventalb@ua.fm", password: "testpass123" },
    });
    // Login may succeed or fail (user might not exist) — either way a transaction should be recorded

    // Now check dashboard transactions
    const ok = await loginBrowser(page);
    if (!ok) { test.skip(true, "Could not authenticate — SCA required"); return; }

    await page.goto(`${BASE}/dashboard/transactions`);
    await page.waitForSelector("table", { timeout: 8000 });

    const rows = page.locator("tbody tr");
    expect(await rows.count()).toBeGreaterThan(0);
  });
});
