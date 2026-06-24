import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/jwt";
import { storeWebAuthnChallenge } from "@/lib/redis";
import { generateRegistrationOptions } from "@simplewebauthn/server";

const rpID = process.env.WEBAUTHN_RP_ID ?? "localhost";
const rpName = process.env.WEBAUTHN_RP_NAME ?? "UTH";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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
