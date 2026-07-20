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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const [role, members] = await Promise.all([
      sql`SELECT * FROM case_roles WHERE id = ${id}`,
      sql`SELECT user_email, assigned_at FROM case_role_users WHERE role_id = ${id} ORDER BY assigned_at`,
    ]);
    if (!role.rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
    const r = role.rows[0];
    return NextResponse.json({
      id: r.id, name: r.name, description: r.description ?? "", color: r.color,
      members: members.rows.map(m => ({ email: m.user_email, assignedAt: m.assigned_at })),
    });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: { name?: string; description?: string; color?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  try {
    const parts: string[] = [];
    const vals: unknown[] = [];
    let p = 1;
    if (body.name !== undefined) { parts.push(`name = $${p++}`); vals.push(body.name.trim()); }
    if (body.description !== undefined) { parts.push(`description = $${p++}`); vals.push(body.description); }
    if (body.color !== undefined) { parts.push(`color = $${p++}`); vals.push(body.color); }
    if (!parts.length) return NextResponse.json({ success: true });
    vals.push(id);
    await sql.query(`UPDATE case_roles SET ${parts.join(", ")} WHERE id = $${p}`, vals);
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await sql`DELETE FROM case_roles WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
