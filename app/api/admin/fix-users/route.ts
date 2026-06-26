/**
 * POST /api/admin/fix-users
 * Reassign wrongly-created user accounts to the correct tenant.
 * Called once after deploy to fix users who were created via /api/auth/register
 * without an API key and therefore got their own tenant_id instead of the correct one.
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { users } = body as { users?: { email: string; tenantId: string; appId?: string }[] };

  if (!users || !Array.isArray(users) || users.length === 0) {
    return NextResponse.json({ error: "users array required" }, { status: 400 });
  }

  const results: string[] = [];
  for (const { email, tenantId, appId } of users) {
    try {
      const r = await sql`
        UPDATE users
        SET tenant_id = ${tenantId}, app_id = ${appId ?? null}
        WHERE email = ${email}
        RETURNING id, email, tenant_id
      `;
      if (r.rows.length > 0) {
        results.push(`${email} → tenant ${tenantId}: ok (id=${r.rows[0].id})`);
      } else {
        results.push(`${email}: not found`);
      }
    } catch (e) {
      results.push(`${email}: error — ${e}`);
    }
  }

  return NextResponse.json({ success: true, results });
}
