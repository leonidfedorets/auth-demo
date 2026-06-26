import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/jwt";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")||"";

  const tenantId = (claims.tid && claims.tid !== "default") ? claims.tid : "c7ed9c17-0633-49df-9bc7-81de55f69fb7";

  try {
    let query = `
      SELECT
        u.id, u.email, u.display_name, u.created_at, u.mfa_enabled, u.totp_enabled,
        u.last_login_at, u.tenant_id,
        COUNT(s.id) FILTER (WHERE s.expires_at > NOW()) AS active_sessions,
        COUNT(s.id) AS total_sessions,
        MAX(s.created_at) AS last_session_at
      FROM users u
      LEFT JOIN sessions s ON s.user_id = u.id
      WHERE (u.tenant_id = $1 OR u.tenant_id IS NULL)
    `;
    const params: any[] = [tenantId];
    if (search) { query += ` AND (u.email ILIKE $2 OR u.display_name ILIKE $2)`; params.push(`%${search}%`); }
    query += ` GROUP BY u.id ORDER BY u.last_login_at DESC NULLS LAST LIMIT 100`;
    const result = await sql.query(query, params);
    return NextResponse.json({ users: result.rows });
  } catch (err) {
    console.error("[admin/users] db error:", err);
    return NextResponse.json({ users: [], error: "db_unavailable" });
  }
}
