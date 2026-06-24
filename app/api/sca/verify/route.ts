import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken, signAccessToken, signRefreshToken, accessTTLSeconds, refreshTTLSeconds } from "@/lib/jwt";
import { hashToken, generateId, getClientIP } from "@/lib/auth";
import { cacheSession } from "@/lib/redis";
import * as OTPAuth from "otpauth";

export async function POST(req: NextRequest) {
  const scaToken = req.cookies.get("sca_token")?.value;
  if (!scaToken) return NextResponse.json({ error: "missing_sca_token" }, { status: 401 });

  const claims = await verifyToken(scaToken);
  if (!claims || (claims as any).ttype !== "sca_challenge") {
    return NextResponse.json({ error: "invalid_sca_token" }, { status: 401 });
  }

  const { code, method } = await req.json();
  const ip = getClientIP(req);

  const userResult = await sql`SELECT id, email, display_name, totp_secret FROM users WHERE id = ${claims.sub}`;
  const user = userResult.rows[0];
  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  let verified = false;

  if (method === "totp" && user.totp_secret) {
    const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(user.totp_secret), digits: 6, period: 30 });
    const delta = totp.validate({ token: code, window: 1 });
    verified = delta !== null;
  } else if (method === "email_otp") {
    const codeHash = require("crypto").createHash("sha256").update(code).digest("hex");
    const challenge = await sql`
      SELECT id FROM sca_challenges
      WHERE user_id = ${user.id} AND method = 'email_otp' AND code_hash = ${codeHash}
        AND status = 'pending' AND expires_at > NOW()
      ORDER BY created_at DESC LIMIT 1
    `;
    if (challenge.rows.length > 0) {
      await sql`UPDATE sca_challenges SET status = 'completed' WHERE id = ${challenge.rows[0].id}`;
      verified = true;
    }
  }

  if (!verified) {
    await sql`INSERT INTO audit_logs (user_id, action, outcome, ip_address, details) VALUES (${user.id}, 'auth.sca.failed', 'failure', ${ip}, ${JSON.stringify({ method })})`;
    return NextResponse.json({ error: "invalid_code", message: "Incorrect verification code" }, { status: 401 });
  }

  // Issue full tokens with SCA claims
  const sessionId = generateId();
  const familyId = generateId();
  const tokenClaims = { sub: user.id, email: user.email, tid: "default", sid: sessionId, amr: ["pwd", method], acr: "silver", sca: true, sca_method: method, fid: familyId, roles: ["user"] };

  const accessToken = await signAccessToken(tokenClaims);
  const refreshToken = await signRefreshToken(tokenClaims);

  const expiresAt = new Date(Date.now() + refreshTTLSeconds() * 1000).toISOString();
  await sql`INSERT INTO sessions (id, user_id, refresh_token_hash, family_id, ip_address, amr, sca_completed, expires_at) VALUES (${sessionId}, ${user.id}, ${hashToken(refreshToken)}, ${familyId}, ${ip}, ${JSON.stringify(["pwd", method])}, true, ${expiresAt})`;
  await cacheSession(sessionId, { userId: user.id, email: user.email }, refreshTTLSeconds());
  await sql`INSERT INTO audit_logs (user_id, session_id, action, ip_address, details) VALUES (${user.id}, ${sessionId}, 'auth.sca.complete', ${ip}, ${JSON.stringify({ method })})`;
  await sql`UPDATE users SET last_login_at = NOW(), last_login_ip = ${ip} WHERE id = ${user.id}`;

  const res = NextResponse.json({ user: { id: user.id, email: user.email, displayName: user.display_name }, sessionId, scaMethod: method });
  res.cookies.set("access_token", accessToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: accessTTLSeconds(), path: "/" });
  res.cookies.set("refresh_token", refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: refreshTTLSeconds(), path: "/" });
  res.cookies.delete("sca_token");
  return res;
}
