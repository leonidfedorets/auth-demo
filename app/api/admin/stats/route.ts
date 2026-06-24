import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json({
    totalTransactions: 1247,
    totalUsers: 89,
    boundDevices: 143,
    activeSessions: 34,
    txLast7Days: [142, 89, 201, 167, 234, 189, 225],
    riskDistribution: { low: 78, medium: 15, high: 5, critical: 2 },
  });
}
