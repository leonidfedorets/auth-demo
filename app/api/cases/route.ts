import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/jwt";
import { verifyApiKey } from "@/lib/api-key-auth";

const DEMO_TID = "c7ed9c17-0633-49df-9bc7-81de55f69fb7";

async function authenticate(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (token) {
    const claims = await verifyToken(token);
    if (claims) return { tid: (claims.tid as string) || DEMO_TID, email: claims.email as string };
  }
  const apiAuth = await verifyApiKey(req as unknown as Request);
  if (apiAuth) return { tid: apiAuth.tid, email: "api" };
  return null;
}

function rowToCase(r: Record<string, unknown>) {
  return {
    id: r.id,
    typeId: r.type_id,
    typeName: r.type_name,
    clientId: r.client_id ?? "",
    clientName: r.client_name ?? "",
    department: r.department,
    status: r.status,
    assignee: r.assignee ?? null,
    reporter: r.reporter,
    initiation: r.initiation,
    trigger: r.trigger ?? undefined,
    license: r.license,
    sla: r.sla_due_at ? String(r.sla_due_at).slice(0, 10) : "",
    slaBreached: r.sla_breached ?? false,
    description: r.description ?? "",
    resolution: r.resolution ?? undefined,
    rejectReason: r.reject_reason ?? undefined,
    customFields: r.custom_fields ?? {},
    batchId: r.batch_id ?? undefined,
    transactionId: r.transaction_id ?? undefined,
    externalRefs: r.external_refs ?? [],
    closedAt: r.closed_at ? String(r.closed_at) : undefined,
    createdAt: r.created_at ? String(r.created_at).slice(0, 16).replace("T", " ") : "",
    updatedAt: r.updated_at ? String(r.updated_at).slice(0, 16).replace("T", " ") : "",
    // These come from separate queries in the detail endpoint; empty for list
    approvers: [],
    comments: [],
    attachments: [],
    audit: [],
  };
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dept = searchParams.get("department");
  const status = searchParams.get("status");
  const typeId = searchParams.get("typeId");
  const license = searchParams.get("license");
  const assignee = searchParams.get("assignee");
  const search = searchParams.get("search");

  try {
    // Join with case_types to get type name; no tenant filter so demo data is visible
    const rows = await sql`
      SELECT c.*, ct.name AS type_name
      FROM cases c
      LEFT JOIN case_types ct ON ct.id = c.type_id
      WHERE
        (${dept}::text IS NULL OR c.department = ${dept})
        AND (${status}::text IS NULL OR c.status = ${status})
        AND (${typeId}::text IS NULL OR c.type_id = ${typeId})
        AND (${license}::text IS NULL OR c.license = ${license})
        AND (${assignee}::text IS NULL OR c.assignee = ${assignee})
        AND (
          ${search}::text IS NULL
          OR c.id ILIKE '%' || ${search} || '%'
          OR c.client_name ILIKE '%' || ${search} || '%'
          OR c.description ILIKE '%' || ${search} || '%'
          OR c.custom_fields::text ILIKE '%' || ${search} || '%'
        )
      ORDER BY c.created_at DESC
      LIMIT 200
    `;

    return NextResponse.json({ cases: rows.rows.map(rowToCase), total: rows.rowCount ?? 0 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const { typeId, clientId, clientName, department, description, license, customFields, transactionId, reporter } = body as Record<string, string>;
  if (!typeId || !description || !license) {
    return NextResponse.json({ error: "typeId, description, license are required" }, { status: 400 });
  }

  const sla = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const reporterName = reporter || auth.email || "operator";

  try {
    // Get type name
    const ct = await sql`SELECT name, department FROM case_types WHERE id = ${typeId}`;
    if (!ct.rows.length) return NextResponse.json({ error: "invalid typeId" }, { status: 400 });
    const dept = (department || ct.rows[0].department) as string;

    // Generate case ID using sequence
    const seqRow = await sql`SELECT 'CS-' || nextval('case_number_seq') AS case_id`;
    const caseId = seqRow.rows[0].case_id as string;

    await sql`
      INSERT INTO cases (id, type_id, client_id, client_name, department, status, reporter, license, sla_due_at, description, custom_fields, transaction_id)
      VALUES (
        ${caseId}, ${typeId}, ${clientId ?? null}, ${clientName ?? null},
        ${dept}, 'new', ${reporterName}, ${license}, ${sla},
        ${description}, ${JSON.stringify(customFields ?? {})}, ${transactionId ?? null}
      )
    `;

    // Audit log
    await sql`
      INSERT INTO case_audit (case_id, actor, action, field, old_val, new_val, context)
      VALUES (${caseId}, ${reporterName}, 'Case Created', 'status', '—', 'new', ${'initiation=manual'})
    `;

    return NextResponse.json({ id: caseId, status: "new" }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
