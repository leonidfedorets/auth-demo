import { NextRequest, NextResponse } from "next/server";
import { generateId, generateId as genKey } from "@/lib/auth";

// Tenant onboarding endpoint
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { orgName, email, plan } = body;
  
  if (!orgName || !email) return NextResponse.json({ error: "orgName and email required" }, { status: 400 });

  const tenantId = "ten_" + generateId().slice(0, 8);
  const apiKey = "sk_live_" + generateId() + generateId();
  const webhookSecret = "whsec_" + generateId();
  
  const planLimits = {
    starter: { mau: 10000, rps: 100, features: ["jwt", "sessions", "basic_risk"] },
    growth: { mau: 100000, rps: 500, features: ["jwt", "sessions", "full_risk", "webauthn", "sca", "attestation"] },
    enterprise: { mau: -1, rps: -1, features: ["all"] },
  };

  const selectedPlan = plan ?? "starter";

  return NextResponse.json({
    tenantId,
    apiKey,
    webhookSecret,
    plan: selectedPlan,
    limits: planLimits[selectedPlan as keyof typeof planLimits] ?? planLimits.starter,
    createdAt: new Date().toISOString(),
    configExample: {
      baseUrl: "https://uth.yourdomain.com",
      tenantId,
      headers: { "X-Tenant-ID": tenantId, "Authorization": `Bearer ${apiKey}` },
    },
    nextSteps: [
      "Set environment variables in your backend",
      "Configure webhook endpoint to receive events",
      "Make your first test API call to /api/auth/register",
      "Review JWT claims in your token",
      "Go live checklist complete",
    ],
  });
}
