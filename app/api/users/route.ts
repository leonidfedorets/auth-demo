/**
 * POST /api/users  — Register an end user under a tenant application.
 *
 * Authentication: X-API-Key header (application API key).
 * The tenant ID and application ID are resolved from the API key.
 *
 * This is NOT for tenant registration. Tenants sign up via the UTH web UI.
 * This endpoint is for tenants to register their own customers (end users)
 * into their application via the UTH API.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/api-key-auth";
import { hashPassword, generateId, getClientIP } from "@/lib/auth";
import { evaluateRisk } from "@/lib/risk";
import { redis } from "@/lib/redis";
import { sql } from "@vercel/postgres";

export async function POST(req: NextRequest) {
  const auth = await verifyApiKey(req as unknown as Request);
  if (!auth) return NextResponse.json({ error: "unauthorized", message: "Valid X-API-Key required" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { email, password, displayName, metadata } = body;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "validation_error", message: "email is required" }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "validation_error", message: "password must be at least 8 characters" }, { status: 400 });
  }

  const ip = getClientIP(req);
  const ua = req.headers.get("user-agent") ?? "";

  // Check for existing user within this tenant
  const existing = await sql`
    SELECT id FROM users WHERE email = ${email} AND tenant_id = ${auth.tid}
  `.catch(() => ({ rows: [] }));
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: "user_exists", message: "Email already registered for this tenant" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const result = await sql`
    INSERT INTO users (email, password_hash, display_name, tenant_id, app_id)
    VALUES (
      ${email},
      ${passwordHash},
      ${displayName ?? email.split("@")[0]},
      ${auth.tid},
      ${auth.appId ?? null}
    )
    RETURNING id, email, display_name, tenant_id, app_id, created_at
  `;
  const user = result.rows[0];

  // Risk evaluation
  const risk = await evaluateRisk({ ip, userAgent: ua, userId: user.id, action: "register" }).catch(() => ({
    score: 0, level: "low" as const, decision: "allow" as const, signals: [],
  }));

  // Record transaction
  const txRecord = {
    id: `tx-${Date.now()}-${generateId().slice(0, 6)}`,
    tid: auth.tid,
    appId: auth.appId,
    appName: auth.appName,
    type: "user",
    subtype: "register",
    userId: user.id,
    email: user.email,
    ip,
    userAgent: ua,
    risk_score: risk.score,
    risk_level: risk.level,
    decision: risk.decision,
    ts: Date.now(),
    createdAt: new Date().toISOString(),
  };
  await redis.lpush(`tenant:transactions:${auth.tid}`, JSON.stringify(txRecord)).catch(() => {});
  await redis.ltrim(`tenant:transactions:${auth.tid}`, 0, 499).catch(() => {});

  await sql`
    INSERT INTO audit_logs (user_id, action, ip_address, user_agent, risk_score, details)
    VALUES (${user.id}, 'user.register', ${ip}, ${ua}, ${risk.score}, ${JSON.stringify({ appId: auth.appId, via: "api_key" })})
  `.catch(() => {});

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      tenantId: user.tenant_id,
      appId: user.app_id,
      createdAt: user.created_at,
    },
    risk: { score: risk.score, level: risk.level, decision: risk.decision },
    metadata: metadata ?? null,
  }, { status: 201 });
}

export async function GET(req: NextRequest) {
  // List end users — API-key authenticated
  const auth = await verifyApiKey(req as unknown as Request);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const appId = searchParams.get("appId");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  let result;
  if (appId) {
    result = await sql`
      SELECT id, email, display_name, app_id, created_at, last_login_at, mfa_enabled
      FROM users
      WHERE tenant_id = ${auth.tid} AND app_id = ${appId}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else {
    result = await sql`
      SELECT id, email, display_name, app_id, created_at, last_login_at, mfa_enabled
      FROM users
      WHERE tenant_id = ${auth.tid}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  return NextResponse.json({ users: result.rows, limit, offset });
}
