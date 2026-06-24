import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { challengeId, method, otp, amount, iban } = body;

  if (!challengeId) {
    return NextResponse.json({ result: "DENY", reason: "missing_challenge_id" }, { status: 400 });
  }

  const stored = await redis.get<string>(`sca:challenge:${challengeId}`);
  if (!stored) {
    return NextResponse.json({ result: "DENY", reason: "challenge_expired_or_not_found" });
  }

  const challenge = typeof stored === "string" ? JSON.parse(stored) : stored as Record<string, unknown>;
  if ((challenge as any).consumed) {
    return NextResponse.json({ result: "DENY", reason: "challenge_already_consumed" });
  }

  // Demo verification: TOTP/email_otp requires code "123456", others auto-pass
  let verified = false;
  if (method === "totp" || method === "email_otp") {
    verified = otp === "123456";
  } else {
    verified = true; // webauthn / push: simulate success in demo
  }

  if (!verified) {
    return NextResponse.json({ result: "DENY", reason: "invalid_credentials" });
  }

  // Mark consumed (single-use)
  await redis.del(`sca:challenge:${challengeId}`);

  const acrMap: Record<string, string> = { webauthn: "gold", totp: "silver", push: "silver", email_otp: "bronze" };
  const amrMap: Record<string, string[]> = { webauthn: ["hwk"], totp: ["otp", "mfa"], push: ["push", "mfa"], email_otp: ["otp"] };

  return NextResponse.json({
    result: "ALLOW",
    scaMethod: method,
    challengeId,
    jwtClaims: {
      sca: true,
      sca_method: method,
      acr: acrMap[method] ?? "silver",
      amr: amrMap[method] ?? ["otp"],
      sca_ts: Math.floor(Date.now() / 1000),
    },
  });
}
