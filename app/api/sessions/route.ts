import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/jwt";
import { deleteSession } from "@/lib/redis";

const DEMO_TID = "c7ed9c17-0633-49df-9bc7-81de55f69fb7";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rawTid = claims.tid as string | undefined;
  const tid = (!rawTid || rawTid === "default") ? DEMO_TID : rawTid;

  try {
    // All active sessions for all clients of this tenant
    const sessions = await sql`
      SELECT
        s.id, s.ip_address, s.user_agent, s.country, s.amr, s.acr,
        s.risk_score, s.sca_completed, s.status, s.expires_at,
        s.last_activity_at, s.created_at,
        u.email AS client_email, u.display_name AS client_name, u.id AS client_id
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE u.tenant_id = ${tid}
        AND s.status = 'active'
        AND s.expires_at > NOW()
      ORDER BY s.last_activity_at DESC
      LIMIT 200
    `;

    return NextResponse.json({
      sessions: sessions.rows,
      current: claims.sid,
      total: sessions.rows.length,
    });
  } catch (err) {
    console.error("[sessions] db error:", err);
    return NextResponse.json({ sessions: [], current: claims.sid, total: 0 });
  }
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rawTid = claims.tid as string | undefined;
  const tid = (!rawTid || rawTid === "default") ? DEMO_TID : rawTid;

  const { sessionId } = await req.json();

  // Only allow revoking sessions that belong to this tenant's clients
  const result = await sql`
    SELECT s.id FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ${sessionId} AND u.tenant_id = ${tid}
  `;
  if (!result.rows.length) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await sql`UPDATE sessions SET status = 'revoked' WHERE id = ${sessionId}`;
  await deleteSession(sessionId);

  return NextResponse.json({ success: true });
}
