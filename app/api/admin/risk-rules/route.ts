import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { redis } from "@/lib/redis";

const DEFAULT_RULES = {
  thresholds: { low: 25, medium: 50, high: 75 },
  stepUpThreshold: 40,
  denyThreshold: 75,
  overrides: [
    { id: "A", name: "Tor Exit Node", action: "DENY", enabled: true },
    { id: "B", name: "Root/Jailbreak", action: "DENY", enabled: true },
    { id: "C", name: "Biometric + Known Device", action: "ALLOW_REDUCE_25", enabled: true },
    { id: "D", name: "Score > 75", action: "DENY_LOCK", enabled: true },
    { id: "E", name: "Score 40-75 no SCA", action: "REQUIRE_SCA", enabled: true },
  ],
  deviceAttestation: {
    requiredForPayments: true,
    blockRooted: true,
    blockEmulator: true,
    blockDebug: false,
    minimumStatus: "healthy",
  },
};

export async function GET(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const stored = await redis.get<typeof DEFAULT_RULES>(`risk:rules:${(claims.tid && claims.tid !== "default" ? claims.tid : "c7ed9c17-0633-49df-9bc7-81de55f69fb7")}`);
    return NextResponse.json({ rules: stored || DEFAULT_RULES });
  } catch {
    return NextResponse.json({ rules: DEFAULT_RULES });
  }
}

export async function PUT(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  try {
    await redis.set(`risk:rules:${(claims.tid && claims.tid !== "default" ? claims.tid : "c7ed9c17-0633-49df-9bc7-81de55f69fb7")}`, body, { ex: 86400 * 365 });
    return NextResponse.json({ success: true, rules: body });
  } catch {
    return NextResponse.json({ success: true, rules: body });
  }
}
