import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { redis } from "@/lib/redis";
import { sql } from "@vercel/postgres";
import { createHash } from "crypto";

const DEMO_TID = "c7ed9c17-0633-49df-9bc7-81de55f69fb7";

function generateAppKey(appId: string): string {
  const prefix = appId.replace(/-/g, "").slice(0, 8);
  const random = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  return `uth_live_${prefix}_${random}`;
}

async function getApp(id: string, tid: string) {
  const result = await sql`
    SELECT id, name, tenant_id FROM applications WHERE id = ${id} AND tenant_id = ${tid}
  `;
  return result.rows[0] || null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rawTid = claims.tid as string | undefined;
  const tid = (!rawTid || rawTid === "default") ? DEMO_TID : rawTid;

  const app = await getApp(id, tid);
  if (!app) return NextResponse.json({ error: "not found" }, { status: 404 });

  const meta = await redis.get<{ tid: string; appId: string; appName: string; createdAt: string; revokedAt?: string }>(`app:apikey:meta:${id}`);
  const currentKey = await redis.get<string>(`app:apikey:${id}`);

  if (!currentKey || !meta) return NextResponse.json({ hasKey: false });

  const keyMasked = `${currentKey.slice(0, 14)}...${currentKey.slice(-4)}`;
  return NextResponse.json({
    hasKey: true,
    keyMasked,
    keyPrefix: currentKey.slice(0, 14),
    keySuffix: currentKey.slice(-4),
    createdAt: meta.createdAt,
    revokedAt: meta.revokedAt || null,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rawTid = claims.tid as string | undefined;
  const tid = (!rawTid || rawTid === "default") ? DEMO_TID : rawTid;

  const app = await getApp(id, tid);
  if (!app) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  if (action === "regenerate") {
    const oldKey = await redis.get<string>(`app:apikey:${id}`);
    if (oldKey) {
      const oldHash = createHash("sha256").update(oldKey).digest("hex");
      await redis.del(`app:apikey:lookup:${oldHash}`);
    }
    const newKey = generateAppKey(id);
    const hash = createHash("sha256").update(newKey).digest("hex");
    const meta = { tid, appId: id, appName: app.name, createdAt: new Date().toISOString() };
    await redis.set(`app:apikey:${id}`, newKey);
    await redis.set(`app:apikey:lookup:${hash}`, meta);
    await redis.set(`app:apikey:meta:${id}`, meta);
    return NextResponse.json({ key: newKey, createdAt: meta.createdAt });
  }

  if (action === "revoke") {
    const currentKey = await redis.get<string>(`app:apikey:${id}`);
    if (currentKey) {
      const hash = createHash("sha256").update(currentKey).digest("hex");
      await redis.del(`app:apikey:lookup:${hash}`);
      await redis.del(`app:apikey:${id}`);
    }
    const meta = await redis.get<Record<string, unknown>>(`app:apikey:meta:${id}`);
    await redis.set(`app:apikey:meta:${id}`, { ...(meta || {}), revokedAt: new Date().toISOString() });
    return NextResponse.json({ success: true, revokedAt: new Date().toISOString() });
  }

  return NextResponse.json({ error: "invalid action" }, { status: 400 });
}
