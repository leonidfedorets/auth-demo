import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/jwt";
import { getClientIP } from "@/lib/auth";

const DEMO_TID = "c7ed9c17-0633-49df-9bc7-81de55f69fb7";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rawTid = claims.tid as string | undefined;
  const tid = (!rawTid || rawTid === "default") ? DEMO_TID : rawTid;

  try {
    // All devices for all clients of this tenant
    const devices = await sql`
      SELECT
        d.id, d.fingerprint, d.platform, d.user_agent, d.name,
        d.status, d.attestation_type, d.attestation_verified, d.trusted,
        d.last_seen_at, d.last_seen_ip, d.created_at,
        u.email AS client_email, u.display_name AS client_name, u.id AS client_id
      FROM devices d
      JOIN users u ON u.id = d.user_id
      WHERE u.tenant_id = ${tid}
      ORDER BY d.last_seen_at DESC NULLS LAST
      LIMIT 200
    `;

    return NextResponse.json({ devices: devices.rows, total: devices.rows.length });
  } catch (err) {
    console.error("[devices] db error:", err);
    return NextResponse.json({ devices: [], total: 0 });
  }
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ip = getClientIP(req);
  const { fingerprint, platform, name, attestationType } = await req.json();

  const existing = await sql`SELECT id FROM devices WHERE user_id = ${claims.sub} AND fingerprint = ${fingerprint}`;
  if (existing.rows.length > 0) {
    await sql`UPDATE devices SET last_seen_at = NOW(), last_seen_ip = ${ip} WHERE id = ${existing.rows[0].id}`;
    return NextResponse.json({ deviceId: existing.rows[0].id, status: "known" });
  }

  const result = await sql`
    INSERT INTO devices (user_id, fingerprint, platform, user_agent, name, status, attestation_type, attestation_verified, last_seen_at, last_seen_ip)
    VALUES (${claims.sub}, ${fingerprint}, ${platform}, ${req.headers.get("user-agent") ?? ""}, ${name ?? platform}, 'verified', ${attestationType ?? "none"}, ${attestationType !== "none"}, NOW(), ${ip})
    RETURNING id, status
  `;
  await sql`INSERT INTO audit_logs (user_id, action, ip_address, details) VALUES (${claims.sub}, 'device.register', ${ip}, ${JSON.stringify({ platform, attestationType })})`.catch(() => {});

  return NextResponse.json({ deviceId: result.rows[0].id, status: "registered" }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rawTid = claims.tid as string | undefined;
  const tid = (!rawTid || rawTid === "default") ? DEMO_TID : rawTid;

  const { deviceId } = await req.json();

  // Verify device belongs to this tenant's client
  const check = await sql`
    SELECT d.id FROM devices d
    JOIN users u ON u.id = d.user_id
    WHERE d.id = ${deviceId} AND u.tenant_id = ${tid}
  `;
  if (!check.rows.length) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await sql`UPDATE devices SET status = 'revoked' WHERE id = ${deviceId}`;
  await sql`INSERT INTO audit_logs (action, details) VALUES ('device.revoke', ${JSON.stringify({ deviceId })})`.catch(() => {});
  return NextResponse.json({ success: true });
}
