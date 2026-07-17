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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; approverId: string }> },
) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, approverId } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const decision = body.decision as string;
  if (!["approved", "rejected"].includes(decision)) {
    return NextResponse.json({ error: "decision must be 'approved' or 'rejected'" }, { status: 400 });
  }

  try {
    const approver = await sql`
      SELECT * FROM case_approvers WHERE id = ${approverId} AND case_id = ${id}
    `;
    if (!approver.rows.length) return NextResponse.json({ error: "approver not found" }, { status: 404 });
    if (approver.rows[0].status !== "pending") {
      return NextResponse.json({ error: "already resolved" }, { status: 409 });
    }

    const now = new Date().toISOString();
    await sql`
      UPDATE case_approvers
      SET status = ${decision}, comment = ${(body.comment as string) ?? null}, resolved_at = ${now}
      WHERE id = ${approverId}
    `;

    await sql`
      INSERT INTO case_audit (case_id, actor, action, field, old_val, new_val, context)
      VALUES (${id}, ${auth.email}, 'Approval Decision', ${'approver:' + approver.rows[0].name}, 'pending', ${decision}, ${(body.comment as string) ?? null})
    `;

    // If all approvers approved → auto-close if case is pending_approval
    if (decision === "approved") {
      const remaining = await sql`
        SELECT COUNT(*) AS n FROM case_approvers WHERE case_id = ${id} AND status = 'pending'
      `;
      if (Number(remaining.rows[0].n) === 0) {
        await sql`UPDATE cases SET status = 'closed', closed_at = NOW(), updated_at = NOW() WHERE id = ${id} AND status = 'pending_approval'`;
        await sql`
          INSERT INTO case_audit (case_id, actor, action, field, old_val, new_val)
          VALUES (${id}, 'System', 'Auto-Closed', 'status', 'pending_approval', 'closed')
        `;
      }
    }

    // If checker rejected → move back to active
    if (decision === "rejected") {
      await sql`UPDATE cases SET status = 'active', updated_at = NOW() WHERE id = ${id} AND status = 'pending_approval'`;
      await sql`
        INSERT INTO case_audit (case_id, actor, action, field, old_val, new_val, context)
        VALUES (${id}, 'System', 'Approval Rejected — Returned to Active', 'status', 'pending_approval', 'active', ${(body.comment as string) ?? null})
      `;
    }

    return NextResponse.json({ approverId, decision, resolvedAt: now });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
