/**
 * POST /api/auth/register — Tenant account registration (UTH web UI only).
 *
 * This creates a TENANT account on the UTH platform — NOT an end user.
 * End users of tenant applications are registered via POST /api/users (API-key auth).
 *
 * The newly created user's own ID becomes their tenant_id (tid) in all JWT tokens,
 * so they see only their own applications, users, and transactions in the dashboard.
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { signAccessToken, signRefreshToken, accessTTLSeconds, refreshTTLSeconds } from "@/lib/jwt";
import { hashPassword, hashToken, generateId, getClientIP } from "@/lib/auth";
import { cacheSession, registerRateLimit } from "@/lib/redis";
import { evaluateRisk } from "@/lib/risk";

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  const ua = req.headers.get("user-agent") ?? "";

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

  const existing = await sql`SELECT id FROM users WHERE email = ${email} AND tenant_id IS NULL`;
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: "user_exists", message: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  // Insert tenant account — tenant_id is NULL at first; we update it to their own ID after insert
  const result = await sql`
    INSERT INTO users (email, password_hash, display_name)
    VALUES (${email}, ${passwordHash}, ${displayName ?? orgName ?? email.split("@")[0]})
    RETURNING id, email, display_name, created_at
  `;
  const user = result.rows[0];

  // The tenant's own user ID IS their tenant ID — self-referential ownership
  await sql`UPDATE users SET tenant_id = ${user.id} WHERE id = ${user.id}`.catch(() => {});

  const risk = await evaluateRisk({ ip, userAgent: ua, action: "register" }).catch(() => ({
    score: 0, level: "low" as const, decision: "allow" as const, signals: [],
  }));

  const familyId = generateId();
  const sessionId = generateId();
  const tid = user.id; // tenant's own ID is their tenant_id
  const claims = {
    sub: user.id,
    email: user.email,
    tid,
    sid: sessionId,
    amr: ["pwd"],
    acr: "bronze",
    risk: risk.score,
    risk_lvl: risk.level,
    fid: familyId,
    roles: ["tenant"],
  };

  const accessToken = await signAccessToken(claims);
  const refreshToken = await signRefreshToken(claims);

  const expiresAt = new Date(Date.now() + refreshTTLSeconds() * 1000).toISOString();
  await sql`
    INSERT INTO sessions (id, user_id, refresh_token_hash, family_id, ip_address, user_agent, amr, risk_score, expires_at)
    VALUES (${sessionId}, ${user.id}, ${hashToken(refreshToken)}, ${familyId}, ${ip}, ${ua}, ${JSON.stringify(["pwd"])}, ${risk.score}, ${expiresAt})
  `;
  await cacheSession(sessionId, { userId: user.id, email: user.email }, refreshTTLSeconds());

  await sql`
    INSERT INTO audit_logs (user_id, session_id, action, ip_address, user_agent, risk_score, details)
    VALUES (${user.id}, ${sessionId}, 'tenant.register', ${ip}, ${ua}, ${risk.score}, ${JSON.stringify({ orgName: orgName ?? null })})
  `.catch(() => {});

  const res = NextResponse.json({
    user: { id: user.id, email: user.email, displayName: user.display_name, tenantId: tid },
    risk,
    sessionId,
  }, { status: 201 });

  res.cookies.set("access_token", accessToken, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: accessTTLSeconds(), path: "/",
  });
  res.cookies.set("refresh_token", refreshToken, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: refreshTTLSeconds(), path: "/",
  });
  return res;
}
