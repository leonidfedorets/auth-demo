# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api/api-key.spec.ts >> API Key management >> GET /api/admin/api-key - authenticated returns masked key
- Location: tests/api/api-key.spec.ts:21:7

# Error details

```
Error: expect(received).toHaveProperty(path, value)

Expected path: "tid"

Expected value: "c7ed9c17-0633-49df-9bc7-81de55f69fb7"
Received value: "default"
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
  4  | const TENANT_ID = "c7ed9c17-0633-49df-9bc7-81de55f69fb7";
  5  | 
  6  | test.describe.configure({ mode: "serial" });
  7  | 
  8  | test.describe("API Key management", () => {
  9  |   test("GET /api/admin/api-key - unauthenticated returns 401", async ({ request }) => {
  10 |     const r = await request.get(`${BASE}/api/admin/api-key`);
  11 |     expect(r.status()).toBe(401);
  12 |   });
  13 | 
  14 |   test("POST /api/admin/api-key - unauthenticated returns 401", async ({ request }) => {
  15 |     const r = await request.post(`${BASE}/api/admin/api-key`, {
  16 |       data: { action: "regenerate" },
  17 |     });
  18 |     expect(r.status()).toBe(401);
  19 |   });
  20 | 
  21 |   test("GET /api/admin/api-key - authenticated returns masked key", async ({ request }) => {
  22 |     const loginR = await request.post(`${BASE}/api/auth/login`, {
  23 |       data: { email: "leonidfedorets30@gmail.com", password: "Zadov281983" },
  24 |     });
  25 |     if (![200, 202].includes(loginR.status())) {
  26 |       test.skip(true, "Login failed — cannot test API key endpoint");
  27 |       return;
  28 |     }
  29 |     if (loginR.status() === 202) {
  30 |       test.skip(true, "Step-up MFA required — session not fully established");
  31 |       return;
  32 |     }
  33 | 
  34 |     const r = await request.get(`${BASE}/api/admin/api-key`);
  35 |     expect(r.status()).toBe(200);
  36 |     const body = await r.json();
  37 |     // GET returns masked key only, not the full key
  38 |     expect(body).toHaveProperty("keyMasked");
  39 |     expect(body.keyMasked).toMatch(/^uth_live_/);
> 40 |     expect(body).toHaveProperty("tid", TENANT_ID);
     |                  ^ Error: expect(received).toHaveProperty(path, value)
  41 |     expect(body).toHaveProperty("createdAt");
  42 |   });
  43 | 
  44 |   test("POST /api/admin/api-key - regenerate returns full key", async ({ request }) => {
  45 |     const loginR = await request.post(`${BASE}/api/auth/login`, {
  46 |       data: { email: "leonidfedorets30@gmail.com", password: "Zadov281983" },
  47 |     });
  48 |     if (loginR.status() !== 200) {
  49 |       test.skip(true, "Login did not return 200 — step-up required or failed");
  50 |       return;
  51 |     }
  52 | 
  53 |     const r = await request.post(`${BASE}/api/admin/api-key`, {
  54 |       data: { action: "regenerate" },
  55 |     });
  56 |     expect(r.status()).toBe(200);
  57 |     const body = await r.json();
  58 |     // POST regenerate returns the full key
  59 |     expect(body).toHaveProperty("key");
  60 |     expect(body.key).toMatch(/^uth_live_[0-9a-f]{32}$/);
  61 |     expect(body).toHaveProperty("tid", TENANT_ID);
  62 |     expect(body).toHaveProperty("createdAt");
  63 |   });
  64 | 
  65 |   test("POST /api/admin/api-key - invalid action returns 400", async ({ request }) => {
  66 |     const loginR = await request.post(`${BASE}/api/auth/login`, {
  67 |       data: { email: "leonidfedorets30@gmail.com", password: "Zadov281983" },
  68 |     });
  69 |     if (loginR.status() !== 200) {
  70 |       test.skip(true, "Login did not return 200");
  71 |       return;
  72 |     }
  73 | 
  74 |     const r = await request.post(`${BASE}/api/admin/api-key`, {
  75 |       data: { action: "delete" },
  76 |     });
  77 |     expect(r.status()).toBe(400);
  78 |   });
  79 | });
  80 | 
```