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
    const [dept, members] = await Promise.all([
      sql`SELECT * FROM org_departments WHERE id = ${id}`,
      sql`SELECT * FROM org_dept_members WHERE dept_id = ${id} ORDER BY added_at`,
    ]);
    if (!dept.rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
    const d = dept.rows[0];
    return NextResponse.json({
      id: d.id, name: d.name, description: d.description ?? "", headEmail: d.head_email ?? "",
      members: members.rows.map(m => ({ type: m.member_type, ref: m.ref })),
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

  let body: { name?: string; description?: string; headEmail?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  try {
    const parts: string[] = [];
    const vals: unknown[] = [];
    let p = 1;
    if (body.name !== undefined) { parts.push(`name = $${p++}`); vals.push(body.name.trim()); }
    if (body.description !== undefined) { parts.push(`description = $${p++}`); vals.push(body.description); }
    if (body.headEmail !== undefined) { parts.push(`head_email = $${p++}`); vals.push(body.headEmail || null); }
    if (!parts.length) return NextResponse.json({ success: true });
    vals.push(id);
    await sql.query(`UPDATE org_departments SET ${parts.join(", ")} WHERE id = $${p}`, vals);
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
    await sql`DELETE FROM org_departments WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
