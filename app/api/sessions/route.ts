import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/jwt";
import { deleteSession } from "@/lib/redis";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sessions = await sql`
    SELECT id, ip_address, user_agent, country, amr, acr, risk_score, sca_completed, status, expires_at, last_activity_at, created_at
    FROM sessions WHERE user_id = ${claims.sub} AND status = 'active' AND expires_at > NOW()
    ORDER BY last_activity_at DESC
  `;
  return NextResponse.json({ sessions: sessions.rows, current: claims.sid });
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { sessionId } = await req.json();

  // Verify the session belongs to this user
  const result = await sql`SELECT id FROM sessions WHERE id = ${sessionId} AND user_id = ${claims.sub}`;
  if (!result.rows.length) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await sql`UPDATE sessions SET status = 'revoked' WHERE id = ${sessionId}`;
  await deleteSession(sessionId);

  return NextResponse.json({ success: true });
}
