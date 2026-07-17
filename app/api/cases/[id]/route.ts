import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/jwt";
import { verifyApiKey } from "@/lib/api-key-auth";

async function authenticate(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (token) {
    const claims = await verifyToken(token);
    if (claims) return { email: claims.email as string };
  }
  const apiAuth = await verifyApiKey(req as unknown as Request);
  if (apiAuth) return { email: "api" };
  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const caseRow = await sql`
      SELECT c.*, ct.name AS type_name
      FROM cases c
      LEFT JOIN case_types ct ON ct.id = c.type_id
      WHERE c.id = ${id}
    `;
    if (!caseRow.rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });

    const [approvers, comments, attachments, audit] = await Promise.all([
      sql`SELECT * FROM case_approvers WHERE case_id = ${id} ORDER BY created_at`,
      sql`SELECT * FROM case_comments WHERE case_id = ${id} ORDER BY created_at`,
      sql`SELECT * FROM case_attachments WHERE case_id = ${id} ORDER BY created_at`,
      sql`SELECT * FROM case_audit WHERE case_id = ${id} ORDER BY created_at`,
    ]);

    const r = caseRow.rows[0];
    const c = {
      id: r.id,
      typeId: r.type_id,
      typeName: r.type_name,
      clientId: r.client_id ?? "",
      clientName: r.client_name ?? "",
      department: r.department,
      status: r.status,
      assignee: r.assignee ?? null,
      reporter: r.reporter,
      initiation: r.initiation,
      trigger: r.trigger ?? undefined,
      license: r.license,
      sla: r.sla_due_at ? String(r.sla_due_at).slice(0, 10) : "",
      slaBreached: r.sla_breached ?? false,
      description: r.description ?? "",
      resolution: r.resolution ?? undefined,
      rejectReason: r.reject_reason ?? undefined,
      customFields: r.custom_fields ?? {},
      batchId: r.batch_id ?? undefined,
      transactionId: r.transaction_id ?? undefined,
      externalRefs: r.external_refs ?? [],
      closedAt: r.closed_at ? String(r.closed_at).slice(0, 16).replace("T", " ") : undefined,
      createdAt: String(r.created_at).slice(0, 16).replace("T", " "),
      updatedAt: String(r.updated_at).slice(0, 16).replace("T", " "),
      approvers: approvers.rows.map(a => ({
        id: a.id,
        name: a.name,
        role: a.role,
        status: a.status,
        comment: a.comment ?? undefined,
        resolvedAt: a.resolved_at ? String(a.resolved_at).slice(0, 16).replace("T", " ") : undefined,
      })),
      comments: comments.rows.map(c => ({
        id: c.id,
        author: c.author,
        text: c.body,
        ts: String(c.created_at).slice(0, 16).replace("T", " "),
        isSystem: c.is_system,
      })),
      attachments: attachments.rows.map(a => ({
        id: a.id,
        name: a.name,
        size: a.size ?? "",
        uploadedBy: a.uploaded_by ?? "",
        ts: String(a.created_at).slice(0, 16).replace("T", " "),
        source: a.source ?? "",
        tags: a.tags ?? [],
      })),
      audit: audit.rows.map(a => ({
        id: a.id,
        actor: a.actor,
        action: a.action,
        field: a.field ?? "",
        oldVal: a.old_val ?? "",
        newVal: a.new_val ?? "",
        ts: String(a.created_at).slice(0, 16).replace("T", " "),
        context: a.context ?? undefined,
      })),
    };

    return NextResponse.json({ case: c });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  new: ["active"],
  active: ["rfi", "complete", "reject", "handoff"],
  rfi: ["active"],
  handoff: ["active"],
  complete: ["pending_approval", "closed"],
  reject: ["pending_approval", "closed"],
  pending_approval: ["closed", "active"],
  closed: ["active"],
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  try {
    const existing = await sql`SELECT * FROM cases WHERE id = ${id}`;
    if (!existing.rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
    const current = existing.rows[0];

    const actor = auth.email;
    const now = new Date().toISOString();

    // Status transition
    if (body.status && body.status !== current.status) {
      const allowed = VALID_TRANSITIONS[current.status as string] ?? [];
      if (!allowed.includes(body.status as string)) {
        return NextResponse.json({
          error: `invalid transition ${current.status} → ${body.status}`,
        }, { status: 422 });
      }

      const newStatus = body.status as string;
      const closedAt = newStatus === "closed" ? now : null;
      const resolution = body.resolution as string ?? current.resolution;
      const rejectReason = body.rejectReason as string ?? current.reject_reason;

      await sql`
        UPDATE cases SET
          status = ${newStatus},
          resolution = ${resolution ?? null},
          reject_reason = ${rejectReason ?? null},
          closed_at = ${closedAt},
          updated_at = NOW()
        WHERE id = ${id}
      `;

      await sql`
        INSERT INTO case_audit (case_id, actor, action, field, old_val, new_val, context)
        VALUES (${id}, ${actor}, 'Status Changed', 'status', ${current.status as string}, ${newStatus}, ${(body.reason as string) ?? null})
      `;

      // System comment for RFI
      if (newStatus === "rfi") {
        const zohoRef = `Zoho TKT-${8000 + Math.floor(Math.random() * 999)}`;
        const refs = [...((current.external_refs as string[]) ?? []), zohoRef];
        await sql`UPDATE cases SET external_refs = ${JSON.stringify(refs)} WHERE id = ${id}`;
        await sql`
          INSERT INTO case_comments (case_id, author, body, is_system)
          VALUES (${id}, 'System', ${`RFI sent → ${zohoRef}. SLA paused.`}, true)
        `;
      }
    }

    // Assignee update
    if ("assignee" in body) {
      const newAssignee = body.assignee as string | null;
      await sql`UPDATE cases SET assignee = ${newAssignee}, updated_at = NOW() WHERE id = ${id}`;
      await sql`
        INSERT INTO case_audit (case_id, actor, action, field, old_val, new_val)
        VALUES (${id}, ${actor}, 'Assigned', 'assignee', ${(current.assignee as string) ?? "—"}, ${newAssignee ?? "—"})
      `;
    }

    // Department handoff
    if (body.department && body.department !== current.department) {
      const newDept = body.department as string;
      await sql`
        UPDATE cases SET department = ${newDept}, assignee = NULL, status = 'active', updated_at = NOW()
        WHERE id = ${id}
      `;
      await sql`
        INSERT INTO case_audit (case_id, actor, action, field, old_val, new_val, context)
        VALUES (${id}, ${actor}, 'Handoff', 'department', ${current.department as string}, ${newDept}, ${(body.reason as string) ?? null})
      `;
    }

    // Custom fields update
    if (body.customFields) {
      await sql`
        UPDATE cases SET custom_fields = ${JSON.stringify(body.customFields)}, updated_at = NOW()
        WHERE id = ${id}
      `;
    }

    // Re-fetch full case
    const updated = await sql`SELECT * FROM cases WHERE id = ${id}`;
    const u = updated.rows[0];
    return NextResponse.json({
      id: u.id, status: u.status, assignee: u.assignee, department: u.department,
      updatedAt: String(u.updated_at).slice(0, 16).replace("T", " "),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
