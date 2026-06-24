import { NextResponse } from "next/server";

// In production this returns the RSA/EC public keys for token verification.
// This demo uses HS256 (symmetric), so we expose the algorithm metadata only.
export async function GET() {
  return NextResponse.json({
    keys: [
      {
        kty: "oct",
        use: "sig",
        alg: "HS256",
        kid: "demo-v1",
      },
    ],
    note: "Demo uses HS256. Production auth-service exposes RS256/ES256 public keys here.",
  });
}
