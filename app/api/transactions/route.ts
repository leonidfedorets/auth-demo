import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { verifyApiKey } from "@/lib/api-key-auth";
import { redis } from "@/lib/redis";

const DEMO_TID = "c7ed9c17-0633-49df-9bc7-81de55f69fb7";

async function authenticate(req: NextRequest): Promise<{ tid: string; sub?: string } | null> {
  const token = req.cookies.get("access_token")?.value;
  if (token) {
    const claims = await verifyToken(token);
    if (claims) return { tid: (claims.tid as string) || DEMO_TID, sub: claims.sub as string };
  }
  const apiAuth = await verifyApiKey(req as unknown as Request);
  if (apiAuth) return { tid: apiAuth.tid };
  return null;
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const typeFilter = searchParams.get("type");
  const userIdFilter = searchParams.get("userId");

  // Try Redis first
  const redisKey = `tenant:transactions:${auth.tid}`;
  const stored = await redis.lrange(redisKey, 0, 199);
  let transactions: Record<string, unknown>[] = [];
  if (stored && stored.length > 0) {
    transactions = stored.map(raw => typeof raw === "string" ? JSON.parse(raw) : raw as Record<string, unknown>);
  } else {
    // Fallback to mock data — only for the authenticated tenant
    transactions = MOCK_TRANSACTIONS.map(t => ({ ...t, tid: auth.tid }));
  }

  const filtered = transactions.filter((t: Record<string, unknown>) => {
    if (typeFilter && typeFilter !== "all" && t.type !== typeFilter) return false;
    if (userIdFilter && t.user_id !== userIdFilter) return false;
    return true;
  });

  return NextResponse.json({ transactions: filtered, total: filtered.length });
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { type, userId, deviceId, ip, metadata } = body;

  const id = `txn-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const ts = Date.now();
  const record = { id, tid: auth.tid, type, userId, deviceId, ip, metadata, ts, status: "recorded" };

  await redis.lpush(`tenant:transactions:${auth.tid}`, JSON.stringify(record));

  return NextResponse.json({ id, tid: auth.tid, ts, status: "recorded" });
}

const now = Date.now();
const ago = (ms: number) => new Date(now - ms).toISOString();

const MOCK_TRANSACTIONS = [
  // ─── AUTH ────────────────────────────────────────────────────────────────
  {
    id:"txn-auth-001", type:"auth", subtype:"login_success",
    user_id:"u1", email:"alice@example.com", display_name:"Alice Smith",
    created_at:ago(2*60000), ip:"195.12.50.10", country:"LV", asn:"AS3327 CITIC",
    risk_score:5, risk_level:"low", decision:"ALLOW", auth_method:"pwd+totp",
    device_status:"healthy", device_platform:"ios",
    session_id:"sid-abc123", session_created_at:ago(2*60000), session_expires_at:ago(-86400*1000),
    jwt:{
      access_token:"eyJhbGciOiJIUzI1NiIsImtpZCI6InYxIn0...",
      access_token_ttl:900, access_token_exp:Math.floor(now/1000)+900,
      refresh_token:"eyJhbGciOiJIUzI1NiIsImtpZCI6InYxIn0...(refresh)",
      refresh_token_ttl:2592000, refresh_token_exp:Math.floor(now/1000)+2592000,
      claims:{ sub:"u1", email:"alice@example.com", tid:"default", sid:"sid-abc123", amr:["pwd","otp"], acr:"silver", risk:5, risk_lvl:"low", sca:false, ttype:"access", roles:["user"] }
    }
  },
  {
    id:"txn-auth-002", type:"auth", subtype:"login_failed",
    user_id:"u2", email:"bob@example.com", display_name:"Bob Jones",
    created_at:ago(5*60000), ip:"185.220.101.5", country:"DE", asn:"AS50580 Chaos Computer",
    risk_score:72, risk_level:"high", decision:"DENY", auth_method:"pwd",
    device_status:"degraded", device_platform:"android",
    session_id:null, session_created_at:null, session_expires_at:null,
    failure_reason:"wrong_password", failure_detail:"Password mismatch after bcrypt comparison",
    consecutive_failures:3, account_locked:false,
    jwt:null
  },
  {
    id:"txn-auth-003", type:"auth", subtype:"login_step_up",
    user_id:"u2", email:"bob@example.com", display_name:"Bob Jones",
    created_at:ago(8*60000), ip:"185.220.101.5", country:"DE",
    risk_score:52, risk_level:"high", decision:"STEP_UP", auth_method:"pwd",
    device_status:"degraded", device_platform:"android",
    session_id:"sid-def456", sca_required:true, sca_method:"totp",
    jwt:null, step_up_reason:"risk_score_above_40"
  },
  // ─── TOKEN ROTATION ──────────────────────────────────────────────────────
  {
    id:"txn-token-001", type:"token_rotation", subtype:"access_token_refresh",
    user_id:"u1", email:"alice@example.com",
    created_at:ago(20*60000), ip:"195.12.50.10", country:"LV",
    risk_score:5, risk_level:"low", decision:"ALLOW", auth_method:"refresh_token",
    session_id:"sid-abc123", device_status:"healthy",
    rotation:{
      old_access_token_exp:ago(-5*60000), new_access_token_ttl:900,
      new_access_token_exp:ago(-5*60000+900000),
      refresh_token_reused:true, refresh_token_remaining_ttl:2505600,
    },
    jwt:{
      access_token:"eyJhbGciOiJIUzI1NiIsImtpZCI6InYxIn0...(new)",
      claims:{ sub:"u1", tid:"default", sid:"sid-abc123", amr:["pwd","otp"], acr:"silver", risk:5, ttype:"access" }
    }
  },
  {
    id:"txn-token-002", type:"token_rotation", subtype:"refresh_token_rotation",
    user_id:"u1", email:"alice@example.com",
    created_at:ago(86400*1000+5*60000), ip:"195.12.50.10", country:"LV",
    risk_score:5, risk_level:"low", decision:"ALLOW",
    session_id:"sid-abc123",
    rotation:{
      trigger:"session_rotation_24h", old_refresh_token_invalidated:true,
      new_refresh_token_ttl:2592000, session_rotated:true
    },
    jwt:{
      refresh_token:"eyJhbGciOiJIUzI1NiIsImtpZCI6InYxIn0...(rotated)",
      claims:{ sub:"u1", ttype:"refresh", sid:"sid-new789" }
    }
  },
  // ─── SESSION EXPIRY ──────────────────────────────────────────────────────
  {
    id:"txn-session-001", type:"session_expiry", subtype:"access_token_expired",
    user_id:"u3", email:"carol@example.com",
    created_at:ago(35*60000), ip:"78.90.12.34", country:"GB",
    risk_score:12, risk_level:"low",
    session_id:"sid-ghi789",
    expiry:{ token_type:"access", expired_at:ago(35*60000), ttl_was:900, next_action:"reauth_required" }
  },
  {
    id:"txn-session-002", type:"session_expiry", subtype:"session_expired",
    user_id:"u3", email:"carol@example.com",
    created_at:ago(2*86400*1000), ip:"78.90.12.34", country:"GB",
    risk_score:12, risk_level:"low",
    session_id:"sid-ghi789",
    expiry:{ token_type:"session", expired_at:ago(2*86400*1000), ttl_was:86400, reason:"max_session_age_reached" }
  },
  // ─── SCA ─────────────────────────────────────────────────────────────────
  {
    id:"txn-sca-001", type:"sca", subtype:"success",
    user_id:"u1", email:"alice@example.com",
    created_at:ago(15*60000), ip:"195.12.50.10", country:"LV",
    risk_score:5, risk_level:"low", decision:"ALLOW", auth_method:"totp",
    device_status:"healthy", session_id:"sid-abc123",
    sca:{
      challenge_id:"chl_abc123xyz", method:"totp", result:"ALLOW",
      amount:"250.00", currency:"EUR", iban:"LV80BANK0000435195001",
      dynamic_link_hash:"sha256:a8f4c2...", ttl_seconds:600,
      created_at:ago(15*60000+30000), verified_at:ago(15*60000),
      time_to_verify_seconds:28,
    },
    jwt_claims:{ sca:true, sca_method:"totp", acr:"silver", amr:["otp","mfa"], sca_ts:Math.floor((now - 15*60000) / 1000) }
  },
  {
    id:"txn-sca-002", type:"sca", subtype:"fail",
    user_id:"u2", email:"bob@example.com",
    created_at:ago(45*60000), ip:"185.220.101.5", country:"DE",
    risk_score:72, risk_level:"high", decision:"DENY",
    device_status:"degraded", session_id:"sid-def456",
    sca:{
      challenge_id:"chl_fail789", method:"totp", result:"DENY",
      amount:"1500.00", currency:"EUR", iban:"DE89370400440532013000",
      created_at:ago(45*60000+45000), failed_at:ago(45*60000),
      failure_reason:"wrong_code", attempts:3, max_attempts:3
    }
  },
  {
    id:"txn-sca-003", type:"sca", subtype:"timeout",
    user_id:"u3", email:"carol@example.com",
    created_at:ago(70*60000), ip:"78.90.12.34", country:"GB",
    risk_score:12, risk_level:"low", decision:"DENY",
    device_status:"healthy", session_id:"sid-ghi789",
    sca:{
      challenge_id:"chl_timeout456", method:"push", result:"DENY",
      amount:"800.00", currency:"GBP", iban:"GB29NWBK60161331926819",
      created_at:ago(70*60000), expired_at:ago(60*60000),
      failure_reason:"ttl_expired", user_responded:false
    }
  },
  {
    id:"txn-sca-004", type:"sca", subtype:"success",
    user_id:"u1", email:"alice@example.com",
    created_at:ago(3*3600000), ip:"195.12.50.10", country:"LV",
    risk_score:5, risk_level:"low", decision:"ALLOW", auth_method:"webauthn",
    device_status:"healthy", session_id:"sid-abc123",
    sca:{
      challenge_id:"chl_wbn999", method:"webauthn", result:"ALLOW",
      amount:"5000.00", currency:"EUR", iban:"LV80BANK0000435195001",
      created_at:ago(3*3600000+20000), verified_at:ago(3*3600000),
      webauthn:{ credentialId:"cred_abc123", publicKeyAlgorithm:"ES256 (COSE -7)", userVerification:"required", rpId:"auth-demo-rouge.vercel.app", aaguid:"adce0002-35bc-c60a-648b-0b25f1f05503", signatureValid:true }
    },
    jwt_claims:{ sca:true, sca_method:"webauthn", acr:"gold", amr:["hwk"], sca_ts:Math.floor(Date.now()/1000)-10800 }
  },
  // ─── RISK ─────────────────────────────────────────────────────────────────
  {
    id:"txn-risk-001", type:"risk", subtype:"standalone_evaluate",
    user_id:"u2", email:"bob@example.com",
    created_at:ago(10*60000), ip:"185.220.101.5", country:"DE",
    risk_score:72, risk_level:"high", decision:"STEP_UP",
    session_id:"sid-def456", device_status:"degraded",
    risk_eval:{
      context:"payment", operation_type:"payment", amount:"1500.00",
      layers:{ deviceTrust:45, networkGeo:20, operationRisk:7 },
      triggered_signals:["VPN","DEV","high_risk_country"],
      required_action:"sca", sca_method:"totp"
    }
  },
  // ─── DEVICE ATTESTATION ───────────────────────────────────────────────────
  {
    id:"txn-att-001", type:"attestation", subtype:"evaluate",
    user_id:"u1", email:"alice@example.com",
    created_at:ago(25*60000), ip:"195.12.50.10", country:"LV",
    risk_score:5, risk_level:"low", decision:"ALLOW", device_platform:"ios",
    device_status:"healthy", session_id:"sid-abc123",
    attestation:{
      device_id:"dev_iphone14pro", platform:"ios", status:"healthy", trust_score:88, dba:"allowed",
      signals_passed:["KD","DH","BIO","SLE","TPM","SEA","IPR","ASN","OS"],
      signals_failed:[], signals_disabled:[],
      recommendation:"Device trusted — silent login eligible",
    }
  },
  {
    id:"txn-att-002", type:"attestation", subtype:"evaluate",
    user_id:"u3", email:"carol@example.com",
    created_at:ago(2*3600000), ip:"1.2.3.4", country:"CN",
    risk_score:95, risk_level:"critical", decision:"DENY", device_platform:"android",
    device_status:"blocked", session_id:null,
    attestation:{
      device_id:"dev_android_suspicious", platform:"android", status:"blocked", trust_score:0, dba:"deny",
      signals_passed:["SLE"],
      signals_failed:["ROOT","HOOK","INT","TOR"],
      recommendation:"Device blocked — rooted with active hooking framework detected",
    }
  },
  // ─── DEVICE BINDING ───────────────────────────────────────────────────────
  {
    id:"txn-db-001", type:"device_binding", subtype:"bind",
    user_id:"u1", email:"alice@example.com",
    created_at:ago(7*24*3600000), ip:"195.12.50.10", country:"LV",
    risk_score:5, risk_level:"low", decision:"ALLOW", device_platform:"ios",
    device_status:"healthy", session_id:"sid-abc123",
    binding:{ device_id:"dev_iphone14pro", fingerprint:"a1b2c3d4e5f6a1b2", state_from:"unbound", state_to:"bound", max_devices:3, current_device_count:1 }
  },
  {
    id:"txn-db-002", type:"device_binding", subtype:"revoke",
    user_id:"u2", email:"bob@example.com",
    created_at:ago(2*24*3600000), ip:"185.220.101.5", country:"DE",
    risk_score:72, risk_level:"high", decision:"ALLOW",
    device_status:"degraded",
    binding:{ device_id:"dev_old_android", fingerprint:"f6e5d4c3b2a1f6e5", state_from:"bound", state_to:"revoked", reason:"suspicious_activity_detected" }
  },
];
