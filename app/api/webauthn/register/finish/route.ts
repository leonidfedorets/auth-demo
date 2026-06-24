import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/jwt";
import { getWebAuthnChallenge, deleteWebAuthnChallenge } from "@/lib/redis";
import { verifyRegistrationResponse } from "@simplewebauthn/server";

const rpID = process.env.WEBAUTHN_RP_ID ?? "localhost";
const origin = process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const expectedChallenge = await getWebAuthnChallenge(claims.sub, "register");
  if (!expectedChallenge) return NextResponse.json({ error: "challenge_expired" }, { status: 400 });

  const verification = await verifyRegistrationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "verification_failed" }, { status: 400 });
  }

  await deleteWebAuthnChallenge(claims.sub, "register");
  const { credential } = verification.registrationInfo;
  const credId = Buffer.from(credential.id).toString("base64url");
  const pubKey = Buffer.from(credential.publicKey).toString("base64url");

  await sql`
    INSERT INTO webauthn_credentials (user_id, credential_id, public_key, counter, aaguid, transports, name, created_at)
    VALUES (${claims.sub}, ${credId}, ${pubKey}, ${credential.counter},
            ${(credential as any).aaguid ? Buffer.from((credential as any).aaguid).toString("hex") : null},
            ${JSON.stringify(credential.transports ?? [])},
            ${"Passkey " + new Date().toLocaleDateString()},
            NOW())
    ON CONFLICT (credential_id) DO UPDATE SET counter = EXCLUDED.counter
  `;
  await sql`INSERT INTO audit_logs (user_id, action, details) VALUES (${claims.sub}, 'webauthn.register', '{"method":"passkey"}')`;

  return NextResponse.json({ verified: true });
}
