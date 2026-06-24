import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/jwt";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const result = await sql`SELECT id, credential_id, name, counter, created_at, last_used_at, transports FROM webauthn_credentials WHERE user_id = ${claims.sub} ORDER BY created_at DESC`;
  return NextResponse.json({ credentials: result.rows });
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { credentialId } = await req.json();
  await sql`DELETE FROM webauthn_credentials WHERE credential_id = ${credentialId} AND user_id = ${claims.sub}`;
  await sql`INSERT INTO audit_logs (user_id, action, details) VALUES (${claims.sub}, 'webauthn.credential.delete', ${JSON.stringify({ credentialId })})`;
  return NextResponse.json({ success: true });
}
