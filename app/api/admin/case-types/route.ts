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

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const [types, fields, transitions, approvers, sla] = await Promise.all([
      sql`SELECT * FROM case_types ORDER BY name`,
      sql`SELECT * FROM case_type_fields ORDER BY case_type_id, sort_order`,
      sql`SELECT * FROM case_type_transitions ORDER BY case_type_id, from_status, to_status`,
      sql`SELECT * FROM case_type_approver_templates ORDER BY case_type_id, sort_order`,
      sql`SELECT * FROM case_type_sla`,
    ]);

    const result = types.rows.map(t => ({
      id: t.id,
      name: t.name,
      department: t.department,
      approvalRequired: t.approval_required,
      triggerType: t.trigger_type,
      version: t.version,
      active: t.active,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      fields: fields.rows
        .filter(f => f.case_type_id === t.id)
        .map(f => ({
          id: f.id,
          key: f.field_key,
          label: f.label,
          type: f.field_type,
          requiredAt: f.required_at,
          options: f.options ?? [],
          active: f.active,
          conditionalOn: f.conditional_on ?? null,
          sortOrder: f.sort_order,
        })),
      transitions: transitions.rows
        .filter(tr => tr.case_type_id === t.id)
        .map(tr => ({
          id: tr.id,
          from: tr.from_status,
          to: tr.to_status,
          requiresReason: tr.requires_reason,
          notifyRoles: tr.notify_roles ?? [],
          autoAction: tr.auto_action ?? null,
        })),
      approverTemplates: approvers.rows
        .filter(a => a.case_type_id === t.id)
        .map(a => ({ id: a.id, name: a.name, role: a.role, sortOrder: a.sort_order })),
      sla: sla.rows.find(s => s.case_type_id === t.id)
        ? { slaDays: Number(sla.rows.find(s => s.case_type_id === t.id)?.sla_days ?? 5),
            escalationDays: sla.rows.find(s => s.case_type_id === t.id)?.escalation_days ?? null,
            escalateTo: sla.rows.find(s => s.case_type_id === t.id)?.escalate_to ?? null }
        : { slaDays: 5, escalationDays: null, escalateTo: null },
    }));

    return NextResponse.json({ caseTypes: result });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const { name, department, approvalRequired, triggerType, slaDays } = body as {
    name: string; department: string; approvalRequired?: boolean; triggerType?: string; slaDays?: number;
  };
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!department) return NextResponse.json({ error: "department required" }, { status: 400 });

  const id = `ct${Date.now()}`;
  const defaultTransitions = [
    ["new","active"],["active","rfi"],["active","complete"],["active","reject"],
    ["active","handoff"],["rfi","active"],["handoff","active"],
    ["complete","pending_approval"],["complete","closed"],
    ["reject","pending_approval"],["reject","closed"],
    ["pending_approval","closed"],["pending_approval","active"],["closed","active"],
  ];

  try {
    await sql`
      INSERT INTO case_types (id, name, department, approval_required, trigger_type, version)
      VALUES (${id}, ${name.trim()}, ${department}, ${approvalRequired ?? false}, ${triggerType ?? "manual"}, 1)
    `;
    await sql`
      INSERT INTO case_type_sla (case_type_id, sla_days) VALUES (${id}, ${slaDays ?? 5})
    `;
    for (const [from, to] of defaultTransitions) {
      await sql`
        INSERT INTO case_type_transitions (case_type_id, from_status, to_status)
        VALUES (${id}, ${from}, ${to})
        ON CONFLICT DO NOTHING
      `;
    }
    return NextResponse.json({ id, success: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
