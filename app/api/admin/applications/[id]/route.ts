import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { sql } from "@vercel/postgres";

const DEMO_TID = "c7ed9c17-0633-49df-9bc7-81de55f69fb7";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rawTid = claims.tid as string | undefined;
  const tid = (!rawTid || rawTid === "default") ? DEMO_TID : rawTid;

  try {
    const result = await sql`
      SELECT id, tenant_id, name, description, is_active, created_at, updated_at
      FROM applications
      WHERE id = ${id} AND tenant_id = ${tid}
    `;
    if (result.rows.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ application: result.rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rawTid = claims.tid as string | undefined;
  const tid = (!rawTid || rawTid === "default") ? DEMO_TID : rawTid;

  const body = await req.json().catch(() => ({}));
  const { name, description } = body;

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (name.trim().length > 100) {
      return NextResponse.json({ error: "name must be 100 characters or fewer" }, { status: 400 });
    }
  }

  try {
    const result = await sql`
      UPDATE applications
      SET
        name = COALESCE(${name?.trim() || null}, name),
        description = CASE WHEN ${description !== undefined} THEN ${description || null} ELSE description END,
        updated_at = NOW()
      WHERE id = ${id} AND tenant_id = ${tid}
      RETURNING id, tenant_id, name, description, is_active, created_at, updated_at
    `;
    if (result.rows.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ application: result.rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rawTid = claims.tid as string | undefined;
  const tid = (!rawTid || rawTid === "default") ? DEMO_TID : rawTid;

  try {
    const result = await sql`
      UPDATE applications
      SET is_active = FALSE, updated_at = NOW()
      WHERE id = ${id} AND tenant_id = ${tid}
      RETURNING id
    `;
    if (result.rows.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
