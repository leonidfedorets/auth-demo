import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/jwt";
import { getClientIP } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const devices = await sql`SELECT * FROM devices WHERE user_id = ${claims.sub} ORDER BY last_seen_at DESC NULLS LAST`;
  return NextResponse.json({ devices: devices.rows });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ip = getClientIP(req);
  const { fingerprint, platform, name, attestationType } = await req.json();

  // Check if device already exists
  const existing = await sql`SELECT id FROM devices WHERE user_id = ${claims.sub} AND fingerprint = ${fingerprint}`;
  if (existing.rows.length > 0) {
    await sql`UPDATE devices SET last_seen_at = NOW(), last_seen_ip = ${ip} WHERE id = ${existing.rows[0].id}`;
    return NextResponse.json({ deviceId: existing.rows[0].id, status: "known" });
  }

  const result = await sql`
    INSERT INTO devices (user_id, fingerprint, platform, user_agent, name, status, attestation_type, attestation_verified, last_seen_at, last_seen_ip)
    VALUES (${claims.sub}, ${fingerprint}, ${platform}, ${req.headers.get("user-agent") ?? ""}, ${name ?? platform}, 'verified', ${attestationType ?? "none"}, ${attestationType === "none" ? false : true}, NOW(), ${ip})
    RETURNING id, status
  `;
  await sql`INSERT INTO audit_logs (user_id, action, ip_address, details) VALUES (${claims.sub}, 'device.register', ${ip}, ${JSON.stringify({ platform, attestationType })})`;

  return NextResponse.json({ deviceId: result.rows[0].id, status: "registered" }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { deviceId } = await req.json();
  await sql`DELETE FROM devices WHERE id = ${deviceId} AND user_id = ${claims.sub}`;
  await sql`INSERT INTO audit_logs (user_id, action, details) VALUES (${claims.sub}, 'device.revoke', ${JSON.stringify({ deviceId })})`;
  return NextResponse.json({ success: true });
}
