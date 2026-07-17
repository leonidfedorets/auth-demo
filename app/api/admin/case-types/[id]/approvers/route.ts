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
    const rows = await sql`SELECT * FROM case_type_approver_templates WHERE case_type_id = ${id} ORDER BY sort_order`;
    return NextResponse.json({ approvers: rows.rows.map(a => ({ id: a.id, name: a.name, role: a.role, sortOrder: a.sort_order })) });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: { name: string; role: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!body.role?.trim()) return NextResponse.json({ error: "role required" }, { status: 400 });

  try {
    const maxOrder = await sql`SELECT COALESCE(MAX(sort_order), -1) AS m FROM case_type_approver_templates WHERE case_type_id = ${id}`;
    const sortOrder = Number(maxOrder.rows[0].m) + 1;
    const result = await sql`
      INSERT INTO case_type_approver_templates (case_type_id, name, role, sort_order)
      VALUES (${id}, ${body.name.trim()}, ${body.role.trim()}, ${sortOrder})
      RETURNING *
    `;
    const a = result.rows[0];
    return NextResponse.json({ id: a.id, name: a.name, role: a.role, sortOrder: a.sort_order }, { status: 201 });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
