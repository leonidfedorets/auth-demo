import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/admin-auth";

// Test merchant/client list.
// In production: replace this with a call to the merchant management service,
// e.g. GET https://merchants-api.internal/v1/merchants?limit=200
// The response shape must remain { clients: Client[] }.
const TEST_CLIENTS = [
  { id: "MCH-0001", name: "Acme Financial Ltd", type: "merchant", country: "IE", status: "active" },
  { id: "MCH-0002", name: "Bluewave Payments", type: "merchant", country: "GB", status: "active" },
  { id: "MCH-0003", name: "Coral Trading GmbH", type: "merchant", country: "DE", status: "active" },
  { id: "MCH-0004", name: "Delta Commerce SA", type: "merchant", country: "FR", status: "active" },
  { id: "MCH-0005", name: "Ember Holdings PLC", type: "merchant", country: "GB", status: "active" },
  { id: "MCH-0006", name: "Faro Enterprises Inc", type: "merchant", country: "US", status: "active" },
  { id: "MCH-0007", name: "Global Nexus Ltd", type: "merchant", country: "IE", status: "active" },
  { id: "MCH-0008", name: "Harrow Capital Partners", type: "merchant", country: "MT", status: "active" },
  { id: "MCH-0009", name: "Irongate Services Corp", type: "merchant", country: "CA", status: "active" },
  { id: "MCH-0010", name: "Jasper Digital Ltd", type: "merchant", country: "IE", status: "active" },
  { id: "MCH-0011", name: "Kestrel Finance BV", type: "merchant", country: "NL", status: "active" },
  { id: "MCH-0012", name: "Luminos Payments Ltd", type: "merchant", country: "GB", status: "active" },
  { id: "MCH-0013", name: "Meridian Trading Co", type: "merchant", country: "AU", status: "active" },
  { id: "MCH-0014", name: "Nova Credit Solutions", type: "merchant", country: "IE", status: "active" },
  { id: "MCH-0015", name: "Orbit Commerce GmbH", type: "merchant", country: "DE", status: "active" },
  { id: "MCH-0016", name: "Pinnacle Pay Ltd", type: "merchant", country: "MT", status: "active" },
  { id: "MCH-0017", name: "Quantum Fintech SA", type: "merchant", country: "FR", status: "active" },
  { id: "MCH-0018", name: "Radiant Markets Inc", type: "merchant", country: "US", status: "active" },
  { id: "MCH-0019", name: "Solaris Financial Ltd", type: "merchant", country: "GB", status: "active" },
  { id: "MCH-0020", name: "Terra Ventures Corp", type: "merchant", country: "CA", status: "active" },
];

export async function GET(req: NextRequest) {
  const auth = await adminAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase() ?? "";

  const results = q
    ? TEST_CLIENTS.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q)
      )
    : TEST_CLIENTS;

  return NextResponse.json({ clients: results });
}
