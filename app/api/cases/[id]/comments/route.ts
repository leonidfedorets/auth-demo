import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/jwt";
import { verifyApiKey } from "@/lib/api-key-auth";

async function authenticate(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (token) {
    const claims = await verifyToken(token);
    if (claims) return { email: claims.email as string };
  }
  const apiAuth = await verifyApiKey(req as unknown as Request);
  if (apiAuth) return { email: "api" };
  return null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const text = (body.text as string)?.trim();
  if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });

  try {
    const exists = await sql`SELECT id FROM cases WHERE id = ${id}`;
    if (!exists.rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });

    const result = await sql`
      INSERT INTO case_comments (case_id, author, body, is_system)
      VALUES (${id}, ${auth.email}, ${text}, false)
      RETURNING id, author, body AS text, is_system, created_at
    `;
    const r = result.rows[0];
    return NextResponse.json({
      id: r.id,
      author: r.author,
      text: r.text,
      isSystem: r.is_system,
      ts: String(r.created_at).slice(0, 16).replace("T", " "),
    }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const rows = await sql`
      SELECT id, author, body AS text, is_system, created_at
      FROM case_comments WHERE case_id = ${id}
      ORDER BY created_at
    `;
    return NextResponse.json({
      comments: rows.rows.map(r => ({
        id: r.id, author: r.author, text: r.text,
        isSystem: r.is_system,
        ts: String(r.created_at).slice(0, 16).replace("T", " "),
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
