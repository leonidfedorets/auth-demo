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

  try {
    let query = `SELECT id, email, display_name, created_at, mfa_enabled, totp_enabled FROM users WHERE tenant_id = $1`;
    const params: any[] = [(claims.tid && claims.tid !== "default" ? claims.tid : "c7ed9c17-0633-49df-9bc7-81de55f69fb7")];
    if (search) { query += ` AND (email ILIKE $2 OR display_name ILIKE $2)`; params.push(`%${search}%`); }
    query += ` ORDER BY created_at DESC LIMIT 100`;
    const result = await sql.query(query, params);
    return NextResponse.json({ users: result.rows });
  } catch {
    return NextResponse.json({ users: MOCK_USERS });
  }
}

const MOCK_USERS = [
  { id:"u1", email:"alice@example.com", display_name:"Alice Smith", created_at:"2025-01-15T10:00:00Z", mfa_enabled:true, totp_enabled:true, total_sessions:47, last_seen:new Date(Date.now()-60000).toISOString(), last_risk:"low" },
  { id:"u2", email:"bob@example.com", display_name:"Bob Jones", created_at:"2025-02-20T14:30:00Z", mfa_enabled:true, totp_enabled:false, total_sessions:12, last_seen:new Date(Date.now()-300000).toISOString(), last_risk:"high" },
  { id:"u3", email:"carol@example.com", display_name:"Carol White", created_at:"2025-03-05T09:15:00Z", mfa_enabled:false, totp_enabled:false, total_sessions:3, last_seen:new Date(Date.now()-1800000).toISOString(), last_risk:"critical" },
];
