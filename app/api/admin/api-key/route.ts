import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { redis } from "@/lib/redis";

const DEMO_TID = "c7ed9c17-0633-49df-9bc7-81de55f69fb7";

function generateApiKey(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  return `uth_live_${hex}`;
}

async function getOrCreateKey(tid: string): Promise<{ key: string; createdAt: string }> {
  const stored = await redis.get<string>(`tenant:apikey:${tid}`);
  if (stored) {
    const createdAt = (await redis.get<string>(`tenant:apikey:${tid}:created_at`)) || new Date().toISOString();
    return { key: stored, createdAt };
  }
  const newKey = generateApiKey();
  const createdAt = new Date().toISOString();
  await redis.set(`tenant:apikey:${tid}`, newKey);
  await redis.set(`tenant:apikey:${tid}:created_at`, createdAt);
  return { key: newKey, createdAt };
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tid = (claims.tid as string) || DEMO_TID;
  const { key, createdAt } = await getOrCreateKey(tid);

  const keyPrefix = "uth_live_";
  const keySuffix = key.slice(-4);
  const keyMasked = `${keyPrefix}${"•".repeat(key.length - keyPrefix.length - 4)}${keySuffix}`;

  return NextResponse.json({ keyPrefix, keySuffix, keyMasked, createdAt, tid });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body.action !== "regenerate") {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const tid = (claims.tid as string) || DEMO_TID;
  const newKey = generateApiKey();
  const createdAt = new Date().toISOString();
  await redis.set(`tenant:apikey:${tid}`, newKey);
  await redis.set(`tenant:apikey:${tid}:created_at`, createdAt);

  return NextResponse.json({ key: newKey, createdAt, tid });
}
