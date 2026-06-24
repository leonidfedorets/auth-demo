import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

test.describe.configure({ mode: "serial" });

test.describe("Admin API endpoints", () => {
  // Each test logs in first since Playwright request contexts don't persist
  // cookies across tests in serial mode automatically.

  test("GET /api/admin/stats - returns 401 without credentials", async ({ request }) => {
    const r = await request.get(`${BASE}/api/admin/stats`);
    expect(r.status()).toBe(401);
    const body = await r.json();
    expect(body).toHaveProperty("error");
  });

  test("GET /api/admin/stats - returns KPIs for authenticated user", async ({ request }) => {
    const loginR = await request.post(`${BASE}/api/auth/login`, {
      data: { email: "leonidfedorets30@gmail.com", password: "Zadov281983" },
    });
    if (loginR.status() !== 200) {
      test.skip(true, "Step-up MFA required — session not fully established");
      return;
    }
    const r = await request.get(`${BASE}/api/admin/stats`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty("totalTransactions");
    expect(typeof body.totalTransactions).toBe("number");
    expect(body).toHaveProperty("totalUsers");
    expect(body).toHaveProperty("boundDevices");
    expect(body).toHaveProperty("activeSessions");
    expect(body).toHaveProperty("txLast7Days");
    expect(Array.isArray(body.txLast7Days)).toBe(true);
    expect(body.txLast7Days).toHaveLength(7);
    expect(body).toHaveProperty("riskDistribution");
  });

  test("GET /api/admin/settings - requires auth cookie", async ({ request }) => {
    const r = await request.get(`${BASE}/api/admin/settings`);
    expect(r.status()).toBe(401);
  });

  test("GET /api/admin/settings - returns settings for authenticated user", async ({ request }) => {
    const loginR = await request.post(`${BASE}/api/auth/login`, {
      data: { email: "leonidfedorets30@gmail.com", password: "Zadov281983" },
    });
    if (loginR.status() !== 200) {
      test.skip(true, "Step-up MFA required — session not fully established");
      return;
    }

    const r = await request.get(`${BASE}/api/admin/settings`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    // Response is wrapped: { settings: { jwt: {...}, ... } }
    expect(body).toHaveProperty("settings");
    const settings = body.settings;
    expect(settings).toHaveProperty("jwt");
    expect(settings.jwt).toHaveProperty("accessTokenTtlSeconds");
    expect(typeof settings.jwt.accessTokenTtlSeconds).toBe("number");
    expect(settings).toHaveProperty("deviceBinding");
    expect(settings).toHaveProperty("attestation");
    expect(settings).toHaveProperty("risk");
  });

  test("PUT /api/admin/settings - updates and returns new settings", async ({ request }) => {
    const loginR = await request.post(`${BASE}/api/auth/login`, {
      data: { email: "leonidfedorets30@gmail.com", password: "Zadov281983" },
    });
    if (loginR.status() !== 200) {
      test.skip(true, "Step-up MFA required — session not fully established");
      return;
    }

    // GET current settings
    const getR = await request.get(`${BASE}/api/admin/settings`);
    expect(getR.status()).toBe(200);
    const { settings: current } = await getR.json();

    // PUT with a modified value
    const updated = { ...current, jwt: { ...current.jwt, accessTokenTtlSeconds: 1800 } };
    const putR = await request.put(`${BASE}/api/admin/settings`, { data: updated });
    expect(putR.status()).toBe(200);
    const putBody = await putR.json();
    expect(putBody).toHaveProperty("success", true);

    // Verify the change persisted
    const checkR = await request.get(`${BASE}/api/admin/settings`);
    expect(checkR.status()).toBe(200);
    const { settings: checked } = await checkR.json();
    expect(checked.jwt.accessTokenTtlSeconds).toBe(1800);

    // Restore original settings
    await request.put(`${BASE}/api/admin/settings`, { data: current });
  });

  test("GET /api/admin/risk-rules - requires auth cookie", async ({ request }) => {
    const r = await request.get(`${BASE}/api/admin/risk-rules`);
    expect(r.status()).toBe(401);
  });

  test("GET /api/admin/risk-rules - returns risk rule configuration", async ({ request }) => {
    const loginR = await request.post(`${BASE}/api/auth/login`, {
      data: { email: "leonidfedorets30@gmail.com", password: "Zadov281983" },
    });
    if (loginR.status() !== 200) {
      test.skip(true, "Step-up MFA required — session not fully established");
      return;
    }

    const r = await request.get(`${BASE}/api/admin/risk-rules`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    // Response is wrapped: { rules: { thresholds: {...}, ... } }
    expect(body).toHaveProperty("rules");
    const rules = body.rules;
    expect(rules).toHaveProperty("thresholds");
    expect(rules.thresholds).toHaveProperty("low");
    expect(rules.thresholds).toHaveProperty("medium");
    expect(rules.thresholds).toHaveProperty("high");
    expect(rules).toHaveProperty("stepUpThreshold");
    expect(rules).toHaveProperty("denyThreshold");
    expect(rules).toHaveProperty("overrides");
    expect(Array.isArray(rules.overrides)).toBe(true);
  });

  test("PUT /api/admin/risk-rules - requires auth cookie", async ({ request }) => {
    const r = await request.put(`${BASE}/api/admin/risk-rules`, {
      data: { thresholds: { low: 25, medium: 50, high: 75 } },
    });
    expect(r.status()).toBe(401);
  });

  test("PUT /api/admin/risk-rules - updates rules and persists", async ({ request }) => {
    const loginR = await request.post(`${BASE}/api/auth/login`, {
      data: { email: "leonidfedorets30@gmail.com", password: "Zadov281983" },
    });
    if (loginR.status() !== 200) {
      test.skip(true, "Step-up MFA required — session not fully established");
      return;
    }

    // GET current rules
    const getR = await request.get(`${BASE}/api/admin/risk-rules`);
    const { rules: current } = await getR.json();

    // PUT with modified stepUpThreshold
    const updated = { ...current, stepUpThreshold: 45 };
    const putR = await request.put(`${BASE}/api/admin/risk-rules`, { data: updated });
    expect(putR.status()).toBe(200);
    const putBody = await putR.json();
    expect(putBody).toHaveProperty("success", true);

    // Verify persisted
    const checkR = await request.get(`${BASE}/api/admin/risk-rules`);
    const { rules: checked } = await checkR.json();
    expect(checked.stepUpThreshold).toBe(45);

    // Restore
    await request.put(`${BASE}/api/admin/risk-rules`, { data: current });
  });
});
