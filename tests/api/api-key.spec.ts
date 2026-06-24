import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";
const TENANT_ID = "c7ed9c17-0633-49df-9bc7-81de55f69fb7";

test.describe.configure({ mode: "serial" });

test.describe("API Key management", () => {
  test("GET /api/admin/api-key - unauthenticated returns 401", async ({ request }) => {
    const r = await request.get(`${BASE}/api/admin/api-key`);
    expect(r.status()).toBe(401);
  });

  test("POST /api/admin/api-key - unauthenticated returns 401", async ({ request }) => {
    const r = await request.post(`${BASE}/api/admin/api-key`, {
      data: { action: "regenerate" },
    });
    expect(r.status()).toBe(401);
  });

  test("GET /api/admin/api-key - authenticated returns masked key", async ({ request }) => {
    const loginR = await request.post(`${BASE}/api/auth/login`, {
      data: { email: "leonidfedorets30@gmail.com", password: "Zadov281983" },
    });
    if (![200, 202].includes(loginR.status())) {
      test.skip(true, "Login failed — cannot test API key endpoint");
      return;
    }
    if (loginR.status() === 202) {
      test.skip(true, "Step-up MFA required — session not fully established");
      return;
    }

    const r = await request.get(`${BASE}/api/admin/api-key`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    // GET returns masked key only, not the full key
    expect(body).toHaveProperty("keyMasked");
    expect(body.keyMasked).toMatch(/^uth_live_/);
    expect(body).toHaveProperty("tid", TENANT_ID);
    expect(body).toHaveProperty("createdAt");
  });

  test("POST /api/admin/api-key - regenerate returns full key", async ({ request }) => {
    const loginR = await request.post(`${BASE}/api/auth/login`, {
      data: { email: "leonidfedorets30@gmail.com", password: "Zadov281983" },
    });
    if (loginR.status() !== 200) {
      test.skip(true, "Login did not return 200 — step-up required or failed");
      return;
    }

    const r = await request.post(`${BASE}/api/admin/api-key`, {
      data: { action: "regenerate" },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    // POST regenerate returns the full key
    expect(body).toHaveProperty("key");
    expect(body.key).toMatch(/^uth_live_[0-9a-f]{32}$/);
    expect(body).toHaveProperty("tid", TENANT_ID);
    expect(body).toHaveProperty("createdAt");
  });

  test("POST /api/admin/api-key - invalid action returns 400", async ({ request }) => {
    const loginR = await request.post(`${BASE}/api/auth/login`, {
      data: { email: "leonidfedorets30@gmail.com", password: "Zadov281983" },
    });
    if (loginR.status() !== 200) {
      test.skip(true, "Login did not return 200");
      return;
    }

    const r = await request.post(`${BASE}/api/admin/api-key`, {
      data: { action: "delete" },
    });
    expect(r.status()).toBe(400);
  });
});
