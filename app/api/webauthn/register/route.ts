import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/jwt";
import { storeWebAuthnChallenge, getWebAuthnChallenge, deleteWebAuthnChallenge } from "@/lib/redis";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/types";

const rpID = process.env.WEBAUTHN_RP_ID ?? "localhost";
const rpName = process.env.WEBAUTHN_RP_NAME ?? "UTH";
const origin = process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "begin";

  if (action === "begin") {
    const existing = await sql`SELECT credential_id FROM webauthn_credentials WHERE user_id = ${claims.sub}`;
    const excludeCredentials = existing.rows.map(r => ({ id: r.credential_id, type: "public-key" as const }));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(claims.sub),
      userName: claims.email,
      attestationType: "none",
      excludeCredentials,
      authenticatorSelection: { userVerification: "preferred", residentKey: "preferred" },
    });

    await storeWebAuthnChallenge(claims.sub, options.challenge, "register");
    return NextResponse.json(options);
  }

  // finish
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
    INSERT INTO webauthn_credentials (user_id, credential_id, public_key, counter, aaguid, transports)
    VALUES (${claims.sub}, ${credId}, ${pubKey}, ${credential.counter}, ${(credential as any).aaguid ? Buffer.from((credential as any).aaguid).toString("hex") : null}, ${JSON.stringify(credential.transports ?? [])})
    ON CONFLICT (credential_id) DO UPDATE SET counter = EXCLUDED.counter
  `;

  return NextResponse.json({ verified: true });
}
