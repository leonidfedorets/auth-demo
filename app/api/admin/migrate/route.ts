import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

// Bootstrap migration — callable with a deploy secret to unblock fresh deploys
// where the DB exists but schema is behind. Also callable with cookie auth (admin only).
export async function POST(req: NextRequest) {
  const deploySecret = process.env.DEPLOY_SECRET;
  const authHeader = req.headers.get("x-deploy-secret");

  // Allow either deploy secret or (no deploy secret configured = open for bootstrap)
  const isBootstrap = !deploySecret || authHeader === deploySecret;
  if (!isBootstrap) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const results: string[] = [];

  try {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID`;
    results.push("users.tenant_id: ok");
  } catch (e) { results.push(`users.tenant_id: ${e}`); }

  try {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS app_id UUID`;
    results.push("users.app_id: ok");
  } catch (e) { results.push(`users.app_id: ${e}`); }

  // Backfill: tenant account's own tenant_id should equal their own id
  try {
    await sql`UPDATE users SET tenant_id = id WHERE tenant_id IS NULL AND app_id IS NULL`;
    results.push("backfill tenant_id: ok");
  } catch (e) { results.push(`backfill tenant_id: ${e}`); }

  try {
    // Ensure applications table
    await sql`
      CREATE TABLE IF NOT EXISTS applications (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   UUID NOT NULL,
        name        VARCHAR(100) NOT NULL,
        description TEXT,
        is_active   BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_applications_tenant ON applications(tenant_id)`;
    results.push("applications: ok");
  } catch (e) { results.push(`applications: ${e}`); }

  try {
    // Ensure sca_challenges table
    await sql`
      CREATE TABLE IF NOT EXISTS sca_challenges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        method TEXT NOT NULL,
        code_hash TEXT,
        status TEXT DEFAULT 'pending',
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    results.push("sca_challenges: ok");
  } catch (e) { results.push(`sca_challenges: ${e}`); }

  // Fix wrongly-created users: if someone called /api/auth/register without an API key
  // but SHOULD have been an end user under a tenant, the body can include:
  // { fixUsers: [{ email, tenantId, appId? }] }
  let body: { fixUsers?: { email: string; tenantId: string; appId?: string }[] } = {};
  try { body = await (req as NextRequest).json(); } catch { /* no body */ }
  if (body.fixUsers && Array.isArray(body.fixUsers)) {
    for (const { email, tenantId, appId } of body.fixUsers) {
      try {
        await sql`
          UPDATE users
          SET tenant_id = ${tenantId}, app_id = ${appId ?? null}
          WHERE email = ${email}
        `;
        results.push(`fix user ${email} → tenant ${tenantId}: ok`);
      } catch (e) { results.push(`fix user ${email}: ${e}`); }
    }
  }

  return NextResponse.json({ success: true, results });
}

// GET: health check — returns current schema info
export async function GET() {
  try {
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `;
    return NextResponse.json({ columns: cols.rows.map(r => r.column_name) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
