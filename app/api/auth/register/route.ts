/**
 * POST /api/auth/register
 *
 * Two modes, determined by authentication:
 *
 * 1. X-API-Key header present → end-user registration under the tenant that owns the key.
 *    The new user is created with tenant_id = key's tenant, app_id = key's application.
 *    Returns: { user, risk } — same shape as POST /api/users.
 *
 * 2. No API key → tenant account registration via the UTH web UI.
 *    The new account becomes its own tenant (tenant_id = user.id).
 *    Returns: { user, risk, sessionId } + sets httpOnly cookies.
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { signAccessToken, signRefreshToken, accessTTLSeconds, refreshTTLSeconds } from "@/lib/jwt";
import { hashPassword, hashToken, generateId, getClientIP } from "@/lib/auth";
import { cacheSession, registerRateLimit, redis } from "@/lib/redis";
import { evaluateRisk } from "@/lib/risk";
import { verifyApiKey } from "@/lib/api-key-auth";

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  const ua = req.headers.get("user-agent") ?? "";

  // ── Mode 1: API-key present → register end user under that tenant ─────────
  const apiAuth = await verifyApiKey(req as unknown as Request);
  if (apiAuth) {
    const body = await req.json().catch(() => ({}));
    const { email, password, displayName, metadata } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "validation_error", message: "email is required" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "validation_error", message: "password must be at least 8 characters" }, { status: 400 });
    }

    // Check uniqueness within this tenant
    const existing = await sql`
      SELECT id FROM users WHERE email = ${email} AND tenant_id = ${apiAuth.tid}
    `.catch(() => ({ rows: [] }));
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: "user_exists", message: "Email already registered for this tenant" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const result = await sql`
      INSERT INTO users (email, password_hash, display_name, tenant_id, app_id)
      VALUES (${email}, ${passwordHash}, ${displayName ?? email.split("@")[0]}, ${apiAuth.tid}, ${apiAuth.appId ?? null})
      RETURNING id, email, display_name, tenant_id, app_id, created_at
    `;
    const user = result.rows[0];

    const risk = await evaluateRisk({ ip, userAgent: ua, userId: user.id, action: "register" }).catch(() => ({
      score: 0, level: "low" as const, decision: "allow" as const, signals: [],
    }));

    // Record transaction under the tenant
    const txRecord = {
      id: `tx-${Date.now()}-${generateId().slice(0, 6)}`,
      tid: apiAuth.tid,
      appId: apiAuth.appId,
      appName: apiAuth.appName,
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
    await redis.lpush(`tenant:transactions:${apiAuth.tid}`, JSON.stringify(txRecord)).catch(() => {});
    await redis.ltrim(`tenant:transactions:${apiAuth.tid}`, 0, 499).catch(() => {});

    await sql`
      INSERT INTO audit_logs (user_id, action, ip_address, user_agent, risk_score, details)
      VALUES (${user.id}, 'user.register', ${ip}, ${ua}, ${risk.score},
              ${JSON.stringify({ appId: apiAuth.appId, via: "api_key" })})
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

  // ── Mode 2: No API key → tenant account registration (web UI only) ────────
  const { success } = await registerRateLimit.limit(ip);
  if (!success) {
    return NextResponse.json({ error: "rate_limit_exceeded", message: "Too many registration attempts" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const { email, password, displayName, orgName } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "validation_error", message: "Email and password required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "validation_error", message: "Password must be at least 8 characters" }, { status: 400 });
  }

  // Tenant emails must be globally unique (no tenant_id scoping)
  const existing = await sql`SELECT id FROM users WHERE email = ${email} AND (tenant_id IS NULL OR tenant_id = id)`;
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: "user_exists", message: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const result = await sql`
    INSERT INTO users (email, password_hash, display_name)
    VALUES (${email}, ${passwordHash}, ${displayName ?? orgName ?? email.split("@")[0]})
    RETURNING id, email, display_name, created_at
  `;
  const user = result.rows[0];

  // Self-referential: tenant's own user ID is their tenant ID
  await sql`UPDATE users SET tenant_id = ${user.id} WHERE id = ${user.id}`.catch(() => {});

  const risk = await evaluateRisk({ ip, userAgent: ua, action: "register" }).catch(() => ({
    score: 0, level: "low" as const, decision: "allow" as const, signals: [],
  }));

  const familyId = generateId();
  const sessionId = generateId();
  const tid = user.id;
  const claims = {
    sub: user.id, email: user.email, tid,
    sid: sessionId, amr: ["pwd"], acr: "bronze",
    risk: risk.score, risk_lvl: risk.level,
    fid: familyId, roles: ["tenant"],
  };

  const accessToken = await signAccessToken(claims);
  const refreshToken = await signRefreshToken(claims);

  const expiresAt = new Date(Date.now() + refreshTTLSeconds() * 1000).toISOString();
  await sql`
    INSERT INTO sessions (id, user_id, refresh_token_hash, family_id, ip_address, user_agent, amr, risk_score, expires_at)
    VALUES (${sessionId}, ${user.id}, ${hashToken(refreshToken)}, ${familyId}, ${ip}, ${ua},
            ${JSON.stringify(["pwd"])}, ${risk.score}, ${expiresAt})
  `;
  await cacheSession(sessionId, { userId: user.id, email: user.email }, refreshTTLSeconds());
  await sql`
    INSERT INTO audit_logs (user_id, session_id, action, ip_address, user_agent, risk_score, details)
    VALUES (${user.id}, ${sessionId}, 'tenant.register', ${ip}, ${ua}, ${risk.score},
            ${JSON.stringify({ orgName: orgName ?? null })})
  `.catch(() => {});

  const res = NextResponse.json({
    user: { id: user.id, email: user.email, displayName: user.display_name, tenantId: tid },
    risk, sessionId,
  }, { status: 201 });

  res.cookies.set("access_token", accessToken, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: accessTTLSeconds(), path: "/",
  });
  res.cookies.set("refresh_token", refreshToken, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: refreshTTLSeconds(), path: "/",
  });
  return res;
}
