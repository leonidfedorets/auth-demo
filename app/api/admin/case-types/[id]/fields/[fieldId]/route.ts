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
  { params }: { params: Promise<{ id: string; fieldId: string }> },
) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, fieldId } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  try {
    const existing = await sql`SELECT id FROM case_type_fields WHERE id = ${fieldId} AND case_type_id = ${id}`;
    if (!existing.rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });

    await sql.query(
      `UPDATE case_type_fields SET
        label = COALESCE($1, label),
        field_type = COALESCE($2, field_type),
        required_at = COALESCE($3, required_at),
        options = COALESCE($4::jsonb, options),
        active = COALESCE($5, active),
        conditional_on = $6,
        sort_order = COALESCE($7, sort_order)
       WHERE id = $8 AND case_type_id = $9`,
      [
        body.label ?? null,
        body.type ?? null,
        body.requiredAt ?? null,
        body.options !== undefined ? JSON.stringify(body.options) : null,
        body.active !== undefined ? body.active : null,
        body.conditionalOn !== undefined ? (body.conditionalOn ? JSON.stringify(body.conditionalOn) : null) : undefined,
        body.sortOrder ?? null,
        fieldId,
        id,
      ],
    );
    await sql`UPDATE case_types SET version = version + 1, updated_at = NOW() WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> },
) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, fieldId } = await params;

  let body: { direction?: "up" | "down" };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  try {
    const fields = await sql`
      SELECT id, sort_order FROM case_type_fields WHERE case_type_id = ${id} ORDER BY sort_order
    `;
    const idx = fields.rows.findIndex(f => f.id === fieldId);
    if (idx === -1) return NextResponse.json({ error: "not found" }, { status: 404 });
    const swapIdx = body.direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= fields.rows.length) return NextResponse.json({ success: true });

    const a = fields.rows[idx], b = fields.rows[swapIdx];
    await sql`UPDATE case_type_fields SET sort_order = ${b.sort_order} WHERE id = ${a.id}`;
    await sql`UPDATE case_type_fields SET sort_order = ${a.sort_order} WHERE id = ${b.id}`;
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> },
) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, fieldId } = await params;
  try {
    await sql`DELETE FROM case_type_fields WHERE id = ${fieldId} AND case_type_id = ${id}`;
    await sql`UPDATE case_types SET version = version + 1, updated_at = NOW() WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
