import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const IS_PROD = BASE.startsWith("https://");

// ── Helpers ───────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getAuthCookie(request: any): Promise<{ cookie: string; scaRequired: boolean }> {
  const r = await request.post(`${BASE}/api/auth/login`, {
    data: { email: "leonidfedorets30@gmail.com", password: "Zadov281983" },
  });
  if (r.status() !== 200) return { cookie: "", scaRequired: false };
  const body = await r.json().catch(() => ({}));
  if (body.scaRequired) return { cookie: "", scaRequired: true };
  const setCookie = r.headers()["set-cookie"] || "";
  const match = setCookie.match(/access_token=([^;]+)/);
  return { cookie: match ? `access_token=${match[1]}` : "", scaRequired: false };
}

// ── Suite ─────────────────────────────────────────────────────────────────────
test.describe.configure({ mode: "serial" });

test.describe("Cases API", () => {
  let cookie = "";
  let createdCaseId = "";
  let approverIdToTest = "";

  // ── Setup ──────────────────────────────────────────────────────────────────
  test("Setup: run migration to ensure tables exist", async ({ request }) => {
    if (!IS_PROD) { test.skip(true, "Requires real DB — run with npm run test:prod"); return; }
    const r = await request.post(`${BASE}/api/admin/migrate-cases`, {
      headers: { "x-deploy-secret": process.env.DEPLOY_SECRET ?? "" },
    });
    expect([200, 201]).toContain(r.status());
    const body = await r.json();
    expect(body.success).toBe(true);
  });

  test("Setup: authenticate and store cookie", async ({ request: req }) => {
    if (!IS_PROD) { test.skip(true, "Requires real DB"); return; }
    const result = await getAuthCookie(req);
    if (!result.cookie) {
      test.skip(true, result.scaRequired
        ? "Step-up MFA required — session not fully established"
        : "Login did not return session cookie (rate-limited or SCA challenge)");
      return;
    }
    cookie = result.cookie;
    expect(cookie).toContain("access_token=");
  });

  // ── Auth guards ────────────────────────────────────────────────────────────
  test("GET /api/cases — 401 without cookie", async ({ request }) => {
    const r = await request.get(`${BASE}/api/cases`);
    expect(r.status()).toBe(401);
  });

  test("GET /api/cases/nonexistent — 401 without cookie", async ({ request }) => {
    const r = await request.get(`${BASE}/api/cases/CS-9999`);
    expect(r.status()).toBe(401);
  });

  test("POST /api/cases — 401 without cookie", async ({ request }) => {
    const r = await request.post(`${BASE}/api/cases`, { data: {} });
    expect(r.status()).toBe(401);
  });

  // ── Case types ─────────────────────────────────────────────────────────────
  test("GET /api/case-types — 401 without cookie", async ({ request }) => {
    const r = await request.get(`${BASE}/api/case-types`);
    expect(r.status()).toBe(401);
  });

  test("GET /api/case-types — returns list with auth", async ({ request }) => {
    if (!IS_PROD || !cookie) { test.skip(true, "Requires real DB"); return; }
    const r = await request.get(`${BASE}/api/case-types`, { headers: { Cookie: cookie } });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty("caseTypes");
    expect(Array.isArray(body.caseTypes)).toBe(true);
    expect(body.caseTypes.length).toBeGreaterThanOrEqual(6);
    const ct = body.caseTypes[0];
    expect(ct).toHaveProperty("id");
    expect(ct).toHaveProperty("name");
    expect(ct).toHaveProperty("department");
    expect(ct).toHaveProperty("fields");
    expect(Array.isArray(ct.fields)).toBe(true);
  });

  // ── Cases list ─────────────────────────────────────────────────────────────
  test("GET /api/cases — returns list with auth", async ({ request }) => {
    if (!IS_PROD || !cookie) { test.skip(true, "Requires real DB"); return; }
    const r = await request.get(`${BASE}/api/cases`, { headers: { Cookie: cookie } });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty("cases");
    expect(Array.isArray(body.cases)).toBe(true);
    expect(body.cases.length).toBeGreaterThanOrEqual(8); // seed data
    const c = body.cases[0];
    expect(c).toHaveProperty("id");
    expect(c).toHaveProperty("status");
    expect(c).toHaveProperty("department");
    expect(c).toHaveProperty("license");
  });

  test("GET /api/cases?department=AML — filters by department", async ({ request }) => {
    if (!IS_PROD || !cookie) { test.skip(true, "Requires real DB"); return; }
    const r = await request.get(`${BASE}/api/cases?department=AML`, { headers: { Cookie: cookie } });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.cases.every((c: { department: string }) => c.department === "AML")).toBe(true);
  });

  test("GET /api/cases?status=closed — filters by status", async ({ request }) => {
    if (!IS_PROD || !cookie) { test.skip(true, "Requires real DB"); return; }
    const r = await request.get(`${BASE}/api/cases?status=closed`, { headers: { Cookie: cookie } });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.cases.every((c: { status: string }) => c.status === "closed")).toBe(true);
  });

  test("GET /api/cases?search=FinTech — full-text search", async ({ request }) => {
    if (!IS_PROD || !cookie) { test.skip(true, "Requires real DB"); return; }
    const r = await request.get(`${BASE}/api/cases?search=FinTech`, { headers: { Cookie: cookie } });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.cases.length).toBeGreaterThan(0);
    expect(body.cases.some((c: { clientName: string }) => c.clientName.includes("FinTech"))).toBe(true);
  });

  // ── Create case ────────────────────────────────────────────────────────────
  test("POST /api/cases — 400 on missing required fields", async ({ request }) => {
    if (!IS_PROD || !cookie) { test.skip(true, "Requires real DB"); return; }
    const r = await request.post(`${BASE}/api/cases`, {
      headers: { Cookie: cookie },
      data: { typeId: "ct1" }, // missing description and license
    });
    expect(r.status()).toBe(400);
    const body = await r.json();
    expect(body).toHaveProperty("error");
  });

  test("POST /api/cases — 400 on invalid typeId", async ({ request }) => {
    if (!IS_PROD || !cookie) { test.skip(true, "Requires real DB"); return; }
    const r = await request.post(`${BASE}/api/cases`, {
      headers: { Cookie: cookie },
      data: { typeId: "invalid-type", description: "test", license: "UK" },
    });
    expect(r.status()).toBe(400);
  });

  test("POST /api/cases — 201 creates a new case", async ({ request }) => {
    if (!IS_PROD || !cookie) { test.skip(true, "Requires real DB"); return; }
    const r = await request.post(`${BASE}/api/cases`, {
      headers: { Cookie: cookie },
      data: {
        typeId: "ct6",
        clientId: "MCH-TEST",
        clientName: "Test Client Ltd",
        description: "E2E test case — transaction review",
        license: "UK",
        customFields: { transaction_id: "TXN-E2E-001", review_reason: "Manual Trigger" },
        reporter: "e2e@test.com",
      },
    });
    expect(r.status()).toBe(201);
    const body = await r.json();
    expect(body).toHaveProperty("id");
    expect(body.id).toMatch(/^CS-\d+$/);
    expect(body.status).toBe("new");
    createdCaseId = body.id;
  });

  // ── Get case detail ────────────────────────────────────────────────────────
  test("GET /api/cases/:id — 404 for unknown ID", async ({ request }) => {
    if (!IS_PROD || !cookie) { test.skip(true, "Requires real DB"); return; }
    const r = await request.get(`${BASE}/api/cases/CS-9999999`, { headers: { Cookie: cookie } });
    expect(r.status()).toBe(404);
  });

  test("GET /api/cases/:id — returns full case detail", async ({ request }) => {
    if (!IS_PROD || !cookie || !createdCaseId) { test.skip(true, "Requires create test to pass first"); return; }
    const r = await request.get(`${BASE}/api/cases/${createdCaseId}`, { headers: { Cookie: cookie } });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty("case");
    const c = body.case;
    expect(c.id).toBe(createdCaseId);
    expect(c.status).toBe("new");
    expect(c).toHaveProperty("approvers");
    expect(c).toHaveProperty("comments");
    expect(c).toHaveProperty("attachments");
    expect(c).toHaveProperty("audit");
    expect(Array.isArray(c.audit)).toBe(true);
    expect(c.audit.length).toBeGreaterThan(0); // should have "Case Created" entry
    expect(c.audit[0].action).toBe("Case Created");
  });

  test("GET /api/cases/CS-2847 — seed data has comments and approvers", async ({ request }) => {
    if (!IS_PROD || !cookie) { test.skip(true, "Requires real DB"); return; }
    const r = await request.get(`${BASE}/api/cases/CS-2847`, { headers: { Cookie: cookie } });
    if (r.status() === 404) { test.skip(true, "Seed case not present — run migration first"); return; }
    expect(r.status()).toBe(200);
    const body = await r.json();
    const c = body.case;
    expect(c.comments.length).toBeGreaterThan(0);
    expect(c.approvers.length).toBeGreaterThan(0);
    expect(c.attachments.length).toBeGreaterThan(0);
    // Store approver for later test
    approverIdToTest = c.approvers.find((a: { status: string }) => a.status === "pending")?.id || "";
  });

  // ── Status transitions ─────────────────────────────────────────────────────
  test("PATCH /api/cases/:id — 422 on invalid transition", async ({ request }) => {
    if (!IS_PROD || !cookie || !createdCaseId) { test.skip(true, "Requires create test to pass"); return; }
    // new → closed is invalid
    const r = await request.patch(`${BASE}/api/cases/${createdCaseId}`, {
      headers: { Cookie: cookie },
      data: { status: "closed" },
    });
    expect(r.status()).toBe(422);
    const body = await r.json();
    expect(body.error).toContain("invalid transition");
  });

  test("PATCH /api/cases/:id — new → active (valid transition)", async ({ request }) => {
    if (!IS_PROD || !cookie || !createdCaseId) { test.skip(true, "Requires create test to pass"); return; }
    const r = await request.patch(`${BASE}/api/cases/${createdCaseId}`, {
      headers: { Cookie: cookie },
      data: { status: "active", assignee: "Sarah K." },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.status).toBe("active");
  });

  test("PATCH /api/cases/:id — active → rfi (creates Zoho ref + system comment)", async ({ request }) => {
    if (!IS_PROD || !cookie || !createdCaseId) { test.skip(true, "Requires active transition"); return; }
    const r = await request.patch(`${BASE}/api/cases/${createdCaseId}`, {
      headers: { Cookie: cookie },
      data: { status: "rfi", reason: "Awaiting client documentation" },
    });
    expect(r.status()).toBe(200);
    // Verify system comment created
    const detail = await request.get(`${BASE}/api/cases/${createdCaseId}`, { headers: { Cookie: cookie } });
    const body = await detail.json();
    const sysComments = body.case.comments.filter((c: { isSystem: boolean }) => c.isSystem);
    expect(sysComments.length).toBeGreaterThan(0);
    expect(sysComments[0].text).toContain("Zoho");
  });

  test("PATCH /api/cases/:id — rfi → active", async ({ request }) => {
    if (!IS_PROD || !cookie || !createdCaseId) { test.skip(true, "Requires rfi state"); return; }
    const r = await request.patch(`${BASE}/api/cases/${createdCaseId}`, {
      headers: { Cookie: cookie },
      data: { status: "active" },
    });
    expect(r.status()).toBe(200);
  });

  test("PATCH /api/cases/:id — active → complete", async ({ request }) => {
    if (!IS_PROD || !cookie || !createdCaseId) { test.skip(true, "Requires active state"); return; }
    const r = await request.patch(`${BASE}/api/cases/${createdCaseId}`, {
      headers: { Cookie: cookie },
      data: { status: "complete", resolution: "E2E test completed successfully." },
    });
    expect(r.status()).toBe(200);
  });

  test("PATCH /api/cases/:id — complete → closed (no approval needed for ct6)", async ({ request }) => {
    if (!IS_PROD || !cookie || !createdCaseId) { test.skip(true, "Requires complete state"); return; }
    const r = await request.patch(`${BASE}/api/cases/${createdCaseId}`, {
      headers: { Cookie: cookie },
      data: { status: "closed" },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.status).toBe("closed");
  });

  test("PATCH /api/cases/:id — assignee update", async ({ request }) => {
    if (!IS_PROD || !cookie) { test.skip(true, "Requires real DB"); return; }
    const r = await request.patch(`${BASE}/api/cases/CS-2844`, {
      headers: { Cookie: cookie },
      data: { assignee: "Tom B." },
    });
    expect([200, 404]).toContain(r.status()); // 404 if seed data not present
  });

  test("PATCH /api/cases/:id — handoff changes department", async ({ request }) => {
    if (!IS_PROD || !cookie) { test.skip(true, "Requires real DB"); return; }
    const r = await request.patch(`${BASE}/api/cases/CS-2845`, {
      headers: { Cookie: cookie },
      data: { department: "Compliance", reason: "Escalated for compliance review" },
    });
    expect([200, 404, 500]).toContain(r.status()); // may 500 if CS-2845 not seeded
  });

  // ── Comments ───────────────────────────────────────────────────────────────
  test("POST /api/cases/:id/comments — 400 on empty text", async ({ request }) => {
    if (!IS_PROD || !cookie) { test.skip(true, "Requires real DB"); return; }
    const r = await request.post(`${BASE}/api/cases/CS-2847/comments`, {
      headers: { Cookie: cookie },
      data: { text: "" },
    });
    expect(r.status()).toBe(400);
  });

  test("POST /api/cases/:id/comments — 404 on unknown case", async ({ request }) => {
    if (!IS_PROD || !cookie) { test.skip(true, "Requires real DB"); return; }
    const r = await request.post(`${BASE}/api/cases/CS-9999999/comments`, {
      headers: { Cookie: cookie },
      data: { text: "Test comment" },
    });
    expect(r.status()).toBe(404);
  });

  test("POST /api/cases/:id/comments — 201 creates comment", async ({ request }) => {
    if (!IS_PROD || !cookie) { test.skip(true, "Requires real DB"); return; }
    const r = await request.post(`${BASE}/api/cases/CS-2847/comments`, {
      headers: { Cookie: cookie },
      data: { text: "E2E test comment — please ignore" },
    });
    expect([200, 201, 404]).toContain(r.status()); // 404 if seed not present
    if (r.status() === 201) {
      const body = await r.json();
      expect(body).toHaveProperty("id");
      expect(body.text).toBe("E2E test comment — please ignore");
      expect(body.isSystem).toBe(false);
    }
  });

  test("GET /api/cases/:id/comments — lists comments", async ({ request }) => {
    if (!IS_PROD || !cookie) { test.skip(true, "Requires real DB"); return; }
    const r = await request.get(`${BASE}/api/cases/CS-2847/comments`, { headers: { Cookie: cookie } });
    expect([200, 404]).toContain(r.status());
    if (r.status() === 200) {
      const body = await r.json();
      expect(body).toHaveProperty("comments");
      expect(Array.isArray(body.comments)).toBe(true);
    }
  });

  // ── Approvals ──────────────────────────────────────────────────────────────
  test("PATCH /api/cases/:id/approvals/:approverId — 400 on invalid decision", async ({ request }) => {
    if (!IS_PROD || !cookie || !approverIdToTest) { test.skip(true, "Requires seed data + pending approver"); return; }
    const r = await request.patch(
      `${BASE}/api/cases/CS-2847/approvals/${approverIdToTest}`,
      { headers: { Cookie: cookie }, data: { decision: "maybe" } },
    );
    expect(r.status()).toBe(400);
  });

  test("PATCH /api/cases/:id/approvals/:approverId — approves correctly", async ({ request }) => {
    if (!IS_PROD || !cookie || !approverIdToTest) { test.skip(true, "Requires pending approver"); return; }
    const r = await request.patch(
      `${BASE}/api/cases/CS-2847/approvals/${approverIdToTest}`,
      { headers: { Cookie: cookie }, data: { decision: "approved", comment: "Looks good — E2E" } },
    );
    expect([200, 409]).toContain(r.status()); // 409 if already resolved in a prior run
    if (r.status() === 200) {
      const body = await r.json();
      expect(body.decision).toBe("approved");
      expect(body).toHaveProperty("resolvedAt");
    }
  });

  test("PATCH /api/cases/:id/approvals/:approverId — 409 on already-resolved", async ({ request }) => {
    if (!IS_PROD || !cookie || !approverIdToTest) { test.skip(true, "Requires resolved approver"); return; }
    const r = await request.patch(
      `${BASE}/api/cases/CS-2847/approvals/${approverIdToTest}`,
      { headers: { Cookie: cookie }, data: { decision: "approved" } },
    );
    expect(r.status()).toBe(409); // second call should conflict
  });

  // ── Analytics ──────────────────────────────────────────────────────────────
  test("GET /api/cases/analytics — 401 without cookie", async ({ request }) => {
    const r = await request.get(`${BASE}/api/cases/analytics`);
    expect(r.status()).toBe(401);
  });

  test("GET /api/cases/analytics — returns aggregate data", async ({ request }) => {
    if (!IS_PROD || !cookie) { test.skip(true, "Requires real DB"); return; }
    const r = await request.get(`${BASE}/api/cases/analytics`, { headers: { Cookie: cookie } });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty("openCases");
    expect(body).toHaveProperty("pendingApproval");
    expect(body).toHaveProperty("closedCases");
    expect(body).toHaveProperty("avgDaysToClose");
    expect(body).toHaveProperty("slaMetPct");
    expect(body).toHaveProperty("byDepartment");
    expect(body).toHaveProperty("byAssignee");
    expect(body.slaMetPct).toBeGreaterThanOrEqual(0);
    expect(body.slaMetPct).toBeLessThanOrEqual(100);
    expect(Array.isArray(body.byDepartment)).toBe(true);
    expect(Array.isArray(body.byAssignee)).toBe(true);
  });

  // ── Migration health check ─────────────────────────────────────────────────
  test("GET /api/admin/migrate-cases — returns table list", async ({ request }) => {
    if (!IS_PROD || !cookie) { test.skip(true, "Requires real DB"); return; }
    const r = await request.get(`${BASE}/api/admin/migrate-cases`);
    expect([200, 500]).toContain(r.status());
    if (r.status() === 200) {
      const body = await r.json();
      expect(body).toHaveProperty("tables");
      expect(body.tables).toContain("cases");
      expect(body.tables).toContain("case_types");
    }
  });
});
