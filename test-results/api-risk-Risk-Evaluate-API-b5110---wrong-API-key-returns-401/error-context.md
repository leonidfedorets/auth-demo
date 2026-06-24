# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api/risk.spec.ts >> Risk Evaluate API >> POST /api/risk/evaluate - wrong API key returns 401
- Location: tests/api/risk.spec.ts:28:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 401
Received: 500
```

# Test source

```ts
  1   | import { test, expect, type APIRequestContext } from "@playwright/test";
  2   | 
  3   | const BASE = "http://localhost:3000";
  4   | 
  5   | async function getApiKey(request: APIRequestContext): Promise<string | null> {
  6   |   const loginR = await request.post(`${BASE}/api/auth/login`, {
  7   |     data: { email: "leonidfedorets30@gmail.com", password: "Zadov281983" },
  8   |   });
  9   |   if (loginR.status() !== 200) return null;
  10  | 
  11  |   const keyR = await request.post(`${BASE}/api/admin/api-key`, {
  12  |     data: { action: "regenerate" },
  13  |   });
  14  |   if (keyR.status() !== 200) return null;
  15  | 
  16  |   const body = await keyR.json();
  17  |   return body.key ?? null;
  18  | }
  19  | 
  20  | test.describe("Risk Evaluate API", () => {
  21  |   test("POST /api/risk/evaluate - unauthenticated returns 401", async ({ request }) => {
  22  |     const r = await request.post(`${BASE}/api/risk/evaluate`, {
  23  |       data: { context: "login", signals: {} },
  24  |     });
  25  |     expect(r.status()).toBe(401);
  26  |   });
  27  | 
  28  |   test("POST /api/risk/evaluate - wrong API key returns 401", async ({ request }) => {
  29  |     const r = await request.post(`${BASE}/api/risk/evaluate`, {
  30  |       headers: { "X-API-Key": "uth_live_fakefakefakefakefakefakefakefake0000" },
  31  |       data: { context: "login", signals: {} },
  32  |     });
> 33  |     expect(r.status()).toBe(401);
      |                        ^ Error: expect(received).toBe(expected) // Object.is equality
  34  |   });
  35  | 
  36  |   test("POST /api/risk/evaluate - low-risk signals return ALLOW", async ({ request }) => {
  37  |     const key = await getApiKey(request);
  38  |     if (!key) {
  39  |       test.skip(true, "Could not obtain API key (step-up MFA or login failed)");
  40  |       return;
  41  |     }
  42  | 
  43  |     const r = await request.post(`${BASE}/api/risk/evaluate`, {
  44  |       headers: { "X-API-Key": key },
  45  |       data: {
  46  |         context: "login",
  47  |         userId: "alice@example.com",
  48  |         ip: "195.12.50.10",
  49  |         signals: {
  50  |           knownDevice: true,
  51  |           deviceHealthy: true,
  52  |           vpnDetected: false,
  53  |           torExitNode: false,
  54  |         },
  55  |       },
  56  |     });
  57  |     expect(r.status()).toBe(200);
  58  |     const body = await r.json();
  59  |     expect(body).toHaveProperty("score");
  60  |     expect(body).toHaveProperty("level");
  61  |     expect(body).toHaveProperty("decision");
  62  |     expect(typeof body.score).toBe("number");
  63  |     expect(["low", "medium", "high", "critical"]).toContain(body.level);
  64  |     expect(["ALLOW", "STEP_UP", "DENY"]).toContain(body.decision);
  65  |     // No high-risk signals → should ALLOW
  66  |     expect(body.decision).toBe("ALLOW");
  67  |     expect(body.level).toBe("low");
  68  |   });
  69  | 
  70  |   test("POST /api/risk/evaluate - Tor exit node triggers DENY", async ({ request }) => {
  71  |     const key = await getApiKey(request);
  72  |     if (!key) {
  73  |       test.skip(true, "Could not obtain API key");
  74  |       return;
  75  |     }
  76  | 
  77  |     const r = await request.post(`${BASE}/api/risk/evaluate`, {
  78  |       headers: { "X-API-Key": key },
  79  |       data: {
  80  |         context: "login",
  81  |         signals: { torExitNode: true, vpnDetected: true, rootedDevice: true },
  82  |       },
  83  |     });
  84  |     expect(r.status()).toBe(200);
  85  |     const body = await r.json();
  86  |     // torExitNode → DENY override
  87  |     expect(body.decision).toBe("DENY");
  88  |   });
  89  | 
  90  |   test("POST /api/risk/evaluate - rooted device triggers DENY", async ({ request }) => {
  91  |     const key = await getApiKey(request);
  92  |     if (!key) {
  93  |       test.skip(true, "Could not obtain API key");
  94  |       return;
  95  |     }
  96  | 
  97  |     const r = await request.post(`${BASE}/api/risk/evaluate`, {
  98  |       headers: { "X-API-Key": key },
  99  |       data: {
  100 |         context: "login",
  101 |         signals: { rootedDevice: true, torExitNode: false },
  102 |       },
  103 |     });
  104 |     expect(r.status()).toBe(200);
  105 |     const body = await r.json();
  106 |     expect(body.decision).toBe("DENY");
  107 |   });
  108 | 
  109 |   test("POST /api/risk/evaluate - moderate risk triggers STEP_UP", async ({ request }) => {
  110 |     const key = await getApiKey(request);
  111 |     if (!key) {
  112 |       test.skip(true, "Could not obtain API key");
  113 |       return;
  114 |     }
  115 | 
  116 |     const r = await request.post(`${BASE}/api/risk/evaluate`, {
  117 |       headers: { "X-API-Key": key },
  118 |       data: {
  119 |         context: "login",
  120 |         signals: {
  121 |           knownDevice: false,  // +35
  122 |           vpnDetected: true,   // +10
  123 |           // total = 45, which is > 40 threshold → STEP_UP
  124 |         },
  125 |       },
  126 |     });
  127 |     expect(r.status()).toBe(200);
  128 |     const body = await r.json();
  129 |     expect(body).toHaveProperty("score");
  130 |     // score 45: above stepUp threshold (40) but below deny threshold (75+)
  131 |     expect(body.decision).toBe("STEP_UP");
  132 |   });
  133 | 
```