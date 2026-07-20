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

const SYSTEM_STATUSES = [
  { id: "new",              label: "New",              color: "zinc",   sort_order: 0 },
  { id: "active",           label: "Active",           color: "blue",   sort_order: 1 },
  { id: "rfi",              label: "RFI",              color: "amber",  sort_order: 2 },
  { id: "handoff",          label: "Handoff",          color: "purple", sort_order: 3 },
  { id: "complete",         label: "Complete",         color: "green",  sort_order: 4 },
  { id: "reject",           label: "Rejected",         color: "red",    sort_order: 5 },
  { id: "pending_approval", label: "Pending Approval", color: "orange", sort_order: 6 },
  { id: "closed",           label: "Closed",           color: "zinc",   sort_order: 7 },
];

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS case_statuses (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT 'zinc',
      description TEXT DEFAULT '',
      is_system BOOLEAN NOT NULL DEFAULT false,
      sort_order INT NOT NULL DEFAULT 100,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // seed system statuses if table is empty
  const count = await sql`SELECT COUNT(*) AS n FROM case_statuses`;
  if (Number(count.rows[0].n) === 0) {
    for (const s of SYSTEM_STATUSES) {
      await sql`
        INSERT INTO case_statuses (id, label, color, is_system, sort_order)
        VALUES (${s.id}, ${s.label}, ${s.color}, true, ${s.sort_order})
        ON CONFLICT (id) DO NOTHING
      `;
    }
  }
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await ensureTable();
    const rows = await sql`SELECT * FROM case_statuses ORDER BY sort_order, created_at`;
    return NextResponse.json({
      statuses: rows.rows.map(s => ({
        id: s.id, label: s.label, color: s.color,
        description: s.description ?? "",
        isSystem: s.is_system, sortOrder: s.sort_order,
      })),
    });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { label?: string; color?: string; description?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  if (!body.label?.trim()) return NextResponse.json({ error: "label required" }, { status: 400 });

  // build slug id from label
  const id = body.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  try {
    await ensureTable();
    // check uniqueness
    const exists = await sql`SELECT id FROM case_statuses WHERE id = ${id}`;
    if (exists.rows.length) return NextResponse.json({ error: "A status with this name already exists" }, { status: 409 });

    const maxOrder = await sql`SELECT COALESCE(MAX(sort_order), 99) AS m FROM case_statuses`;
    const sortOrder = Number(maxOrder.rows[0].m) + 1;

    await sql`
      INSERT INTO case_statuses (id, label, color, description, is_system, sort_order)
      VALUES (${id}, ${body.label.trim()}, ${body.color ?? "indigo"}, ${body.description ?? ""}, false, ${sortOrder})
    `;
    return NextResponse.json({ id, success: true }, { status: 201 });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
