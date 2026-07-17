import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { redis } from "@/lib/redis";

const DEMO_TID = "c7ed9c17-0633-49df-9bc7-81de55f69fb7";

function tid(claims: any): string {
  const raw = claims.tid as string | undefined;
  return !raw || raw === "default" ? DEMO_TID : raw;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const stored = await redis.get<{ steps: unknown[]; flows: unknown[]; events: unknown[] }>(
      `tenant:onboarding:${tid(claims)}`
    );
    return NextResponse.json(stored ?? { steps: [], flows: [], events: [] });
  } catch {
    return NextResponse.json({ steps: [], flows: [], events: [] });
  }
}

export async function PUT(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  try {
    await redis.set(`tenant:onboarding:${tid(claims)}`, body, { ex: 86400 * 365 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false });
  }
}
