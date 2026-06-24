import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { redis } from "@/lib/redis";

export const DEFAULT_SETTINGS = {
  jwt: {
    accessTokenTtlSeconds: 900,
    refreshTokenTtlSeconds: 2592000,
    sessionRotationSeconds: 86400,
    includedClaims: ["sub","email","tid","sid","did","dfp","amr","acr","risk","risk_lvl","sca","sca_method","ttype","roles"],
    excludedClaims: [] as string[],
  },
  deviceBinding: {
    maxDevicesPerUser: 3,
    requireAttestationForBinding: false,
    silentLoginIfRiskLow: true,
    riskThresholdForSilentLogin: 25,
  },
  attestation: {
    enabledSignals: ["KD","DH","BIO","SLE","TPM","SEA","DEV","ROOT","EMU","DBG","HOOK","INT","VPN","TOR","GEO","IPR","ASN","OS"],
    disabledSignals: [] as string[],
    minimumStatus: "healthy",
    requiredForPayments: true,
    blockRooted: true,
    blockEmulator: true,
  },
  risk: {
    enabledSignals: ["knownDevice","deviceHealthy","biometricUsed","screenLockEnabled","developerMode","rootedDevice","vpnDetected","torExitNode","highRiskCountry","ipReputationClean","asnResidential"],
    disabledSignals: [] as string[],
  },
};

export async function GET(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const stored = await redis.get<typeof DEFAULT_SETTINGS>(`tenant:settings:${(claims.tid && claims.tid !== "default" ? claims.tid : "c7ed9c17-0633-49df-9bc7-81de55f69fb7")}`);
    return NextResponse.json({ settings: stored || DEFAULT_SETTINGS });
  } catch {
    return NextResponse.json({ settings: DEFAULT_SETTINGS });
  }
}

export async function PUT(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = await verifyToken(token);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  try {
    await redis.set(`tenant:settings:${(claims.tid && claims.tid !== "default" ? claims.tid : "c7ed9c17-0633-49df-9bc7-81de55f69fb7")}`, body, { ex: 86400*365 });
    return NextResponse.json({ success: true, settings: body });
  } catch {
    return NextResponse.json({ success: true, settings: body });
  }
}
