import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    totalTransactions: 1247,
    totalUsers: 89,
    boundDevices: 143,
    activeSessions: 34,
    txLast7Days: [142, 89, 201, 167, 234, 189, 225],
    riskDistribution: { low: 78, medium: 15, high: 5, critical: 2 },
  });
}
