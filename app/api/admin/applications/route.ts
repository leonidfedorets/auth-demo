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

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS applications (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id   UUID NOT NULL,
      name        VARCHAR(100) NOT NULL,
      description TEXT,
      is_active   BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_applications_tenant ON applications(tenant_id)`;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rawTid = claims.tid as string | undefined;
  const tid = (!rawTid || rawTid === "default") ? DEMO_TID : rawTid;

  try {
    await ensureTable();
    const result = await sql`
      SELECT id, tenant_id, name, description, is_active, created_at, updated_at
      FROM applications
      WHERE tenant_id = ${tid}
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ applications: result.rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rawTid = claims.tid as string | undefined;
  const tid = (!rawTid || rawTid === "default") ? DEMO_TID : rawTid;

  const body = await req.json().catch(() => ({}));
  const { name, description } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (name.trim().length > 100) {
    return NextResponse.json({ error: "name must be 100 characters or fewer" }, { status: 400 });
  }

  try {
    await ensureTable();
    const result = await sql`
      INSERT INTO applications (tenant_id, name, description)
      VALUES (${tid}, ${name.trim()}, ${description || null})
      RETURNING id, tenant_id, name, description, is_active, created_at, updated_at
    `;
    const app = result.rows[0];

    // Generate first API key
    const key = generateAppKey(app.id);
    const hash = createHash("sha256").update(key).digest("hex");
    const meta = { tid, appId: app.id, appName: app.name, createdAt: new Date().toISOString() };

    await redis.set(`app:apikey:${app.id}`, key);
    await redis.set(`app:apikey:lookup:${hash}`, meta);
    await redis.set(`app:apikey:meta:${app.id}`, meta);

    return NextResponse.json({ application: app, key }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
