# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api/transactions.spec.ts >> Transactions API >> Tenant isolation: wrong API key returns 401
- Location: tests/api/transactions.spec.ts:120:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 401
Received: 500
```

# Test source

```ts
  24  | 
  25  | test.describe.configure({ mode: "serial" });
  26  | 
  27  | test.describe("Transactions API", () => {
  28  |   test("GET /api/transactions - unauthenticated returns 401", async ({ request }) => {
  29  |     const r = await request.get(`${BASE}/api/transactions`);
  30  |     expect(r.status()).toBe(401);
  31  |   });
  32  | 
  33  |   test("POST /api/transactions - unauthenticated returns 401", async ({ request }) => {
  34  |     const r = await request.post(`${BASE}/api/transactions`, {
  35  |       data: { type: "auth", userId: "test@example.com" },
  36  |     });
  37  |     expect(r.status()).toBe(401);
  38  |   });
  39  | 
  40  |   test("GET /api/transactions - with valid API key returns tenant transactions", async ({ request }) => {
  41  |     const key = await getApiKey(request);
  42  |     if (!key) {
  43  |       test.skip(true, "Could not obtain API key (step-up MFA or login failed)");
  44  |       return;
  45  |     }
  46  | 
  47  |     const r = await request.get(`${BASE}/api/transactions`, {
  48  |       headers: { "X-API-Key": key },
  49  |     });
  50  |     expect(r.status()).toBe(200);
  51  |     const body = await r.json();
  52  |     // Response shape: { transactions: [...], total: N }
  53  |     expect(body).toHaveProperty("transactions");
  54  |     expect(Array.isArray(body.transactions)).toBe(true);
  55  |     expect(body).toHaveProperty("total");
  56  |     expect(typeof body.total).toBe("number");
  57  |   });
  58  | 
  59  |   test("GET /api/transactions - with session cookie returns tenant transactions", async ({ request }) => {
  60  |     const loginR = await request.post(`${BASE}/api/auth/login`, {
  61  |       data: { email: "leonidfedorets30@gmail.com", password: "Zadov281983" },
  62  |     });
  63  |     if (loginR.status() !== 200) {
  64  |       test.skip(true, "Step-up MFA required — session not fully established");
  65  |       return;
  66  |     }
  67  | 
  68  |     const r = await request.get(`${BASE}/api/transactions`);
  69  |     expect(r.status()).toBe(200);
  70  |     const body = await r.json();
  71  |     expect(body).toHaveProperty("transactions");
  72  |     expect(Array.isArray(body.transactions)).toBe(true);
  73  |   });
  74  | 
  75  |   test("POST /api/transactions - creates transaction with API key", async ({ request }) => {
  76  |     const key = await getApiKey(request);
  77  |     if (!key) {
  78  |       test.skip(true, "Could not obtain API key");
  79  |       return;
  80  |     }
  81  | 
  82  |     const r = await request.post(`${BASE}/api/transactions`, {
  83  |       headers: { "X-API-Key": key },
  84  |       data: {
  85  |         type: "auth",
  86  |         subtype: "login_success",
  87  |         userId: "test-user@example.com",
  88  |         deviceId: "test-device-001",
  89  |         ip: "195.12.50.10",
  90  |         metadata: { source: "playwright-test", userAgent: "Playwright/1.0" },
  91  |       },
  92  |     });
  93  |     // Route returns 200 (no explicit 201 status set)
  94  |     expect(r.status()).toBe(200);
  95  |     const body = await r.json();
  96  |     expect(body).toHaveProperty("id");
  97  |     expect(body).toHaveProperty("tid", TENANT_ID);
  98  |     expect(body.status).toBe("recorded");
  99  |   });
  100 | 
  101 |   test("GET /api/transactions - type filter works", async ({ request }) => {
  102 |     const key = await getApiKey(request);
  103 |     if (!key) {
  104 |       test.skip(true, "Could not obtain API key");
  105 |       return;
  106 |     }
  107 | 
  108 |     const r = await request.get(`${BASE}/api/transactions?type=auth`, {
  109 |       headers: { "X-API-Key": key },
  110 |     });
  111 |     expect(r.status()).toBe(200);
  112 |     const body = await r.json();
  113 |     expect(Array.isArray(body.transactions)).toBe(true);
  114 |     // Every returned transaction should be of type "auth"
  115 |     for (const txn of body.transactions as Record<string, unknown>[]) {
  116 |       expect(txn.type).toBe("auth");
  117 |     }
  118 |   });
  119 | 
  120 |   test("Tenant isolation: wrong API key returns 401", async ({ request }) => {
  121 |     const r = await request.get(`${BASE}/api/transactions`, {
  122 |       headers: { "X-API-Key": "uth_live_wrong_key_should_fail_1234567890abcdef" },
  123 |     });
> 124 |     expect(r.status()).toBe(401);
      |                        ^ Error: expect(received).toBe(expected) // Object.is equality
  125 |   });
  126 | 
  127 |   test("Tenant isolation: malformed API key (no prefix) returns 401", async ({ request }) => {
  128 |     const r = await request.get(`${BASE}/api/transactions`, {
  129 |       headers: { "X-API-Key": "totally_invalid_key_format" },
  130 |     });
  131 |     expect(r.status()).toBe(401);
  132 |   });
  133 | 
  134 |   test("Tenant isolation: no credentials returns 401", async ({ request }) => {
  135 |     const r = await request.get(`${BASE}/api/transactions`);
  136 |     expect(r.status()).toBe(401);
  137 |   });
  138 | });
  139 | 
```