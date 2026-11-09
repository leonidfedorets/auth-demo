import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/admin-auth";
import { sql } from "@vercel/postgres";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const rows = await sql`SELECT user_email, assigned_at FROM case_role_users WHERE role_id = ${id} ORDER BY assigned_at`;
    return NextResponse.json({ members: rows.rows.map(m => ({ email: m.user_email, assignedAt: m.assigned_at })) });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: { email: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  if (!body.email?.trim()) return NextResponse.json({ error: "email required" }, { status: 400 });

  try {
    await sql`
      INSERT INTO case_role_users (role_id, user_email)
      VALUES (${id}, ${body.email.trim().toLowerCase()})
      ON CONFLICT (role_id, user_email) DO NOTHING
    `;
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email param required" }, { status: 400 });
  try {
    await sql`DELETE FROM case_role_users WHERE role_id = ${id} AND user_email = ${email}`;
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
