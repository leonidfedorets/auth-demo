import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/jwt";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const page = parseInt(req.nextUrl.searchParams.get("page") ?? "1");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "20");
  const offset = (page - 1) * limit;

  const logs = await sql`
    SELECT id, action, outcome, ip_address, user_agent, risk_score, details, created_at
    FROM audit_logs WHERE user_id = ${claims.sub}
    ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
  `;
  const count = await sql`SELECT COUNT(*) FROM audit_logs WHERE user_id = ${claims.sub}`;

  return NextResponse.json({ logs: logs.rows, total: parseInt(count.rows[0].count), page, limit });
}
