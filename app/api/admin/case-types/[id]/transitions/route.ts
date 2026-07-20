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

const DEFAULT_FLOW_STATUSES = ["new","active","rfi","handoff","complete","reject","pending_approval","closed"];

async function ensureFlowStatusesColumn() {
  await sql`
    ALTER TABLE case_types
    ADD COLUMN IF NOT EXISTS flow_statuses JSONB DEFAULT '["new","active","rfi","handoff","complete","reject","pending_approval","closed"]'
  `;
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
    await ensureFlowStatusesColumn();
    const [rows, typeRow] = await Promise.all([
      sql`SELECT * FROM case_type_transitions WHERE case_type_id = ${id} ORDER BY from_status, to_status`,
      sql`SELECT flow_statuses FROM case_types WHERE id = ${id}`,
    ]);
    const flowStatuses: string[] = typeRow.rows[0]?.flow_statuses ?? DEFAULT_FLOW_STATUSES;
    return NextResponse.json({
      flowStatuses,
      transitions: rows.rows.map(r => ({
        id: r.id, from: r.from_status, to: r.to_status,
        requiresReason: r.requires_reason, notifyRoles: r.notify_roles ?? [],
        autoAction: r.auto_action ?? null,
      })),
    });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

// PUT /api/admin/case-types/[id]/transitions — full replacement
// Body: { transitions: [...], flowStatuses?: string[] }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: {
    transitions: Array<{ from: string; to: string; requiresReason?: boolean; notifyRoles?: string[]; autoAction?: string | null }>;
    flowStatuses?: string[];
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  if (!Array.isArray(body.transitions)) return NextResponse.json({ error: "transitions array required" }, { status: 400 });

  try {
    await ensureFlowStatusesColumn();

    // Save flow statuses if provided
    if (Array.isArray(body.flowStatuses)) {
      await sql`UPDATE case_types SET flow_statuses = ${JSON.stringify(body.flowStatuses)} WHERE id = ${id}`;
      // Remove transitions that reference statuses no longer in the flow
      const flowSet = new Set(body.flowStatuses);
      const filteredTransitions = body.transitions.filter(t => flowSet.has(t.from) && flowSet.has(t.to));
      body = { ...body, transitions: filteredTransitions };
    }

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
