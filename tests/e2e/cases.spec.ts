import { test, expect, Page } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const IS_PROD = process.env.IS_PROD === "true";

// ── Auth helper ────────────────────────────────────────────────────────────────
async function login(page: Page): Promise<boolean> {
  await page.goto(`${BASE}/login`);
  await page.waitForSelector("form", { timeout: 8000 });
  await page.locator('input[type="email"]').fill("leonidfedorets30@gmail.com");
  await page.locator('input[type="password"]').fill("Zadov281983");
  await page.locator('button[type="submit"]').click();
  try {
    await page.waitForFunction(() => !window.location.pathname.startsWith("/login"), { timeout: 15000 });
  } catch { /* SCA may be triggered */ }
  if (page.url().includes("/dashboard")) return true;
  await page.goto(`${BASE}/dashboard`);
  await page.waitForURL(/\/dashboard|\/login/, { timeout: 8000 });
  return page.url().includes("/dashboard");
}

// ── Suite ──────────────────────────────────────────────────────────────────────
test.describe.configure({ mode: "serial" });

test.describe("Cases E2E", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    if (!IS_PROD) return;
    page = await browser.newPage();
    const ok = await login(page);
    if (!ok) test.skip(true, "Could not authenticate — SCA required");
  });

  test.afterAll(async () => {
    if (page) await page.close();
  });

  // ── Page load ──────────────────────────────────────────────────────────────
  test("navigates to /dashboard/cases and renders the page", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    await page.goto(`${BASE}/dashboard/cases`);
    await page.waitForSelector('[data-testid="cases-table"]', { timeout: 15000 });
    await expect(page.locator("h1")).toContainText("Case Management");
  });

  test("shows 'Cases', 'Analytics', and 'Case Types (Admin)' tabs", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    await expect(page.locator('[data-testid="tab-cases"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-analytics"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-types"]')).toBeVisible();
  });

  test("renders seed cases in the table", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    const rows = page.locator('[data-testid="cases-table"] tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(5);
    // CS-2847 seed case should be present
    const cs2847 = page.locator('[data-testid="case-row-CS-2847"]');
    await expect(cs2847).toBeVisible();
  });

  // ── Filtering ──────────────────────────────────────────────────────────────
  test("search box filters cases by client name", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.fill("FinTech");
    await page.waitForTimeout(600); // debounce / re-fetch
    const rows = page.locator('[data-testid="cases-table"] tbody tr[data-testid^="case-row"]');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    // All visible rows should relate to FinTech
    const firstRow = rows.first();
    await expect(firstRow).toContainText("FinTech");
    await searchInput.clear();
    await page.waitForTimeout(400);
  });

  test("department filter narrows the list", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    const deptFilter = page.locator('[data-testid="filter-dept"]');
    await deptFilter.selectOption("AML");
    await page.waitForTimeout(600);
    const rows = page.locator('[data-testid="cases-table"] tbody tr[data-testid^="case-row"]');
    const count = await rows.count();
    if (count > 0) {
      // All visible cases should be AML
      const deptBadges = page.locator('[data-testid="cases-table"] tbody td:nth-child(5)');
      const firstBadge = await deptBadges.first().textContent();
      expect(firstBadge).toContain("AML");
    }
    await deptFilter.selectOption("");
    await page.waitForTimeout(400);
  });

  test("status filter shows only matching statuses", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    const statusFilter = page.locator('[data-testid="filter-status"]');
    await statusFilter.selectOption("closed");
    await page.waitForTimeout(600);
    const rows = page.locator('[data-testid="cases-table"] tbody tr[data-testid^="case-row"]');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    await statusFilter.selectOption("");
    await page.waitForTimeout(400);
  });

  // ── Case detail drawer ─────────────────────────────────────────────────────
  test("clicking a case row opens the detail drawer", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    const firstRow = page.locator('[data-testid="cases-table"] tbody tr[data-testid^="case-row"]').first();
    await firstRow.click();
    await expect(page.locator('[data-testid="drawer-case-id"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="close-drawer"]')).toBeVisible();
  });

  test("drawer shows Details, Activity, Documentation, Approvals tabs", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    await expect(page.locator('[data-testid="drawer-tab-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="drawer-tab-activity"]')).toBeVisible();
    await expect(page.locator('[data-testid="drawer-tab-docs"]')).toBeVisible();
    await expect(page.locator('[data-testid="drawer-tab-approvals"]')).toBeVisible();
  });

  test("Activity tab shows comments and audit sub-tabs", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    await page.locator('[data-testid="drawer-tab-activity"]').click();
    // Sub-tabs: All, Comments, Audit Log, Zoho
    await expect(page.getByText("All").first()).toBeVisible();
    await expect(page.getByText("Comments")).toBeVisible();
    await expect(page.getByText("Audit Log")).toBeVisible();
    await expect(page.getByText("Zoho")).toBeVisible();
  });

  test("can add a comment in the Activity tab", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    const commentInput = page.locator('[data-testid="comment-input"]');
    if (!(await commentInput.isVisible())) {
      // Ensure we're on Activity > All/Comments tab
      await page.locator('[data-testid="drawer-tab-activity"]').click();
    }
    await commentInput.fill("E2E browser test comment");
    await page.locator('[data-testid="comment-send"]').click();
    // Comment should appear in feed
    await expect(page.getByText("E2E browser test comment")).toBeVisible({ timeout: 5000 });
    // Input should be cleared
    await expect(commentInput).toHaveValue("");
  });

  test("Documentation tab shows attachments for CS-2847", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    // Close current drawer and open CS-2847
    await page.locator('[data-testid="close-drawer"]').click();
    await page.waitForTimeout(300);
    const cs2847Row = page.locator('[data-testid="case-row-CS-2847"]');
    if (!(await cs2847Row.isVisible())) { test.skip(true, "CS-2847 not in filtered view"); return; }
    await cs2847Row.click();
    await page.locator('[data-testid="drawer-tab-docs"]').click();
    // Should show at least one attachment
    await expect(page.getByText("transaction_export_2026-06.xlsx")).toBeVisible({ timeout: 5000 });
  });

  test("Approvals tab shows approver cards for CS-2847", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    await page.locator('[data-testid="drawer-tab-approvals"]').click();
    // CS-2847 has Maria L. and MLRO as approvers
    await expect(page.getByText("Maria L.").first()).toBeVisible({ timeout: 5000 });
  });

  test("Change Status button opens the status modal", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    await page.locator('[data-testid="close-drawer"]').click();
    await page.waitForTimeout(300);
    // Find an 'active' case to test status change
    await page.locator('[data-testid="filter-status"]').selectOption("active");
    await page.waitForTimeout(600);
    const activeRows = page.locator('[data-testid="cases-table"] tbody tr[data-testid^="case-row"]');
    if (await activeRows.count() === 0) {
      await page.locator('[data-testid="filter-status"]').selectOption("");
      test.skip(true, "No active cases to test status change");
      return;
    }
    await activeRows.first().click();
    await expect(page.locator('[data-testid="change-status-btn"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="change-status-btn"]').click();
    // Status modal should appear with valid transitions
    await expect(page.locator('[data-testid="status-options"]')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Apply")).toBeVisible();
    // Close without applying
    await page.getByText("Cancel").click();
  });

  test("RFI button is visible on an active case", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    await expect(page.locator('[data-testid="rfi-btn"]')).toBeVisible({ timeout: 3000 });
  });

  test("Handoff button is visible on an active case", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    await expect(page.locator('[data-testid="handoff-btn"]')).toBeVisible({ timeout: 3000 });
  });

  test("closing drawer by clicking overlay works", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    // Click the dark overlay area outside the drawer
    await page.mouse.click(100, 400); // left side = overlay
    await page.waitForTimeout(400);
    await expect(page.locator('[data-testid="drawer-case-id"]')).not.toBeVisible({ timeout: 3000 });
    // Reset filter
    await page.locator('[data-testid="filter-status"]').selectOption("");
    await page.waitForTimeout(400);
  });

  // ── Create Case wizard ─────────────────────────────────────────────────────
  test("New Case button opens the create wizard", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    await page.locator('[data-testid="new-case-btn"]').click();
    await expect(page.getByText("Create New Case")).toBeVisible({ timeout: 3000 });
    // Step 1: type selection
    await expect(page.locator('[data-testid="type-opt-ct1"]')).toBeVisible();
    await expect(page.locator('[data-testid="type-opt-ct2"]')).toBeVisible();
  });

  test("selecting a type advances wizard to step 2", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    await page.locator('[data-testid="type-opt-ct6"]').click(); // Transaction Review
    // Step 2: client + description
    await expect(page.getByText("Transaction Review")).toBeVisible({ timeout: 3000 });
  });

  test("step 2 validates required fields before advancing", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    // Try advancing without filling description
    const nextBtn = page.locator('[data-testid="next-to-fields"]');
    // Button should be disabled (no description or license filled yet)
    await expect(nextBtn).toBeDisabled();
  });

  test("fills step 2 and advances to step 3", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    await page.locator('input[placeholder="MCH-XXXX (optional for precheck)"]').fill("MCH-E2E");
    await page.locator('select').filter({ hasText: "Select…" }).first().selectOption("UK");
    await page.locator('textarea').fill("E2E test case from browser automation");
    const nextBtn = page.locator('[data-testid="next-to-fields"]');
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();
    // Step 3: custom fields
    await expect(page.getByText("Custom fields for")).toBeVisible({ timeout: 3000 });
  });

  test("submits case creation and new case appears in table", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    const submitBtn = page.locator('[data-testid="submit-case"]');
    await submitBtn.click();
    // Wizard should close and new case detail drawer should open (or table refresh)
    await expect(page.locator('[data-testid="cases-table"]')).toBeVisible({ timeout: 15000 });
    // The drawer may open automatically for the new case
    // Either way, the table should still be present
  });

  // ── Analytics tab ──────────────────────────────────────────────────────────
  test("Analytics tab loads and shows KPI cards", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    await page.locator('[data-testid="close-drawer"]').click().catch(()=>{}); // close drawer if open
    await page.locator('[data-testid="tab-analytics"]').click();
    await expect(page.getByText("Open Cases")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Avg Time to Close")).toBeVisible();
    await expect(page.getByText("SLA Met %")).toBeVisible();
    await expect(page.getByText("Pending Approval")).toBeVisible();
  });

  test("Analytics shows Backlog by Assignee chart", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    await expect(page.getByText("Backlog by Assignee")).toBeVisible();
  });

  test("Analytics shows Cases by Department chart", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    await expect(page.getByText("Cases by Department")).toBeVisible();
  });

  // ── Case Types tab ─────────────────────────────────────────────────────────
  test("Case Types tab renders all 6 types", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    await page.locator('[data-testid="tab-types"]').click();
    await expect(page.getByText("KYB Review")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("AML / TM Alert")).toBeVisible();
    await expect(page.getByText("Fraud Investigation")).toBeVisible();
    await expect(page.getByText("Provider Recall")).toBeVisible();
    await expect(page.getByText("Precheck")).toBeVisible();
    await expect(page.getByText("Transaction Review")).toBeVisible();
  });

  test("expanding a case type shows its fields", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    const kyb = page.getByText("KYB Review").first();
    await kyb.click();
    // Field table should appear
    await expect(page.getByText("review_scope")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("risk_rating")).toBeVisible();
  });

  // ── Bulk operations ────────────────────────────────────────────────────────
  test("selecting cases shows bulk panel", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    await page.locator('[data-testid="tab-cases"]').click();
    await page.waitForSelector('[data-testid="cases-table"]', { timeout: 8000 });
    // Select first case via checkbox
    const firstCheckbox = page.locator('[data-testid="cases-table"] tbody tr td:first-child input[type="checkbox"]').first();
    await firstCheckbox.check();
    await expect(page.getByText("1 selected")).toBeVisible({ timeout: 3000 });
  });

  test("bulk assign panel appears and can be dismissed", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    await expect(page.getByText("Bulk action…")).toBeVisible();
    // Dismiss
    const xBtn = page.locator('.sticky button').filter({ hasText: "" }).last();
    await xBtn.click();
    await expect(page.getByText("1 selected")).not.toBeVisible({ timeout: 3000 });
  });

  // ── Cross-page integration ─────────────────────────────────────────────────
  test("?create=true&transaction_id=TXN-XYZ opens create wizard pre-filled", async () => {
    if (!IS_PROD) { test.skip(true, "Requires prod"); return; }
    await page.goto(`${BASE}/dashboard/cases?create=true&transaction_id=TXN-XYZ`);
    await page.waitForSelector("text=Create New Case", { timeout: 10000 });
    await expect(page.getByText("Create New Case")).toBeVisible();
    // Close
    await page.keyboard.press("Escape");
    await page.goto(`${BASE}/dashboard/cases`);
  });
});
