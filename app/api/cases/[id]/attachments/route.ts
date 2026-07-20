import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/jwt";
import { verifyApiKey } from "@/lib/api-key-auth";

async function authenticate(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (token) { const c = await verifyToken(token); if (c) return { email: c.email as string }; }
  const a = await verifyApiKey(req as unknown as Request);
  if (a) return { email: "api" };
  return null;
}

async function ensureColumns() {
  await sql`ALTER TABLE case_attachments ADD COLUMN IF NOT EXISTS file_data TEXT`;
  await sql`ALTER TABLE case_attachments ADD COLUMN IF NOT EXISTS mime_type TEXT`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: { name: string; size: string; mimeType: string; data: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  if (!body.name?.trim() || !body.data) {
    return NextResponse.json({ error: "name and data required" }, { status: 400 });
  }
  // 10 MB base64 cap ≈ 7.5 MB file
  if (body.data.length > 10_000_000) {
    return NextResponse.json({ error: "file too large (max 7.5 MB)" }, { status: 413 });
  }

  try {
    await ensureColumns();
    const result = await sql`
      INSERT INTO case_attachments (case_id, name, size, uploaded_by, source, file_data, mime_type)
      VALUES (${id}, ${body.name.trim()}, ${body.size || ""}, ${auth.email}, 'upload',
              ${body.data}, ${body.mimeType || "application/octet-stream"})
      RETURNING id, name, size, uploaded_by, source, created_at
    `;
    const a = result.rows[0];
    await sql`
      INSERT INTO case_audit (case_id, actor, action, field, old_val, new_val)
      VALUES (${id}, ${auth.email}, 'Document Uploaded', 'attachments', '—', ${body.name.trim()})
    `;
    return NextResponse.json({
      id: a.id, name: a.name, size: a.size,
      uploadedBy: a.uploaded_by, source: a.source,
      ts: String(a.created_at).slice(0, 16).replace("T", " "),
    }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
