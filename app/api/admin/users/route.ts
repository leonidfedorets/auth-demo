import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/jwt";

const DEMO_TID = "c7ed9c17-0633-49df-9bc7-81de55f69fb7";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const appId = searchParams.get("appId") ?? "";

  const rawTid = claims.tid as string | undefined;
  const tid = (!rawTid || rawTid === "default") ? DEMO_TID : rawTid;

  try {
    // Only end users registered under this tenant — exclude the tenant's own account
    // (tenant's own record has id = tid, which we exclude with id != $1)
    let query = `
      SELECT
        u.id,
        u.email,
        u.display_name,
        u.created_at,
        u.mfa_enabled,
        u.last_login_at,
        u.tenant_id,
        u.app_id,
        a.name AS app_name,
        COUNT(s.id) FILTER (WHERE s.expires_at > NOW()) AS active_sessions,
        COUNT(s.id) AS total_sessions,
        MAX(s.created_at) AS last_session_at
      FROM users u
      LEFT JOIN sessions s ON s.user_id = u.id
      LEFT JOIN applications a ON a.id = u.app_id
      WHERE u.tenant_id = $1
        AND u.id != $1
    `;
    const params: (string | number)[] = [tid];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (u.email ILIKE $${params.length} OR u.display_name ILIKE $${params.length})`;
    }
    if (appId) {
      params.push(appId);
      query += ` AND u.app_id = $${params.length}`;
    }

    query += ` GROUP BY u.id, a.name ORDER BY u.created_at DESC LIMIT 200`;

    const result = await sql.query(query, params);
    return NextResponse.json({ users: result.rows });
  } catch (err) {
    console.error("[admin/users] db error:", err);
    return NextResponse.json({ users: [], error: "db_unavailable" });
  }
}
