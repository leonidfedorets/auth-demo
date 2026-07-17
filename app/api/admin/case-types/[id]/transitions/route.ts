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

// GET /api/admin/case-types/[id]/transitions
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const rows = await sql`SELECT * FROM case_type_transitions WHERE case_type_id = ${id} ORDER BY from_status, to_status`;
    return NextResponse.json({ transitions: rows.rows.map(r => ({
      id: r.id, from: r.from_status, to: r.to_status,
      requiresReason: r.requires_reason, notifyRoles: r.notify_roles ?? [],
      autoAction: r.auto_action ?? null,
    })) });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

// PUT /api/admin/case-types/[id]/transitions  — full replacement of the transition set
// Body: { transitions: Array<{ from, to, requiresReason?, notifyRoles?, autoAction? }> }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: { transitions: Array<{ from: string; to: string; requiresReason?: boolean; notifyRoles?: string[]; autoAction?: string | null }> };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  if (!Array.isArray(body.transitions)) return NextResponse.json({ error: "transitions array required" }, { status: 400 });

  try {
    await sql`DELETE FROM case_type_transitions WHERE case_type_id = ${id}`;
    for (const t of body.transitions) {
      await sql`
        INSERT INTO case_type_transitions (case_type_id, from_status, to_status, requires_reason, notify_roles, auto_action)
        VALUES (${id}, ${t.from}, ${t.to}, ${t.requiresReason ?? false},
                ${JSON.stringify(t.notifyRoles ?? [])}, ${t.autoAction ?? null})
        ON CONFLICT (case_type_id, from_status, to_status) DO UPDATE
          SET requires_reason = EXCLUDED.requires_reason,
              notify_roles = EXCLUDED.notify_roles,
              auto_action = EXCLUDED.auto_action
      `;
    }
    await sql`UPDATE case_types SET version = version + 1, updated_at = NOW() WHERE id = ${id}`;
    return NextResponse.json({ success: true, count: body.transitions.length });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

// PATCH /api/admin/case-types/[id]/transitions — toggle a single transition on/off
// Body: { from, to, enabled, requiresReason?, notifyRoles?, autoAction? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: { from: string; to: string; enabled: boolean; requiresReason?: boolean; notifyRoles?: string[]; autoAction?: string | null };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  if (!body.from || !body.to) return NextResponse.json({ error: "from and to required" }, { status: 400 });

  try {
    if (body.enabled === false) {
      await sql`DELETE FROM case_type_transitions WHERE case_type_id = ${id} AND from_status = ${body.from} AND to_status = ${body.to}`;
    } else {
      await sql`
        INSERT INTO case_type_transitions (case_type_id, from_status, to_status, requires_reason, notify_roles, auto_action)
        VALUES (${id}, ${body.from}, ${body.to}, ${body.requiresReason ?? false},
                ${JSON.stringify(body.notifyRoles ?? [])}, ${body.autoAction ?? null})
        ON CONFLICT (case_type_id, from_status, to_status) DO UPDATE
          SET requires_reason = EXCLUDED.requires_reason,
              notify_roles = EXCLUDED.notify_roles,
              auto_action = EXCLUDED.auto_action
      `;
    }
    await sql`UPDATE case_types SET version = version + 1, updated_at = NOW() WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
