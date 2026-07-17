import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/jwt";
import { verifyApiKey } from "@/lib/api-key-auth";

async function authenticate(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (token) {
    const claims = await verifyToken(token);
    if (claims) return { ok: true };
  }
  const apiAuth = await verifyApiKey(req as unknown as Request);
  if (apiAuth) return { ok: true };
  return null;
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const types = await sql`SELECT * FROM case_types ORDER BY name`;
    const fields = await sql`SELECT * FROM case_type_fields ORDER BY case_type_id, sort_order`;

    const result = types.rows.map(t => ({
      id: t.id,
      name: t.name,
      department: t.department,
      approvalRequired: t.approval_required,
      triggerType: t.trigger_type,
      version: t.version,
      active: t.active,
      fields: fields.rows
        .filter(f => f.case_type_id === t.id)
        .map(f => ({
          key: f.field_key,
          label: f.label,
          type: f.field_type,
          requiredAt: f.required_at,
          options: f.options ?? [],
          active: f.active,
          conditionalOn: f.conditional_on ?? undefined,
        })),
    }));

    return NextResponse.json({ caseTypes: result });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
