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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, attachmentId } = await params;

  try {
    const row = await sql`
      SELECT name, mime_type, file_data FROM case_attachments
      WHERE id = ${attachmentId} AND case_id = ${id}
    `;
    if (!row.rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
    const a = row.rows[0];
    if (!a.file_data) return NextResponse.json({ error: "no file data stored" }, { status: 404 });

    const buf = Buffer.from(a.file_data as string, "base64");
    return new NextResponse(buf, {
      headers: {
        "Content-Type": (a.mime_type as string) || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${(a.name as string).replace(/"/g, "_")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, attachmentId } = await params;
  try {
    await sql`DELETE FROM case_attachments WHERE id = ${attachmentId} AND case_id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
