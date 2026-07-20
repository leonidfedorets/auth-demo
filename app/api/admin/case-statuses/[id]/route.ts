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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  let body: { label?: string; color?: string; description?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  try {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let p = 1;
    if (body.label !== undefined) { sets.push(`label = $${p++}`); vals.push(body.label); }
    if (body.color !== undefined) { sets.push(`color = $${p++}`); vals.push(body.color); }
    if (body.description !== undefined) { sets.push(`description = $${p++}`); vals.push(body.description); }
    if (!sets.length) return NextResponse.json({ error: "nothing to update" }, { status: 400 });
    vals.push(id);
    await sql.query(`UPDATE case_statuses SET ${sets.join(", ")} WHERE id = $${p}`, vals);
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
    const row = await sql`SELECT is_system FROM case_statuses WHERE id = ${id}`;
    if (!row.rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (row.rows[0].is_system) return NextResponse.json({ error: "Cannot delete a system status" }, { status: 400 });
    // remove any transitions referencing this status
    await sql`DELETE FROM case_type_transitions WHERE from_status = ${id} OR to_status = ${id}`;
    await sql`DELETE FROM case_statuses WHERE id = ${id}`;
    return NextResponse.json({ deleted: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
