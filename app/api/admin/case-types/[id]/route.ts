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
    const [type, fields, transitions, approvers, sla] = await Promise.all([
      sql`SELECT * FROM case_types WHERE id = ${id}`,
      sql`SELECT * FROM case_type_fields WHERE case_type_id = ${id} ORDER BY sort_order`,
      sql`SELECT * FROM case_type_transitions WHERE case_type_id = ${id} ORDER BY from_status, to_status`,
      sql`SELECT * FROM case_type_approver_templates WHERE case_type_id = ${id} ORDER BY sort_order`,
      sql`SELECT * FROM case_type_sla WHERE case_type_id = ${id}`,
    ]);
    if (!type.rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
    const t = type.rows[0];
    return NextResponse.json({
      id: t.id, name: t.name, department: t.department,
      approvalRequired: t.approval_required, triggerType: t.trigger_type,
      version: t.version, active: t.active,
      priority: t.priority ?? "medium", description: t.description ?? "",
      color: t.color ?? "indigo", allowedInitiatorRoles: t.allowed_initiator_roles ?? [],
      createdAt: t.created_at, updatedAt: t.updated_at,
      fields: fields.rows.map(f => ({
        id: f.id, key: f.field_key, label: f.label, type: f.field_type,
        requiredAt: f.required_at, options: f.options ?? [], active: f.active,
        conditionalOn: f.conditional_on ?? null, sortOrder: f.sort_order,
      })),
      transitions: transitions.rows.map(tr => ({
        id: tr.id, from: tr.from_status, to: tr.to_status,
        requiresReason: tr.requires_reason, notifyRoles: tr.notify_roles ?? [],
        autoAction: tr.auto_action ?? null,
      })),
      approverTemplates: approvers.rows.map(a => ({
        id: a.id, name: a.display_name ?? a.name, role: a.role, roleId: a.role_id ?? null, sortOrder: a.sort_order,
      })),
      sla: sla.rows.length
        ? { slaDays: Number(sla.rows[0].sla_days), escalationDays: sla.rows[0].escalation_days ?? null, escalateTo: sla.rows[0].escalate_to ?? null }
        : { slaDays: 5, escalationDays: null, escalateTo: null },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  try {
    const existing = await sql`SELECT id, version FROM case_types WHERE id = ${id}`;
    if (!existing.rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });

    const sets: string[] = [];
    const vals: unknown[] = [];
    let p = 1;
    if (body.name !== undefined) { sets.push(`name = $${p++}`); vals.push(body.name); }
    if (body.department !== undefined) { sets.push(`department = $${p++}`); vals.push(body.department); }
    if (body.approvalRequired !== undefined) { sets.push(`approval_required = $${p++}`); vals.push(body.approvalRequired); }
    if (body.triggerType !== undefined) { sets.push(`trigger_type = $${p++}`); vals.push(body.triggerType); }
    if (body.active !== undefined) { sets.push(`active = $${p++}`); vals.push(body.active); }
    if (body.priority !== undefined) { sets.push(`priority = $${p++}`); vals.push(body.priority); }
    if (body.description !== undefined) { sets.push(`description = $${p++}`); vals.push(body.description); }
    if (body.color !== undefined) { sets.push(`color = $${p++}`); vals.push(body.color); }
    if (body.allowedInitiatorRoles !== undefined) { sets.push(`allowed_initiator_roles = $${p++}`); vals.push(JSON.stringify(body.allowedInitiatorRoles)); }

    if (sets.length) {
      sets.push(`version = version + 1`, `updated_at = NOW()`);
      vals.push(id);
      await sql.query(
        `UPDATE case_types SET ${sets.join(", ")} WHERE id = $${p}`,
        vals,
      );
    }

    if (body.slaDays !== undefined) {
      await sql`
        INSERT INTO case_type_sla (case_type_id, sla_days, escalation_days, escalate_to)
        VALUES (${id}, ${body.slaDays as number}, ${body.escalationDays as number ?? null}, ${body.escalateTo as string ?? null})
        ON CONFLICT (case_type_id) DO UPDATE
          SET sla_days = EXCLUDED.sla_days,
              escalation_days = EXCLUDED.escalation_days,
              escalate_to = EXCLUDED.escalate_to
      `;
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const inUse = await sql`SELECT COUNT(*) AS n FROM cases WHERE type_id = ${id}`;
    if (Number(inUse.rows[0].n) > 0) {
      await sql`UPDATE case_types SET active = false, updated_at = NOW() WHERE id = ${id}`;
      return NextResponse.json({ deactivated: true, reason: "cases exist" });
    }
    await sql`DELETE FROM case_types WHERE id = ${id}`;
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
