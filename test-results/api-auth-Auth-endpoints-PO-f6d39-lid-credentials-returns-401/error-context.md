# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api/auth.spec.ts >> Auth endpoints >> POST /api/auth/login - invalid credentials returns 401
- Location: tests/api/auth.spec.ts:11:7

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
  5  | test.describe("Auth endpoints", () => {
  6  |   test("GET /api/auth/me - unauthenticated returns 401", async ({ request }) => {
  7  |     const r = await request.get(`${BASE}/api/auth/me`);
  8  |     expect(r.status()).toBe(401);
  9  |   });
  10 | 
  11 |   test("POST /api/auth/login - invalid credentials returns 401", async ({ request }) => {
  12 |     const r = await request.post(`${BASE}/api/auth/login`, {
  13 |       data: { email: "nobody@example.com", password: "wrongpass" },
  14 |     });
> 15 |     expect(r.status()).toBe(401);
     |                        ^ Error: expect(received).toBe(expected) // Object.is equality
  16 |   });
  17 | 
  18 |   test("POST /api/auth/login - valid login sets cookie or triggers step-up", async ({ request }) => {
  19 |     const r = await request.post(`${BASE}/api/auth/login`, {
  20 |       data: { email: "leonidfedorets30@gmail.com", password: "Zadov281983" },
  21 |     });
  22 |     // 200 = fully logged in, 202 = step-up MFA required
  23 |     expect([200, 202]).toContain(r.status());
  24 |     if (r.status() === 200) {
  25 |       const body = await r.json();
  26 |       expect(body).toHaveProperty("accessToken");
  27 |     }
  28 |   });
  29 | });
  30 | 
```