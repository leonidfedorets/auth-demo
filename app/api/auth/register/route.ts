import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { signAccessToken, signRefreshToken, accessTTLSeconds, refreshTTLSeconds } from "@/lib/jwt";
import { hashPassword, hashToken, generateId, getClientIP } from "@/lib/auth";
import { cacheSession, registerRateLimit } from "@/lib/redis";
import { evaluateRisk } from "@/lib/risk";

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);

  // Rate limit
  const { success } = await registerRateLimit.limit(ip);
  if (!success) return NextResponse.json({ error: "rate_limit_exceeded", message: "Too many registration attempts" }, { status: 429 });

  const body = await req.json();
  const { email, password, displayName } = body;

  if (!email || !password) return NextResponse.json({ error: "validation_error", message: "Email and password required" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "validation_error", message: "Password must be at least 8 characters" }, { status: 400 });

  // Check for existing user
  const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (existing.rows.length > 0) return NextResponse.json({ error: "user_exists", message: "Email already registered" }, { status: 409 });

  const passwordHash = await hashPassword(password);
  const result = await sql`
    INSERT INTO users (email, password_hash, display_name)
    VALUES (${email}, ${passwordHash}, ${displayName ?? email.split("@")[0]})
    RETURNING id, email, display_name, created_at
  `;
  const user = result.rows[0];

  // Risk evaluation
  const risk = await evaluateRisk({ ip, userAgent: req.headers.get("user-agent") ?? "", action: "register" });

  // Issue tokens
  const familyId = generateId();
  const sessionId = generateId();
  const claims = { sub: user.id, email: user.email, tid: "default", sid: sessionId, amr: ["pwd"], acr: "bronze", risk: risk.score, risk_lvl: risk.level, fid: familyId, roles: ["user"] };

  const accessToken = await signAccessToken(claims);
  const refreshToken = await signRefreshToken(claims);
  const refreshHash = hashToken(refreshToken);

  const expiresAt = new Date(Date.now() + refreshTTLSeconds() * 1000).toISOString();
  await sql`
    INSERT INTO sessions (id, user_id, refresh_token_hash, family_id, ip_address, user_agent, amr, risk_score, expires_at)
    VALUES (${sessionId}, ${user.id}, ${refreshHash}, ${familyId}, ${ip}, ${req.headers.get("user-agent") ?? ""}, ${JSON.stringify(["pwd"])}, ${risk.score}, ${expiresAt})
  `;

  await cacheSession(sessionId, { userId: user.id, email: user.email }, refreshTTLSeconds());

  // Audit log
  await sql`
    INSERT INTO audit_logs (user_id, session_id, action, ip_address, user_agent, risk_score, details)
    VALUES (${user.id}, ${sessionId}, 'auth.register', ${ip}, ${req.headers.get("user-agent") ?? ""}, ${risk.score}, ${JSON.stringify({ method: "password" })})
  `;

  const res = NextResponse.json({ user: { id: user.id, email: user.email, displayName: user.display_name }, risk, sessionId }, { status: 201 });
  res.cookies.set("access_token", accessToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: accessTTLSeconds(), path: "/" });
  res.cookies.set("refresh_token", refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: refreshTTLSeconds(), path: "/" });
  return res;
}
