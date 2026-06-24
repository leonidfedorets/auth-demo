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
        kid: "v1",
      },
    ],
    note: "This deployment uses HS256. RS256/ES256 public keys are available in production deployments.",
  });
}
