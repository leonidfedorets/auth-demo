import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/jwt";
import { verifyApiKey } from "@/lib/api-key-auth";

async function authenticate(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (token) { const c = await verifyToken(token); if (c) return { ok: true }; }
  const a = await verifyApiKey(req as unknown as Request);
  if (a) return { ok: true };
  return null;
}

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS org_departments (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL UNIQUE,
      description TEXT,
      head_email  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS org_dept_members (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dept_id       UUID NOT NULL REFERENCES org_departments(id) ON DELETE CASCADE,
      member_type   TEXT NOT NULL CHECK (member_type IN ('user','role')),
      ref           TEXT NOT NULL,
      added_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(dept_id, member_type, ref)
    )
  `;
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await ensureTables();
    const [depts, members] = await Promise.all([
      sql`SELECT * FROM org_departments ORDER BY name`,
      sql`SELECT * FROM org_dept_members ORDER BY dept_id, added_at`,
    ]);
    const result = depts.rows.map(d => ({
      id: d.id, name: d.name, description: d.description ?? "", headEmail: d.head_email ?? "",
      createdAt: d.created_at,
      members: members.rows
        .filter(m => m.dept_id === d.id)
        .map(m => ({ type: m.member_type, ref: m.ref })),
    }));
    return NextResponse.json({ departments: result });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { name: string; description?: string; headEmail?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  try {
    await ensureTables();
    const row = await sql`
      INSERT INTO org_departments (name, description, head_email)
      VALUES (${body.name.trim()}, ${body.description?.trim() ?? null}, ${body.headEmail?.trim() ?? null})
      RETURNING id, name, description, head_email, created_at
    `;
    const d = row.rows[0];
    return NextResponse.json({ id: d.id, name: d.name, description: d.description ?? "", headEmail: d.head_email ?? "", members: [] }, { status: 201 });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
