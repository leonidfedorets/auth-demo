import { sql } from "@vercel/postgres";

export { sql };

export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      mfa_enabled BOOLEAN DEFAULT false,
      totp_secret TEXT,
      totp_verified BOOLEAN DEFAULT false,
      locked BOOLEAN DEFAULT false,
      failed_attempts INT DEFAULT 0,
      last_login_at TIMESTAMPTZ,
      last_login_ip TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      refresh_token_hash TEXT NOT NULL UNIQUE,
      family_id TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      country TEXT,
      device_id TEXT,
      amr JSONB DEFAULT '[]',
      acr TEXT DEFAULT 'bronze',
      risk_score INT DEFAULT 0,
      sca_completed BOOLEAN DEFAULT false,
      status TEXT DEFAULT 'active',
      expires_at TIMESTAMPTZ NOT NULL,
      last_activity_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS devices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      fingerprint TEXT,
      platform TEXT,
      user_agent TEXT,
      name TEXT,
      status TEXT DEFAULT 'pending',
      attestation_type TEXT,
      attestation_verified BOOLEAN DEFAULT false,
      trusted BOOLEAN DEFAULT false,
      last_seen_at TIMESTAMPTZ,
      last_seen_ip TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS webauthn_credentials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      credential_id TEXT NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      counter BIGINT DEFAULT 0,
      aaguid TEXT,
      name TEXT DEFAULT 'Passkey',
      transports TEXT,
      last_used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      session_id UUID,
      action TEXT NOT NULL,
      outcome TEXT DEFAULT 'success',
      ip_address TEXT,
      user_agent TEXT,
      risk_score INT DEFAULT 0,
      details JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

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

  await sql`
    CREATE TABLE IF NOT EXISTS webauthn_challenges (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      challenge TEXT NOT NULL,
      type TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}
