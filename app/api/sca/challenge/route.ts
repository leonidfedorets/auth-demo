import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { method = "totp", amount, iban, currency = "EUR" } = body;

  const challengeId = `sca_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const challenge = {
    challengeId,
    method,
    amount,
    iban,
    currency,
    issuedAt: Date.now(),
    consumed: false,
  };

  await redis.set(`sca:challenge:${challengeId}`, JSON.stringify(challenge), { ex: 600 });

  return NextResponse.json({ challengeId, method, amount, iban, currency, ttlSeconds: 600 });
}
