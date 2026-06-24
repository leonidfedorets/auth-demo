import { test, expect, type APIRequestContext } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const TENANT_ID = "c7ed9c17-0633-49df-9bc7-81de55f69fb7";

/**
 * Helper: login and regenerate API key, returning the full key string.
 * Returns null if login fails (e.g. step-up MFA required).
 */
async function getApiKey(request: APIRequestContext): Promise<string | null> {
  const loginR = await request.post(`${BASE}/api/auth/login`, {
    data: { email: "leonidfedorets30@gmail.com", password: "Zadov281983" },
  });
  if (loginR.status() !== 200) return null;

  const keyR = await request.post(`${BASE}/api/admin/api-key`, {
    data: { action: "regenerate" },
  });
  if (keyR.status() !== 200) return null;

  const body = await keyR.json();
  return body.key ?? null;
}

test.describe.configure({ mode: "serial" });

test.describe("Transactions API", () => {
  test("GET /api/transactions - unauthenticated returns 401", async ({ request }) => {
    const r = await request.get(`${BASE}/api/transactions`);
    expect(r.status()).toBe(401);
  });

  test("POST /api/transactions - unauthenticated returns 401", async ({ request }) => {
    const r = await request.post(`${BASE}/api/transactions`, {
      data: { type: "auth", userId: "test@example.com" },
    });
    expect(r.status()).toBe(401);
  });

  test("GET /api/transactions - with valid API key returns tenant transactions", async ({ request }) => {
    const key = await getApiKey(request);
    if (!key) {
      test.skip(true, "Could not obtain API key (step-up MFA or login failed)");
      return;
    }

    const r = await request.get(`${BASE}/api/transactions`, {
      headers: { "X-API-Key": key },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    // Response shape: { transactions: [...], total: N }
    expect(body).toHaveProperty("transactions");
    expect(Array.isArray(body.transactions)).toBe(true);
    expect(body).toHaveProperty("total");
    expect(typeof body.total).toBe("number");
  });

  test("GET /api/transactions - with session cookie returns tenant transactions", async ({ request }) => {
    const loginR = await request.post(`${BASE}/api/auth/login`, {
      data: { email: "leonidfedorets30@gmail.com", password: "Zadov281983" },
    });
    if (loginR.status() !== 200) {
      test.skip(true, "Step-up MFA required — session not fully established");
      return;
    }

    const r = await request.get(`${BASE}/api/transactions`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty("transactions");
    expect(Array.isArray(body.transactions)).toBe(true);
  });

  test("POST /api/transactions - creates transaction with API key", async ({ request }) => {
    const key = await getApiKey(request);
    if (!key) {
      test.skip(true, "Could not obtain API key");
      return;
    }

    const r = await request.post(`${BASE}/api/transactions`, {
      headers: { "X-API-Key": key },
      data: {
        type: "auth",
        subtype: "login_success",
        userId: "test-user@example.com",
        deviceId: "test-device-001",
        ip: "195.12.50.10",
        metadata: { source: "playwright-test", userAgent: "Playwright/1.0" },
      },
    });
    // Route returns 200 (no explicit 201 status set)
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("tid", TENANT_ID);
    expect(body.status).toBe("recorded");
  });

  test("GET /api/transactions - type filter works", async ({ request }) => {
    const key = await getApiKey(request);
    if (!key) {
      test.skip(true, "Could not obtain API key");
      return;
    }

    const r = await request.get(`${BASE}/api/transactions?type=auth`, {
      headers: { "X-API-Key": key },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(Array.isArray(body.transactions)).toBe(true);
    // Every returned transaction should be of type "auth"
    for (const txn of body.transactions as Record<string, unknown>[]) {
      expect(txn.type).toBe("auth");
    }
  });

  test("Tenant isolation: wrong API key returns 401", async ({ request }) => {
    const r = await request.get(`${BASE}/api/transactions`, {
      headers: { "X-API-Key": "uth_live_wrong_key_should_fail_1234567890abcdef" },
    });
    expect(r.status()).toBe(401);
  });

  test("Tenant isolation: malformed API key (no prefix) returns 401", async ({ request }) => {
    const r = await request.get(`${BASE}/api/transactions`, {
      headers: { "X-API-Key": "totally_invalid_key_format" },
    });
    expect(r.status()).toBe(401);
  });

  test("Tenant isolation: no credentials returns 401", async ({ request }) => {
    const r = await request.get(`${BASE}/api/transactions`);
    expect(r.status()).toBe(401);
  });
});
