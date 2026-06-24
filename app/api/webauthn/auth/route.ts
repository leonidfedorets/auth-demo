import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken, signAccessToken, signRefreshToken, accessTTLSeconds, refreshTTLSeconds } from "@/lib/jwt";
import { storeWebAuthnChallenge, getWebAuthnChallenge, deleteWebAuthnChallenge, cacheSession } from "@/lib/redis";
import { hashToken, generateId, getClientIP } from "@/lib/auth";
import { generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";

const rpID = process.env.WEBAUTHN_RP_ID ?? "localhost";
const origin = process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "begin";
  const token = req.cookies.get("access_token")?.value;

  if (action === "begin") {
    // Can be called with or without a session (for passwordless login)
    const claims = token ? await verifyToken(token) : null;
    const userId = claims?.sub ?? (await req.json().catch(() => ({}))).userId;
    if (!userId) return NextResponse.json({ error: "user_id_required" }, { status: 400 });

    const credentials = await sql`SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = ${userId}`;
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: credentials.rows.map(c => ({
        id: c.credential_id,
        type: "public-key" as const,
        transports: JSON.parse(c.transports || "[]"),
      })),
      userVerification: "preferred",
    });

    await storeWebAuthnChallenge(userId, options.challenge, "auth");
    return NextResponse.json(options);
  }

  // finish
  const claims = token ? await verifyToken(token) : null;
  const body = await req.json();
  const userId = claims?.sub ?? body.userId;
  if (!userId) return NextResponse.json({ error: "user_id_required" }, { status: 400 });

  const expectedChallenge = await getWebAuthnChallenge(userId, "auth");
  if (!expectedChallenge) return NextResponse.json({ error: "challenge_expired" }, { status: 400 });

  const credResult = await sql`SELECT * FROM webauthn_credentials WHERE credential_id = ${body.id} AND user_id = ${userId}`;
  if (!credResult.rows.length) return NextResponse.json({ error: "credential_not_found" }, { status: 404 });

  const storedCred = credResult.rows[0];
  const verification = await verifyAuthenticationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: storedCred.credential_id,
      publicKey: Buffer.from(storedCred.public_key, "base64url"),
      counter: storedCred.counter,
    },
  });

  if (!verification.verified) return NextResponse.json({ error: "verification_failed" }, { status: 401 });

  await deleteWebAuthnChallenge(userId, "auth");
  await sql`UPDATE webauthn_credentials SET counter = ${verification.authenticationInfo.newCounter}, last_used_at = NOW() WHERE id = ${storedCred.id}`;

  // Issue tokens with gold ACR
  const userResult = await sql`SELECT email, display_name FROM users WHERE id = ${userId}`;
  const user = userResult.rows[0];
  const sessionId = generateId();
  const familyId = generateId();
  const ip = getClientIP(req);

  const tokenClaims = { sub: userId, email: user.email, tid: "default", sid: sessionId, amr: ["hwk"], acr: "gold", sca: true, sca_method: "webauthn", fid: familyId, roles: ["user"] };
  const accessTok = await signAccessToken(tokenClaims);
  const refreshTok = await signRefreshToken(tokenClaims);

  const expiresAt = new Date(Date.now() + refreshTTLSeconds() * 1000).toISOString();
  await sql`INSERT INTO sessions (id, user_id, refresh_token_hash, family_id, ip_address, amr, sca_completed, expires_at) VALUES (${sessionId}, ${userId}, ${hashToken(refreshTok)}, ${familyId}, ${ip}, '["hwk"]', true, ${expiresAt})`;
  await cacheSession(sessionId, { userId, email: user.email }, refreshTTLSeconds());
  await sql`INSERT INTO audit_logs (user_id, session_id, action, ip_address, details) VALUES (${userId}, ${sessionId}, 'auth.webauthn.login', ${ip}, '{"acr":"gold"}')`;

  const res = NextResponse.json({ verified: true, user: { id: userId, email: user.email, displayName: user.display_name } });
  res.cookies.set("access_token", accessTok, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: accessTTLSeconds(), path: "/" });
  res.cookies.set("refresh_token", refreshTok, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: refreshTTLSeconds(), path: "/" });
  return res;
}
