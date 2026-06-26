import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { verifyApiKey } from "@/lib/api-key-auth";
import { redis } from "@/lib/redis";

const DEMO_TID = "c7ed9c17-0633-49df-9bc7-81de55f69fb7";

async function authenticate(req: NextRequest): Promise<{ tid: string; sub?: string; appId?: string } | null> {
  const token = req.cookies.get("access_token")?.value;
  if (token) {
    const claims = await verifyToken(token);
    if (claims) return { tid: (claims.tid as string) || DEMO_TID, sub: claims.sub as string };
  }
  const apiAuth = await verifyApiKey(req as unknown as Request);
  if (apiAuth) return { tid: apiAuth.tid, appId: apiAuth.appId };
  return null;
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const typeFilter = searchParams.get("type");
  const userIdFilter = searchParams.get("userId");

  // Read from Redis
  const redisKey = `tenant:transactions:${auth.tid}`;
  const stored = await redis.lrange(redisKey, 0, 199);
  let transactions: Record<string, unknown>[] = [];
  if (stored && stored.length > 0) {
    transactions = stored.map(raw => typeof raw === "string" ? JSON.parse(raw) : raw as Record<string, unknown>);
  }

  const filtered = transactions.filter((t: Record<string, unknown>) => {
    if (typeFilter && typeFilter !== "all" && t.type !== typeFilter) return false;
    if (userIdFilter && t.user_id !== userIdFilter) return false;
    return true;
  });

  return NextResponse.json({ transactions: filtered, total: filtered.length });
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { type, userId, deviceId, ip, metadata } = body;

  const id = `txn-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const ts = Date.now();
  const record = { id, tid: auth.tid, type, userId, deviceId, ip, metadata, ts, status: "recorded", ...(auth.appId ? { appId: auth.appId } : {}) };

  await redis.lpush(`tenant:transactions:${auth.tid}`, JSON.stringify(record));

  return NextResponse.json({ id, tid: auth.tid, ts, status: "recorded" });
}
