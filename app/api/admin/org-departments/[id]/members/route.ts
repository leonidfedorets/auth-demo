import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/jwt";
import { verifyApiKey } from "@/lib/api-key-auth";

async function authenticate(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (token) { const c = await verifyToken(token); if (c) return { ok: true }; }
  const a = await verifyApiKey(req as unknown as Request);
  if (a) return { ok: true };
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: { type: "user" | "role"; ref: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  if (!body.type || !body.ref?.trim()) return NextResponse.json({ error: "type and ref required" }, { status: 400 });
  if (!["user","role"].includes(body.type)) return NextResponse.json({ error: "type must be user or role" }, { status: 400 });

  try {
    await sql`
      INSERT INTO org_dept_members (dept_id, member_type, ref)
      VALUES (${id}, ${body.type}, ${body.ref.trim()})
      ON CONFLICT (dept_id, member_type, ref) DO NOTHING
    `;
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const ref = searchParams.get("ref");
  if (!type || !ref) return NextResponse.json({ error: "type and ref required" }, { status: 400 });
  try {
    await sql`DELETE FROM org_dept_members WHERE dept_id = ${id} AND member_type = ${type} AND ref = ${ref}`;
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
