# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api/tenant-isolation.spec.ts >> Tenant Isolation — wrong API key → 401 >> POST /api/risk/evaluate - wrong API key → 401
- Location: tests/api/tenant-isolation.spec.ts:30:9

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 401
Received: 500
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | const BASE = "http://localhost:3000";
  4  | 
  5  | // Routes that require authentication (cookie OR API key)
  6  | const COOKIE_ONLY_ROUTES = [
  7  |   { method: "GET" as const, path: "/api/admin/settings" },
  8  |   { method: "GET" as const, path: "/api/admin/risk-rules" },
  9  |   { method: "GET" as const, path: "/api/admin/api-key" },
  10 | ];
  11 | 
  12 | const API_KEY_OR_COOKIE_ROUTES = [
  13 |   { method: "GET" as const, path: "/api/transactions" },
  14 |   { method: "POST" as const, path: "/api/risk/evaluate" },
  15 | ];
  16 | 
  17 | test.describe("Tenant Isolation — no credentials → 401", () => {
  18 |   for (const route of [...COOKIE_ONLY_ROUTES, ...API_KEY_OR_COOKIE_ROUTES]) {
  19 |     test(`${route.method} ${route.path} - no credentials → 401`, async ({ request }) => {
  20 |       const r = await request[route.method.toLowerCase() as "get" | "post"](`${BASE}${route.path}`);
  21 |       expect(r.status()).toBe(401);
  22 |     });
  23 |   }
  24 | });
  25 | 
  26 | test.describe("Tenant Isolation — wrong API key → 401", () => {
  27 |   const FAKE_KEY = "uth_live_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  28 | 
  29 |   for (const route of API_KEY_OR_COOKIE_ROUTES) {
  30 |     test(`${route.method} ${route.path} - wrong API key → 401`, async ({ request }) => {
  31 |       const r = await request[route.method.toLowerCase() as "get" | "post"](`${BASE}${route.path}`, {
  32 |         headers: { "X-API-Key": FAKE_KEY },
  33 |       });
> 34 |       expect(r.status()).toBe(401);
     |                          ^ Error: expect(received).toBe(expected) // Object.is equality
  35 |     });
  36 |   }
  37 | });
  38 | 
  39 | test.describe("Tenant Isolation — malformed credentials → 401", () => {
  40 |   test("GET /api/transactions - API key without prefix → 401", async ({ request }) => {
  41 |     const r = await request.get(`${BASE}/api/transactions`, {
  42 |       headers: { "X-API-Key": "plaintext_no_prefix_key_abc123" },
  43 |     });
  44 |     expect(r.status()).toBe(401);
  45 |   });
  46 | 
  47 |   test("GET /api/transactions - empty API key header → 401", async ({ request }) => {
  48 |     const r = await request.get(`${BASE}/api/transactions`, {
  49 |       headers: { "X-API-Key": "" },
  50 |     });
  51 |     expect(r.status()).toBe(401);
  52 |   });
  53 | 
  54 |   test("GET /api/admin/settings - forged JWT cookie → 401", async ({ request }) => {
  55 |     // A JWT with valid structure but wrong signature
  56 |     const fakeToken = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhdHRhY2tlckBleGFtcGxlLmNvbSIsInRpZCI6ImMwMDAtYXR0YWNrIn0.invalidsignature";
  57 |     const r = await request.get(`${BASE}/api/admin/settings`, {
  58 |       headers: { Cookie: `access_token=${fakeToken}` },
  59 |     });
  60 |     expect(r.status()).toBe(401);
  61 |   });
  62 | 
  63 |   test("GET /api/admin/risk-rules - malformed JWT cookie → 401", async ({ request }) => {
  64 |     const r = await request.get(`${BASE}/api/admin/risk-rules`, {
  65 |       headers: { Cookie: "access_token=not.a.jwt" },
  66 |     });
  67 |     expect(r.status()).toBe(401);
  68 |   });
  69 | 
  70 |   test("POST /api/risk/evaluate - API key with correct prefix but wrong value → 401", async ({ request }) => {
  71 |     const r = await request.post(`${BASE}/api/risk/evaluate`, {
  72 |       headers: { "X-API-Key": "uth_live_00000000000000000000000000000000" },
  73 |       data: { context: "login", signals: {} },
  74 |     });
  75 |     expect(r.status()).toBe(401);
  76 |   });
  77 | });
  78 | 
  79 | test.describe("Admin stats - no auth guard (public endpoint)", () => {
  80 |   test("GET /api/admin/stats - returns 200 without credentials (no auth guard)", async ({ request }) => {
  81 |     // NOTE: /api/admin/stats has no auth check in the current implementation.
  82 |     // This test documents that behavior. If auth is added later, this test should be updated.
  83 |     const r = await request.get(`${BASE}/api/admin/stats`);
  84 |     expect(r.status()).toBe(200);
  85 |     const body = await r.json();
  86 |     expect(body).toHaveProperty("totalTransactions");
  87 |     expect(body).toHaveProperty("totalUsers");
  88 |   });
  89 | });
  90 | 
```