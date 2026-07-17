import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { verifyApiKey } from "@/lib/api-key-auth";
import { redis } from "@/lib/redis";

const DEMO_TID = "c7ed9c17-0633-49df-9bc7-81de55f69fb7";
const HIGH_RISK_LEVELS = new Set(["High", "Prohibited"]);

export async function POST(req: NextRequest) {
  let claims: Record<string, unknown> | null = null;
  const token = req.cookies.get("access_token")?.value;
  if (token) {
    claims = await verifyToken(token) as Record<string, unknown> | null;
  }
  let apiAppId: string | undefined;
  if (!claims) {
    const apiAuth = await verifyApiKey(req as unknown as Request);
    if (apiAuth) {
      claims = { sub: apiAuth.email, tid: apiAuth.tid, sid: null };
      apiAppId = apiAuth.appId;
    }
  }
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const {
    context = "operation",
    operationType,
    amount,
    currency,
    signals: rawSignals = {},
    country,
    ip,
    userId,
    sessionId,
    metadata = {},
  } = body;

  // Resolve country → highRiskCountry signal via tenant overrides
  const signals = { ...rawSignals };
  if (country && !signals.highRiskCountry) {
    try {
      const tenantId = (!claims.tid || claims.tid === "default") ? DEMO_TID : claims.tid as string;
      const overrides = await redis.get<Record<string, string>>(`tenant:country-risk:${tenantId}`);
      if (overrides && HIGH_RISK_LEVELS.has(overrides[country])) {
        signals.highRiskCountry = true;
      }
    } catch {}
  }

  // Device Trust Layer
  let deviceScore = 0;
  if (signals.knownDevice === false) deviceScore += 35;
  if (signals.deviceHealthy === false) deviceScore += 25;
  if (signals.biometricUsed === false && context !== "login") deviceScore += 15;
  if (signals.screenLockEnabled === false) deviceScore += 10;
  if (signals.developerMode === true) deviceScore += 20;
  if (signals.rootedDevice === true) deviceScore += 35;
  if (signals.vpnDetected === true) deviceScore += 10;
  if (signals.torExitNode === true) deviceScore += 30;
  if (signals.highRiskCountry === true) deviceScore += 20;
  if (signals.ipReputationClean === false) deviceScore += 10;
  if (signals.asnResidential === false) deviceScore += 5;

  // Operation risk layer
  let opScore = 0;
  if (context === "payment") {
    const amt = parseFloat(amount) || 0;
    if (amt > 10000) opScore += 30;
    else if (amt > 1000) opScore += 15;
    else if (amt > 100) opScore += 5;
  }
  if (operationType === "account_change") opScore += 20;
  if (operationType === "data_export") opScore += 25;

  const rawScore = Math.min(100, deviceScore + opScore);

  let level = "low";
  if (rawScore > 75) level = "critical";
  else if (rawScore > 50) level = "high";
  else if (rawScore > 25) level = "medium";

  let decision = "ALLOW";
  if (signals.torExitNode) { decision = "DENY"; }
  else if (signals.rootedDevice) { decision = "DENY"; }
  else if (rawScore > 75) decision = "DENY";
  else if (rawScore > 40) decision = "STEP_UP";

  const triggeredSignals = [];
  if (signals.torExitNode) triggeredSignals.push({ code: "TOR", description: "Tor exit node", weight: 30 });
  if (signals.rootedDevice) triggeredSignals.push({ code: "ROOT", description: "Rooted/jailbroken", weight: 35 });
  if (signals.developerMode) triggeredSignals.push({ code: "DEV", description: "Developer mode", weight: 20 });
  if (signals.vpnDetected) triggeredSignals.push({ code: "VPN", description: "VPN active", weight: 10 });
  if (signals.highRiskCountry) triggeredSignals.push({ code: "GEO", description: "High-risk country", weight: 20 });

  return NextResponse.json({
    evaluationId: `eval-${Date.now()}`,
    context,
    operationType,
    score: rawScore,
    level,
    decision,
    triggeredSignals,
    layers: { deviceTrust: deviceScore, operationRisk: opScore },
    requiredAction: decision === "STEP_UP" ? "sca" : null,
    scaMethod: decision === "STEP_UP" ? "totp" : null,
    jwtClaims: { risk: rawScore, risk_lvl: level },
    evaluatedAt: new Date().toISOString(),
    userId: userId || claims.sub,
    sessionId: sessionId || claims.sid,
    tenantId: claims.tid || "default",
    ...(apiAppId ? { appId: apiAppId } : {}),
  });
}
