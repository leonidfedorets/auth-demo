import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/jwt";
import { deleteSession } from "@/lib/redis";
import { getClientIP as getIP } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (token) {
    const claims = await verifyToken(token);
    if (claims?.sid) {
      await sql`UPDATE sessions SET status = 'revoked' WHERE id = ${claims.sid}`;
      await deleteSession(claims.sid);
      await sql`INSERT INTO audit_logs (user_id, session_id, action, ip_address) VALUES (${claims.sub}, ${claims.sid}, 'auth.logout', ${getIP(req)})`;
    }
  }
  const res = NextResponse.json({ success: true });
  res.cookies.delete("access_token");
  res.cookies.delete("refresh_token");
  res.cookies.delete("sca_token");
  return res;
}
