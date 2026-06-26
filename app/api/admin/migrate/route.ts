import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { sql } from "@vercel/postgres";

const DEMO_TID = "c7ed9c17-0633-49df-9bc7-81de55f69fb7";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rawTid = claims.tid as string | undefined;
  const tid = (!rawTid || rawTid === "default") ? DEMO_TID : rawTid;
  void tid;

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS applications (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   UUID NOT NULL,
        name        VARCHAR(100) NOT NULL,
        description TEXT,
        is_active   BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_applications_tenant ON applications(tenant_id)
    `;
    return NextResponse.json({ success: true, message: "Migration applied" });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
