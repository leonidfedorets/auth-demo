# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api/admin.spec.ts >> Admin API endpoints >> GET /api/admin/stats - returns tenant KPIs (no auth required)
- Location: tests/api/admin.spec.ts:11:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 401
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | 
  3   | const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
  4   | 
  5   | test.describe.configure({ mode: "serial" });
  6   | 
  7   | test.describe("Admin API endpoints", () => {
  8   |   // Each test logs in first since Playwright request contexts don't persist
  9   |   // cookies across tests in serial mode automatically.
  10  | 
  11  |   test("GET /api/admin/stats - returns tenant KPIs (no auth required)", async ({ request }) => {
  12  |     // /api/admin/stats currently has no auth check
  13  |     const r = await request.get(`${BASE}/api/admin/stats`);
> 14  |     expect(r.status()).toBe(200);
      |                        ^ Error: expect(received).toBe(expected) // Object.is equality
  15  |     const body = await r.json();
  16  |     expect(body).toHaveProperty("totalTransactions");
  17  |     expect(typeof body.totalTransactions).toBe("number");
  18  |     expect(body).toHaveProperty("totalUsers");
  19  |     expect(typeof body.totalUsers).toBe("number");
  20  |     expect(body).toHaveProperty("boundDevices");
  21  |     expect(body).toHaveProperty("activeSessions");
  22  |     expect(body).toHaveProperty("txLast7Days");
  23  |     expect(Array.isArray(body.txLast7Days)).toBe(true);
  24  |     expect(body.txLast7Days).toHaveLength(7);
  25  |     expect(body).toHaveProperty("riskDistribution");
  26  |     expect(body.riskDistribution).toHaveProperty("low");
  27  |     expect(body.riskDistribution).toHaveProperty("high");
  28  |   });
  29  | 
  30  |   test("GET /api/admin/settings - requires auth cookie", async ({ request }) => {
  31  |     const r = await request.get(`${BASE}/api/admin/settings`);
  32  |     expect(r.status()).toBe(401);
  33  |   });
  34  | 
  35  |   test("GET /api/admin/settings - returns settings for authenticated user", async ({ request }) => {
  36  |     const loginR = await request.post(`${BASE}/api/auth/login`, {
  37  |       data: { email: "leonidfedorets30@gmail.com", password: "Zadov281983" },
  38  |     });
  39  |     if (loginR.status() !== 200) {
  40  |       test.skip(true, "Step-up MFA required — session not fully established");
  41  |       return;
  42  |     }
  43  | 
  44  |     const r = await request.get(`${BASE}/api/admin/settings`);
  45  |     expect(r.status()).toBe(200);
  46  |     const body = await r.json();
  47  |     // Response is wrapped: { settings: { jwt: {...}, ... } }
  48  |     expect(body).toHaveProperty("settings");
  49  |     const settings = body.settings;
  50  |     expect(settings).toHaveProperty("jwt");
  51  |     expect(settings.jwt).toHaveProperty("accessTokenTtlSeconds");
  52  |     expect(typeof settings.jwt.accessTokenTtlSeconds).toBe("number");
  53  |     expect(settings).toHaveProperty("deviceBinding");
  54  |     expect(settings).toHaveProperty("attestation");
  55  |     expect(settings).toHaveProperty("risk");
  56  |   });
  57  | 
  58  |   test("PUT /api/admin/settings - updates and returns new settings", async ({ request }) => {
  59  |     const loginR = await request.post(`${BASE}/api/auth/login`, {
  60  |       data: { email: "leonidfedorets30@gmail.com", password: "Zadov281983" },
  61  |     });
  62  |     if (loginR.status() !== 200) {
  63  |       test.skip(true, "Step-up MFA required — session not fully established");
  64  |       return;
  65  |     }
  66  | 
  67  |     // GET current settings
  68  |     const getR = await request.get(`${BASE}/api/admin/settings`);
  69  |     expect(getR.status()).toBe(200);
  70  |     const { settings: current } = await getR.json();
  71  | 
  72  |     // PUT with a modified value
  73  |     const updated = { ...current, jwt: { ...current.jwt, accessTokenTtlSeconds: 1800 } };
  74  |     const putR = await request.put(`${BASE}/api/admin/settings`, { data: updated });
  75  |     expect(putR.status()).toBe(200);
  76  |     const putBody = await putR.json();
  77  |     expect(putBody).toHaveProperty("success", true);
  78  | 
  79  |     // Verify the change persisted
  80  |     const checkR = await request.get(`${BASE}/api/admin/settings`);
  81  |     expect(checkR.status()).toBe(200);
  82  |     const { settings: checked } = await checkR.json();
  83  |     expect(checked.jwt.accessTokenTtlSeconds).toBe(1800);
  84  | 
  85  |     // Restore original settings
  86  |     await request.put(`${BASE}/api/admin/settings`, { data: current });
  87  |   });
  88  | 
  89  |   test("GET /api/admin/risk-rules - requires auth cookie", async ({ request }) => {
  90  |     const r = await request.get(`${BASE}/api/admin/risk-rules`);
  91  |     expect(r.status()).toBe(401);
  92  |   });
  93  | 
  94  |   test("GET /api/admin/risk-rules - returns risk rule configuration", async ({ request }) => {
  95  |     const loginR = await request.post(`${BASE}/api/auth/login`, {
  96  |       data: { email: "leonidfedorets30@gmail.com", password: "Zadov281983" },
  97  |     });
  98  |     if (loginR.status() !== 200) {
  99  |       test.skip(true, "Step-up MFA required — session not fully established");
  100 |       return;
  101 |     }
  102 | 
  103 |     const r = await request.get(`${BASE}/api/admin/risk-rules`);
  104 |     expect(r.status()).toBe(200);
  105 |     const body = await r.json();
  106 |     // Response is wrapped: { rules: { thresholds: {...}, ... } }
  107 |     expect(body).toHaveProperty("rules");
  108 |     const rules = body.rules;
  109 |     expect(rules).toHaveProperty("thresholds");
  110 |     expect(rules.thresholds).toHaveProperty("low");
  111 |     expect(rules.thresholds).toHaveProperty("medium");
  112 |     expect(rules.thresholds).toHaveProperty("high");
  113 |     expect(rules).toHaveProperty("stepUpThreshold");
  114 |     expect(rules).toHaveProperty("denyThreshold");
```