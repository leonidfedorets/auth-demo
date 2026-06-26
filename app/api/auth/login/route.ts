import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { signAccessToken, signRefreshToken, signSCAChallengeToken, accessTTLSeconds, refreshTTLSeconds } from "@/lib/jwt";
import { verifyPassword, hashToken, generateId, getClientIP } from "@/lib/auth";
import { cacheSession, loginRateLimit, incrementFailedLogins, resetFailedLogins, redis } from "@/lib/redis";
import { evaluateRisk } from "@/lib/risk";

// Ensure tenant_id column exists — safe to run repeatedly
async function ensureSchema() {
  try {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID`;
  } catch { /* column already exists or table doesn't exist yet */ }
}

export async function POST(req: NextRequest) {
  try {
  await ensureSchema();
  const ip = getClientIP(req);
  const ua = req.headers.get("user-agent") ?? "";

  let rateLimitSuccess = true;
  try {
    const rl = await loginRateLimit.limit(ip);
    rateLimitSuccess = rl.success;
  } catch { /* Redis unavailable — skip rate limit */ }
  const success = rateLimitSuccess;
  if (!success) return NextResponse.json({ error: "rate_limit_exceeded", message: "Too many login attempts" }, { status: 429 });

  const body = await req.json();
  const { email, password, fingerprint } = body;
  if (!email || !password) return NextResponse.json({ error: "validation_error", message: "Email and password required" }, { status: 400 });

  // Pre-auth risk (before credential check to avoid timing oracle)
  const preRisk = await evaluateRisk({ ip, userAgent: ua, fingerprint, action: "login" });
  if (preRisk.decision === "deny") {
    await sql`INSERT INTO audit_logs (action, outcome, ip_address, details) VALUES ('auth.login', 'failure', ${ip}, ${JSON.stringify({ reason: "risk_deny", score: preRisk.score })})`;
    return NextResponse.json({ error: "access_denied", message: "Request blocked by security policy", risk: preRisk }, { status: 403 });
  }

  // Credential lookup
  const result = await sql`SELECT id, email, password_hash, display_name, mfa_enabled, totp_verified, locked, failed_attempts, last_login_ip, tenant_id FROM users WHERE email = ${email}`;
  if (result.rows.length === 0) {
    await incrementFailedLogins(ip);
    return NextResponse.json({ error: "invalid_credentials", message: "Invalid email or password" }, { status: 401 });
  }
  const user = result.rows[0];

  if (user.locked) return NextResponse.json({ error: "account_locked", message: "Account is locked. Contact support." }, { status: 401 });

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    await incrementFailedLogins(ip);
    await sql`UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = ${user.id}`;
    // Lock after 10 failures
    if (user.failed_attempts >= 9) await sql`UPDATE users SET locked = true WHERE id = ${user.id}`;
    await sql`INSERT INTO audit_logs (user_id, action, outcome, ip_address, user_agent, details) VALUES (${user.id}, 'auth.login.failed', 'failure', ${ip}, ${ua}, ${JSON.stringify({ attempts: user.failed_attempts + 1 })})`;
    return NextResponse.json({ error: "invalid_credentials", message: "Invalid email or password" }, { status: 401 });
  }

  await resetFailedLogins(ip);
  await sql`UPDATE users SET failed_attempts = 0 WHERE id = ${user.id}`;

  // Full risk with user context
  const risk = await evaluateRisk({
    ip, userAgent: ua, userId: user.id, fingerprint,
    previousCountry: user.last_login_ip ? undefined : undefined,
    isNewDevice: !fingerprint,
    action: "login",
  });

  const amr = ["pwd"];
  const acr = "bronze";
  const familyId = generateId();
  const sessionId = generateId();

  // SCA gate
  const scaRequired = risk.score >= 40 || (user.mfa_enabled && user.totp_verified);
  if (scaRequired) {
    const scaToken = await signSCAChallengeToken(user.id, user.email, sessionId, user.totp_verified ? "totp" : "email_otp");
    const method = user.totp_verified ? "totp" : "email_otp";

    if (method === "email_otp") {
      // Generate a 6-digit code (in production: send via email)
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const codeHash = require("crypto").createHash("sha256").update(code).digest("hex");
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await sql`INSERT INTO sca_challenges (user_id, method, code_hash, expires_at) VALUES (${user.id}, 'email_otp', ${codeHash}, ${expiresAt})`;
      // SCA code issued — deliver via configured channel (email/SMS/push)
    }

    await sql`INSERT INTO audit_logs (user_id, action, ip_address, user_agent, risk_score, details) VALUES (${user.id}, 'auth.sca.challenge', ${ip}, ${ua}, ${risk.score}, ${JSON.stringify({ method, reason: risk.decision })})`;

    const res = NextResponse.json({ scaRequired: true, method, sessionId, risk }, { status: 200 });
    res.cookies.set("sca_token", scaToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/" });
    return res;
  }

  // Issue full tokens
  const tid = user.tenant_id || "c7ed9c17-0633-49df-9bc7-81de55f69fb7";
  const claims = { sub: user.id, email: user.email, tid, sid: sessionId, amr, acr, risk: risk.score, risk_lvl: risk.level, fid: familyId, roles: ["user"] };
  const accessToken = await signAccessToken(claims);
  const refreshToken = await signRefreshToken(claims);

  const expiresAt = new Date(Date.now() + refreshTTLSeconds() * 1000).toISOString();
  await sql`
    INSERT INTO sessions (id, user_id, refresh_token_hash, family_id, ip_address, user_agent, amr, risk_score, expires_at)
    VALUES (${sessionId}, ${user.id}, ${hashToken(refreshToken)}, ${familyId}, ${ip}, ${ua}, ${JSON.stringify(amr)}, ${risk.score}, ${expiresAt})
  `;
  await cacheSession(sessionId, { userId: user.id, email: user.email }, refreshTTLSeconds());
  await sql`UPDATE users SET last_login_at = NOW(), last_login_ip = ${ip} WHERE id = ${user.id}`;
  await sql`INSERT INTO audit_logs (user_id, session_id, action, ip_address, user_agent, risk_score, details) VALUES (${user.id}, ${sessionId}, 'auth.login', ${ip}, ${ua}, ${risk.score}, ${JSON.stringify({ amr })})`;

  // Record transaction in Redis for the Transactions dashboard
  const txRecord = {
    id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tid,
    type: "auth",
    subtype: "login_success",
    userId: user.email,
    email: user.email,
    ip,
    userAgent: ua,
    sessionId,
    risk: { score: risk.score, level: risk.level, decision: risk.decision },
    risk_score: risk.score,
    risk_level: risk.level,
    decision: risk.decision,
    amr,
    acr,
    ts: Date.now(),
    createdAt: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
  await redis.lpush(`tenant:transactions:${tid}`, JSON.stringify(txRecord)).catch(() => {});
  await redis.ltrim(`tenant:transactions:${tid}`, 0, 499).catch(() => {});

  const res = NextResponse.json({
    user: { id: user.id, email: user.email, displayName: user.display_name, mfaEnabled: user.mfa_enabled },
    sessionId, risk,
  });
  res.cookies.set("access_token", accessToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: accessTTLSeconds(), path: "/" });
  res.cookies.set("refresh_token", refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: refreshTTLSeconds(), path: "/" });
  return res;
  } catch (err) {
    console.error("[login] unexpected error:", err);
    return NextResponse.json({ error: "server_error", message: "An unexpected error occurred" }, { status: 500 });
  }
}
