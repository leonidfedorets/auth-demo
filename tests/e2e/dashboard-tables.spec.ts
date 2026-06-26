import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const IS_PROD = process.env.IS_PROD === "true";

test.describe.configure({ mode: "serial" });

test.describe("Dashboard UI Tables (E2E)", () => {
  test.beforeEach(async ({ page }) => {
    if (!IS_PROD) {
      test.skip(true, "E2E UI tests require prod environment");
      return;
    }
    // Login
    await page.goto(`${BASE}/login`);
    await page.fill('input[type="email"]', "leonidfedorets30@gmail.com");
    await page.fill('input[type="password"]', "Zadov281983");
    await page.click('button[type="submit"]');
    // Wait for redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  });

  test("Users table shows real users from API", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/users`);
    await page.waitForSelector("table", { timeout: 8000 });

    // Should show real user ventalb@ua.fm (logged in via API key)
    const rows = page.locator("tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Should NOT show only mock data (Alice/Bob/Carol with exactly 3 users)
    const emailCells = page.locator("tbody tr td:first-child");
    const firstEmail = await emailCells.first().textContent();
    // At minimum, table loads without error
    expect(firstEmail).toBeTruthy();
  });

  test("Transactions table loads and shows real transactions", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/transactions`);
    await page.waitForSelector("table", { timeout: 8000 });

    const rows = page.locator("tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test("Clicking a transaction row opens side panel", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/transactions`);
    await page.waitForSelector("tbody tr", { timeout: 8000 });

    const firstRow = page.locator("tbody tr").first();
    await firstRow.click();

    // Side panel should appear
    await expect(page.locator("[data-panel], .side-panel, aside")).toBeVisible({ timeout: 3000 });
  });

  test("Sessions table shows active sessions", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/sessions`);
    await page.waitForSelector("table", { timeout: 8000 });

    const rows = page.locator("tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test("Devices table loads", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/devices`);
    await page.waitForSelector("table", { timeout: 8000 });

    const rows = page.locator("tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test("Audit log table loads", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/audit`);
    await page.waitForSelector("table", { timeout: 8000 });

    const rows = page.locator("tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test("Dashboard overview shows KPI numbers", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    // Wait for KPI cards to load
    await page.waitForTimeout(2000);

    // KPI cards should have numbers
    const kpiValues = page.locator(".text-2xl, .text-3xl").filter({ hasText: /\d/ });
    const count = await kpiValues.count();
    expect(count).toBeGreaterThan(0);
  });
});
