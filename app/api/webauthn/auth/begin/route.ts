import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/jwt";
import { storeWebAuthnChallenge } from "@/lib/redis";
import { generateAuthenticationOptions } from "@simplewebauthn/server";

const rpID = process.env.WEBAUTHN_RP_ID ?? "localhost";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  const claims = token ? await verifyToken(token) : null;
  const body = await req.json().catch(() => ({}));
  const userId = claims?.sub ?? body.userId;
  if (!userId) return NextResponse.json({ error: "user_id_required" }, { status: 400 });

  const credentials = await sql`SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = ${userId}`;
  if (!credentials.rows.length) return NextResponse.json({ error: "no_credentials_registered" }, { status: 404 });

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: credentials.rows.map(c => ({
      id: c.credential_id,
      type: "public-key" as const,
      transports: JSON.parse(c.transports || "[]"),
    })),
    userVerification: "preferred",
  });

  await storeWebAuthnChallenge(userId, options.challenge, "auth");
  return NextResponse.json(options);
}
