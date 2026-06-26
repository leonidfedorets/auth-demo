import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/jwt";

const DEMO_TID = "c7ed9c17-0633-49df-9bc7-81de55f69fb7";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rawTid = claims.tid as string | undefined;
  const tid = (!rawTid || rawTid === "default") ? DEMO_TID : rawTid;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const action = searchParams.get("action") ?? "";

  try {
    // All audit events for this tenant's clients + the tenant's own events
    let query = `
      SELECT
        al.id, al.action, al.outcome, al.ip_address, al.user_agent,
        al.risk_score, al.details, al.created_at,
        u.email AS client_email, u.display_name AS client_name, u.id AS client_id
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE (u.tenant_id = $1 OR al.user_id = $2)
    `;
    const params: (string | number)[] = [tid, tid];

    if (action) {
      params.push(`%${action}%`);
      query += ` AND al.action ILIKE $${params.length}`;
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const logs = await sql.query(query, params);

    const todayRes = await sql`
      SELECT COUNT(*) AS cnt FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE (u.tenant_id = ${tid} OR al.user_id = ${tid})
        AND al.created_at > NOW() - INTERVAL '24 hours'
    `;

    return NextResponse.json({
      logs: logs.rows,
      total: logs.rows.length,
      todayCount: parseInt(todayRes.rows[0]?.cnt ?? "0"),
    });
  } catch (err) {
    console.error("[audit] db error:", err);
    return NextResponse.json({ logs: [], total: 0, todayCount: 0 });
  }
}
