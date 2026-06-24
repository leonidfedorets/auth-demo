import { test, expect, type APIRequestContext } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

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

test.describe("Risk Evaluate API", () => {
  test("POST /api/risk/evaluate - unauthenticated returns 401", async ({ request }) => {
    const r = await request.post(`${BASE}/api/risk/evaluate`, {
      data: { context: "login", signals: {} },
    });
    expect(r.status()).toBe(401);
  });

  test("POST /api/risk/evaluate - wrong API key returns 401", async ({ request }) => {
    const r = await request.post(`${BASE}/api/risk/evaluate`, {
      headers: { "X-API-Key": "uth_live_fakefakefakefakefakefakefakefake0000" },
      data: { context: "login", signals: {} },
    });
    expect(r.status()).toBe(401);
  });

  test("POST /api/risk/evaluate - low-risk signals return ALLOW", async ({ request }) => {
    const key = await getApiKey(request);
    if (!key) {
      test.skip(true, "Could not obtain API key (step-up MFA or login failed)");
      return;
    }

    const r = await request.post(`${BASE}/api/risk/evaluate`, {
      headers: { "X-API-Key": key },
      data: {
        context: "login",
        userId: "alice@example.com",
        ip: "195.12.50.10",
        signals: {
          knownDevice: true,
          deviceHealthy: true,
          vpnDetected: false,
          torExitNode: false,
        },
      },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty("score");
    expect(body).toHaveProperty("level");
    expect(body).toHaveProperty("decision");
    expect(typeof body.score).toBe("number");
    expect(["low", "medium", "high", "critical"]).toContain(body.level);
    expect(["ALLOW", "STEP_UP", "DENY"]).toContain(body.decision);
    // No high-risk signals → should ALLOW
    expect(body.decision).toBe("ALLOW");
    expect(body.level).toBe("low");
  });

  test("POST /api/risk/evaluate - Tor exit node triggers DENY", async ({ request }) => {
    const key = await getApiKey(request);
    if (!key) {
      test.skip(true, "Could not obtain API key");
      return;
    }

    const r = await request.post(`${BASE}/api/risk/evaluate`, {
      headers: { "X-API-Key": key },
      data: {
        context: "login",
        signals: { torExitNode: true, vpnDetected: true, rootedDevice: true },
      },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    // torExitNode → DENY override
    expect(body.decision).toBe("DENY");
  });

  test("POST /api/risk/evaluate - rooted device triggers DENY", async ({ request }) => {
    const key = await getApiKey(request);
    if (!key) {
      test.skip(true, "Could not obtain API key");
      return;
    }

    const r = await request.post(`${BASE}/api/risk/evaluate`, {
      headers: { "X-API-Key": key },
      data: {
        context: "login",
        signals: { rootedDevice: true, torExitNode: false },
      },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.decision).toBe("DENY");
  });

  test("POST /api/risk/evaluate - moderate risk triggers STEP_UP", async ({ request }) => {
    const key = await getApiKey(request);
    if (!key) {
      test.skip(true, "Could not obtain API key");
      return;
    }

    const r = await request.post(`${BASE}/api/risk/evaluate`, {
      headers: { "X-API-Key": key },
      data: {
        context: "login",
        signals: {
          knownDevice: false,  // +35
          vpnDetected: true,   // +10
          // total = 45, which is > 40 threshold → STEP_UP
        },
      },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty("score");
    // score 45: above stepUp threshold (40) but below deny threshold (75+)
    expect(body.decision).toBe("STEP_UP");
  });

  test("POST /api/risk/evaluate - response includes evaluationId and tenantId", async ({ request }) => {
    const key = await getApiKey(request);
    if (!key) {
      test.skip(true, "Could not obtain API key");
      return;
    }

    const r = await request.post(`${BASE}/api/risk/evaluate`, {
      headers: { "X-API-Key": key },
      data: { context: "operation", signals: {} },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty("evaluationId");
    expect(body).toHaveProperty("tenantId");
    expect(body).toHaveProperty("evaluatedAt");
    expect(body).toHaveProperty("layers");
    expect(body.layers).toHaveProperty("deviceTrust");
    expect(body.layers).toHaveProperty("operationRisk");
  });

  test("POST /api/risk/evaluate - payment context with high amount increases score", async ({ request }) => {
    const key = await getApiKey(request);
    if (!key) {
      test.skip(true, "Could not obtain API key");
      return;
    }

    const lowR = await request.post(`${BASE}/api/risk/evaluate`, {
      headers: { "X-API-Key": key },
      data: { context: "payment", amount: "50", signals: {} },
    });
    const highR = await request.post(`${BASE}/api/risk/evaluate`, {
      headers: { "X-API-Key": key },
      data: { context: "payment", amount: "50000", signals: {} },
    });

    expect(lowR.status()).toBe(200);
    expect(highR.status()).toBe(200);
    const low = await lowR.json();
    const high = await highR.json();
    // High amount should produce a higher score
    expect(high.score).toBeGreaterThan(low.score);
  });
});
