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
  { params }: { params: Promise<{ id: string; approverId: string }> },
) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, approverId } = await params;

  let body: { name?: string; role?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  try {
    await sql`
      UPDATE case_type_approver_templates
      SET name = COALESCE(${body.name ?? null}, name), role = COALESCE(${body.role ?? null}, role)
      WHERE id = ${approverId} AND case_type_id = ${id}
    `;
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; approverId: string }> },
) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, approverId } = await params;

  let body: { direction?: "up" | "down" };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  try {
    const all = await sql`SELECT id, sort_order FROM case_type_approver_templates WHERE case_type_id = ${id} ORDER BY sort_order`;
    const idx = all.rows.findIndex(r => r.id === approverId);
    if (idx === -1) return NextResponse.json({ error: "not found" }, { status: 404 });
    const swapIdx = body.direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= all.rows.length) return NextResponse.json({ success: true });
    const a = all.rows[idx], b = all.rows[swapIdx];
    await sql`UPDATE case_type_approver_templates SET sort_order = ${b.sort_order} WHERE id = ${a.id}`;
    await sql`UPDATE case_type_approver_templates SET sort_order = ${a.sort_order} WHERE id = ${b.id}`;
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; approverId: string }> },
) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, approverId } = await params;
  try {
    await sql`DELETE FROM case_type_approver_templates WHERE id = ${approverId} AND case_type_id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
