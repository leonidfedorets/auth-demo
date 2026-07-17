import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/jwt";
import { verifyApiKey } from "@/lib/api-key-auth";

async function authenticate(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (token) {
    const claims = await verifyToken(token);
    if (claims) return { ok: true };
  }
  const apiAuth = await verifyApiKey(req as unknown as Request);
  if (apiAuth) return { ok: true };
  return null;
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const [totals, byDept, byAssignee, avgClose, slaStats] = await Promise.all([
      sql`
        SELECT
          COUNT(*) FILTER (WHERE status IN ('new','active','rfi','handoff'))   AS open_cases,
          COUNT(*) FILTER (WHERE status = 'pending_approval')                  AS pending_approval,
          COUNT(*) FILTER (WHERE status = 'closed')                            AS closed_cases,
          COUNT(*) FILTER (WHERE sla_breached = true)                          AS sla_breached
        FROM cases
      `,
      sql`
        SELECT department,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status IN ('new','active','rfi','handoff')) AS open
        FROM cases GROUP BY department ORDER BY department
      `,
      sql`
        SELECT assignee,
          COUNT(*) FILTER (WHERE status IN ('new','active','rfi')) AS open,
          COUNT(*) FILTER (WHERE status = 'closed') AS closed
        FROM cases WHERE assignee IS NOT NULL
        GROUP BY assignee ORDER BY open DESC
      `,
      sql`
        SELECT AVG(EXTRACT(EPOCH FROM (closed_at - created_at)) / 86400)::NUMERIC(6,1) AS avg_days
        FROM cases WHERE status = 'closed' AND closed_at IS NOT NULL
      `,
      sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'closed' AND sla_breached = false) AS met,
          COUNT(*) FILTER (WHERE status = 'closed') AS total_closed
        FROM cases
      `,
    ]);

    const t = totals.rows[0];
    const sla = slaStats.rows[0];
    const slaPct = Number(sla.total_closed) > 0
      ? Math.round((Number(sla.met) / Number(sla.total_closed)) * 100)
      : 100;

    return NextResponse.json({
      openCases:        Number(t.open_cases),
      pendingApproval:  Number(t.pending_approval),
      closedCases:      Number(t.closed_cases),
      slaBreached:      Number(t.sla_breached),
      avgDaysToClose:   Number(avgClose.rows[0].avg_days ?? 0),
      slaMetPct:        slaPct,
      byDepartment:     byDept.rows.map(r => ({ dept: r.department, total: Number(r.total), open: Number(r.open) })),
      byAssignee:       byAssignee.rows.map(r => ({ name: r.assignee, open: Number(r.open), closed: Number(r.closed) })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
