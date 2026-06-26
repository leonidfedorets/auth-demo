import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { redis } from "@/lib/redis";
import { sql } from "@vercel/postgres";

const DEMO_TID = "c7ed9c17-0633-49df-9bc7-81de55f69fb7";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rawTid = claims.tid as string | undefined;
  const tid = (!rawTid || rawTid === "default") ? DEMO_TID : rawTid;

  // Real transaction data from Redis
  const txList = await redis.lrange(`tenant:transactions:${tid}`, 0, 499).catch(() => [] as unknown[]);
  const totalTransactions = txList.length;

  // Last 7 days breakdown
  const now = Date.now();
  const DAY = 86400_000;
  const txLast7Days = Array.from({ length: 7 }, (_, i) => {
    const dayStart = now - (6 - i) * DAY;
    const dayEnd = dayStart + DAY;
    return txList.filter(raw => {
      try {
        const t = typeof raw === "string" ? JSON.parse(raw) : raw as Record<string, unknown>;
        const ts = (t as Record<string, unknown>).ts as number | undefined;
        return ts && ts >= dayStart && ts < dayEnd;
      } catch { return false; }
    }).length;
  });

  // Real user count — end users registered under this tenant
  let totalUsers = 0;
  let activeSessions = 0;
  let boundDevices = 0;
  try {
    const [usersRes, sessionsRes, devicesRes] = await Promise.all([
      sql`SELECT COUNT(*) AS cnt FROM users WHERE tenant_id = ${tid} AND id != ${tid}`,
      sql`
        SELECT COUNT(s.id) AS cnt FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE u.tenant_id = ${tid} AND s.expires_at > NOW() AND s.status = 'active'
      `,
      sql`
        SELECT COUNT(d.id) AS cnt FROM devices d
        JOIN users u ON u.id = d.user_id
        WHERE u.tenant_id = ${tid}
      `,
    ]);
    totalUsers = parseInt(usersRes.rows[0]?.cnt ?? "0");
    activeSessions = parseInt(sessionsRes.rows[0]?.cnt ?? "0");
    boundDevices = parseInt(devicesRes.rows[0]?.cnt ?? "0");
  } catch { /* DB unavailable — return 0 */ }

  let auditToday = 0;
  try {
    const auditRes = await sql`
      SELECT COUNT(*) AS cnt FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE (u.tenant_id = ${tid} OR al.user_id = ${tid})
        AND al.created_at > NOW() - INTERVAL '24 hours'
    `;
    auditToday = parseInt(auditRes.rows[0]?.cnt ?? "0");
  } catch { /* skip */ }

  // Risk distribution from transactions
  const riskDistribution = { low: 0, medium: 0, high: 0, critical: 0 };
  txList.forEach(raw => {
    try {
      const t = typeof raw === "string" ? JSON.parse(raw) : raw as Record<string, unknown>;
      const lvl = ((t as Record<string, unknown>).risk_level ?? (t as Record<string, unknown>).risk_lvl ?? "low") as string;
      if (lvl in riskDistribution) riskDistribution[lvl as keyof typeof riskDistribution]++;
    } catch { /* skip */ }
  });

  return NextResponse.json({
    totalTransactions,
    totalUsers,
    boundDevices,
    activeSessions,
    txLast7Days,
    riskDistribution,
    auditToday,
    tid,
  });
}
