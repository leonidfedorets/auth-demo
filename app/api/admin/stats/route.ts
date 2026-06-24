import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { verifyApiKey } from "@/lib/api-key-auth";

export async function GET(req: NextRequest) {
  // Require authentication: cookie JWT or API key
  const token = req.cookies.get("access_token")?.value;
  if (token) {
    const claims = await verifyToken(token);
    if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  } else {
    const apiAuth = await verifyApiKey(req as unknown as Request);
    if (!apiAuth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    totalTransactions: 1247,
    totalUsers: 89,
    boundDevices: 143,
    activeSessions: 34,
    txLast7Days: [142, 89, 201, 167, 234, 189, 225],
    riskDistribution: { low: 78, medium: 15, high: 5, critical: 2 },
  });
}
