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
    const fields = await sql`
      SELECT * FROM case_type_fields WHERE case_type_id = ${id} ORDER BY sort_order
    `;
    return NextResponse.json({ fields: fields.rows.map(f => ({
      id: f.id, key: f.field_key, label: f.label, type: f.field_type,
      requiredAt: f.required_at, options: f.options ?? [], active: f.active,
      conditionalOn: f.conditional_on ?? null, sortOrder: f.sort_order,
    })) });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const { key, label, type: ftype, requiredAt, options, conditionalOn } = body as {
    key: string; label: string; type: string; requiredAt?: string;
    options?: string[]; conditionalOn?: { key: string; value: string } | null;
  };
  if (!key?.trim()) return NextResponse.json({ error: "key required" }, { status: 400 });
  if (!label?.trim()) return NextResponse.json({ error: "label required" }, { status: 400 });
  if (!ftype) return NextResponse.json({ error: "type required" }, { status: 400 });

  try {
    const maxOrder = await sql`SELECT COALESCE(MAX(sort_order), -1) AS m FROM case_type_fields WHERE case_type_id = ${id}`;
    const sortOrder = Number(maxOrder.rows[0].m) + 1;

    const result = await sql`
      INSERT INTO case_type_fields (case_type_id, field_key, label, field_type, required_at, options, conditional_on, sort_order)
      VALUES (${id}, ${key.trim()}, ${label.trim()}, ${ftype}, ${requiredAt ?? "optional"},
              ${JSON.stringify(options ?? [])}, ${conditionalOn ? JSON.stringify(conditionalOn) : null}, ${sortOrder})
      RETURNING *
    `;
    await sql`UPDATE case_types SET version = version + 1, updated_at = NOW() WHERE id = ${id}`;
    const f = result.rows[0];
    return NextResponse.json({
      id: f.id, key: f.field_key, label: f.label, type: f.field_type,
      requiredAt: f.required_at, options: f.options, active: f.active,
      conditionalOn: f.conditional_on ?? null, sortOrder: f.sort_order,
    }, { status: 201 });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
