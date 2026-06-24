import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/jwt";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const totp = new OTPAuth.TOTP({
    issuer: "AuthService",
    label: claims.email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });

  const secret = totp.secret.base32;
  const uri = totp.toString();
  const qrDataURL = await QRCode.toDataURL(uri);

  // Store the unverified secret
  await sql`UPDATE users SET totp_secret = ${secret}, totp_verified = false, mfa_enabled = false WHERE id = ${claims.sub}`;

  return NextResponse.json({ secret, uri, qrDataURL });
}

export async function PUT(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { code } = await req.json();
  const userResult = await sql`SELECT totp_secret FROM users WHERE id = ${claims.sub}`;
  const user = userResult.rows[0];

  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(user.totp_secret), digits: 6, period: 30 });
  const delta = totp.validate({ token: code, window: 1 });
  if (delta === null) return NextResponse.json({ error: "invalid_code", message: "Incorrect TOTP code" }, { status: 400 });

  await sql`UPDATE users SET totp_verified = true, mfa_enabled = true WHERE id = ${claims.sub}`;
  await sql`INSERT INTO audit_logs (user_id, action, details) VALUES (${claims.sub}, 'auth.mfa.enroll', '{"method":"totp"}')`;

  return NextResponse.json({ success: true, message: "TOTP authenticator enrolled successfully" });
}
