import { NextRequest, NextResponse } from "next/server";
import { evaluateRisk } from "@/lib/risk";
import { getClientIP } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  const body = await req.json();

  const result = await evaluateRisk({
    ip: body.ip ?? ip,
    userAgent: body.userAgent ?? req.headers.get("user-agent") ?? "",
    userId: body.userId,
    fingerprint: body.fingerprint,
    isNewDevice: body.isNewDevice,
    country: body.country,
    previousCountry: body.previousCountry,
    action: body.action ?? "evaluate",
  });

  return NextResponse.json(result);
}
