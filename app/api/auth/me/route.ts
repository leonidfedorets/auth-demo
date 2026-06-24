import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/jwt";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "invalid_token" }, { status: 401 });

  const result = await sql`SELECT id, email, display_name, mfa_enabled, totp_verified, locked, last_login_at, last_login_ip, created_at FROM users WHERE id = ${claims.sub}`;
  if (!result.rows[0]) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ user: result.rows[0], claims });
}
