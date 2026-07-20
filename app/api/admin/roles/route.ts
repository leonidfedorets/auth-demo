import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/jwt";
import { verifyApiKey } from "@/lib/api-key-auth";

async function authenticate(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (token) { const c = await verifyToken(token); if (c) return { email: c.email as string }; }
  const a = await verifyApiKey(req as unknown as Request);
  if (a) return { email: "api" };
  return null;
}

const COLORS = ["indigo","blue","green","red","amber","purple","teal","pink","orange","cyan"];

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS case_roles (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL UNIQUE,
      description TEXT,
      color       TEXT NOT NULL DEFAULT 'indigo',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS case_role_users (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      role_id     UUID NOT NULL REFERENCES case_roles(id) ON DELETE CASCADE,
      user_email  TEXT NOT NULL,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(role_id, user_email)
    )
  `;
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mine = searchParams.get("mine") === "true";

  try {
    await ensureTables();

    if (mine) {
      const rows = await sql`
        SELECT r.id, r.name, r.color
        FROM case_roles r
        JOIN case_role_users ru ON ru.role_id = r.id
        WHERE ru.user_email = ${auth.email}
        ORDER BY r.name
      `;
      return NextResponse.json({ roles: rows.rows });
    }

    const rows = await sql`
      SELECT r.id, r.name, r.description, r.color, r.created_at,
        COUNT(ru.id)::int AS user_count
      FROM case_roles r
      LEFT JOIN case_role_users ru ON ru.role_id = r.id
      GROUP BY r.id
      ORDER BY r.name
    `;
    return NextResponse.json({ roles: rows.rows.map(r => ({
      id: r.id, name: r.name, description: r.description ?? "",
      color: r.color, userCount: r.user_count, createdAt: r.created_at,
    }))});
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { name: string; description?: string; color?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  const color = COLORS.includes(body.color ?? "") ? body.color! : "indigo";

  try {
    await ensureTables();
    const row = await sql`
      INSERT INTO case_roles (name, description, color)
      VALUES (${body.name.trim()}, ${body.description?.trim() ?? null}, ${color})
      RETURNING id, name, description, color, created_at
    `;
    const r = row.rows[0];
    return NextResponse.json({ id: r.id, name: r.name, description: r.description ?? "", color: r.color, userCount: 0 }, { status: 201 });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
