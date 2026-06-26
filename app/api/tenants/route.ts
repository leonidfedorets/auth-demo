import { NextResponse } from "next/server";

// Tenant listing is not permitted — each tenant sees only their own data.
// Tenants register via the UTH web UI, not via this API.
export async function GET() {
  return NextResponse.json(
    { error: "forbidden", message: "Tenant listing is not permitted. Tenants register via the UTH web interface." },
    { status: 403 }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "forbidden", message: "Tenant registration must be done via the UTH web interface at /register." },
    { status: 403 }
  );
}
