import { NextRequest, NextResponse } from "next/server";

// Exact spec: Auth Risk — Device Trust Layer + Network & Geo Layer
// AuthRiskScore = min(100, DeviceTrustScore + NetworkGeoScore)

const DEVICE_TRUST_WEIGHTS: Record<string, number> = {
  NEW_DEVICE: 30,
  DEVICE_RESTRICTED: 40,
  DEVICE_BLOCKED: 100,
  NO_SCREEN_LOCK: 60,
  NO_HARDWARE_KEY: 60,
  MANY_TRUSTED_DEVICES: 20,
  DEBUG_MODE: 30,
  EMULATOR: 60,
  OUTDATED_OS: 10,
};

const NETWORK_GEO_WEIGHTS: Record<string, number> = {
  NEW_IP: 20,
  NEW_COUNTRY: 40,
};

function applyOverrides(factors: Set<string>): string | null {
  // Rule A — immediate block
  if (factors.has("DEVICE_BLOCKED") || factors.has("EMULATOR") || factors.has("NO_SCREEN_LOCK")) return "BLOCK";
  // Rule B — hardware-key severe combos
  if (factors.has("NO_HARDWARE_KEY") && factors.has("DEVICE_RESTRICTED")) return "BLOCK";
  if (factors.has("NO_HARDWARE_KEY") && factors.has("NEW_COUNTRY")) return "BLOCK";
  if (factors.has("NO_HARDWARE_KEY") && factors.has("NEW_IP") && factors.has("NEW_COUNTRY")) return "BLOCK";
  // Rule C — restricted device escalation
  if (factors.has("DEVICE_RESTRICTED") && factors.has("NEW_COUNTRY") && factors.has("NEW_IP")) return "BLOCK";
  if (factors.has("DEVICE_RESTRICTED") && factors.has("NEW_COUNTRY")) return "CHANNEL_SWITCH";
  if (factors.has("DEVICE_RESTRICTED") && factors.has("NEW_IP")) return "CHANNEL_SWITCH";
  // Rule D — debug-mode escalation
  if (factors.has("DEBUG_MODE") && factors.has("NEW_COUNTRY") && factors.has("NEW_IP")) return "BLOCK";
  if (factors.has("DEBUG_MODE") && factors.has("NEW_COUNTRY")) return "CHANNEL_SWITCH";
  // Extended overrides from spec
  if (factors.has("MANY_TRUSTED_DEVICES") && factors.has("DEVICE_RESTRICTED") && factors.has("NEW_COUNTRY")) return "BLOCK";
  if (factors.has("OUTDATED_OS") && factors.has("DEVICE_RESTRICTED") && factors.has("NEW_COUNTRY") && factors.has("NEW_IP")) return "BLOCK";
  return null;
}

function scoreToAction(score: number, factors: Set<string>): string {
  if (score >= 90) return "BLOCK";
  if (score >= 60) {
    if (factors.has("NO_HARDWARE_KEY") && !factors.has("NEW_COUNTRY")) return "LIMIT";
    if (factors.has("DEVICE_RESTRICTED") || (factors.has("DEBUG_MODE") && (factors.has("NEW_IP") || factors.has("NEW_COUNTRY")))) return "CHANNEL_SWITCH";
    return "STEP_UP_SCA";
  }
  if (score >= 30) return "STEP_UP_SCA";
  return "ALLOW";
}

function scoreToLevel(score: number): string {
  if (score >= 90) return "critical";
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  
  const deviceContext = body.deviceContext ?? {};
  const networkContext = body.networkContext ?? {};
  const customWeights = body.weights ?? {};

  const dw = { ...DEVICE_TRUST_WEIGHTS, ...customWeights };
  const nw = { ...NETWORK_GEO_WEIGHTS, ...customWeights };

  const deviceSignals: { factor: string; signalCode: string; weight: number; layer: string }[] = [];
  const networkSignals: { factor: string; signalCode: string; weight: number; layer: string }[] = [];

  // Device Trust Layer evaluation
  if (deviceContext.bindingStatus === "none" || deviceContext.isNewDevice === true) {
    deviceSignals.push({ factor: "NEW_DEVICE", signalCode: "DEVICE_UNSEEN", weight: dw.NEW_DEVICE, layer: "DEVICE_TRUST" });
  }
  if (deviceContext.attestationStatus === "restricted" || deviceContext.deviceTrustStatus === "restricted") {
    deviceSignals.push({ factor: "DEVICE_RESTRICTED", signalCode: "ATTESTATION_RESTRICTED", weight: dw.DEVICE_RESTRICTED, layer: "DEVICE_TRUST" });
  }
  if (deviceContext.attestationStatus === "blocked" || deviceContext.deviceTrustStatus === "blocked") {
    deviceSignals.push({ factor: "DEVICE_BLOCKED", signalCode: "ATTESTATION_BLOCKED", weight: dw.DEVICE_BLOCKED, layer: "DEVICE_TRUST" });
  }
  if (deviceContext.screenLockDisabled === true || deviceContext.attestationPayload?.screenLockDisabled === true) {
    deviceSignals.push({ factor: "NO_SCREEN_LOCK", signalCode: "DEVICE_NO_SCREEN_LOCK", weight: dw.NO_SCREEN_LOCK, layer: "DEVICE_TRUST" });
  }
  if (deviceContext.hasHardwareKey === false || deviceContext.attestationPayload?.secureHardwareDisabled === true) {
    deviceSignals.push({ factor: "NO_HARDWARE_KEY", signalCode: "NO_SECURE_HARDWARE", weight: dw.NO_HARDWARE_KEY, layer: "DEVICE_TRUST" });
  }
  if ((deviceContext.trustedDevicesCount ?? 0) > (body.maxTrustedDevices ?? 3)) {
    deviceSignals.push({ factor: "MANY_TRUSTED_DEVICES", signalCode: "DEVICE_COUNT_HIGH", weight: dw.MANY_TRUSTED_DEVICES, layer: "DEVICE_TRUST" });
  }
  if (deviceContext.debugMode === true || deviceContext.attestationPayload?.debugVerdict === true) {
    deviceSignals.push({ factor: "DEBUG_MODE", signalCode: "DEVICE_DEBUG_MODE", weight: dw.DEBUG_MODE, layer: "DEVICE_TRUST" });
  }
  if (deviceContext.isEmulator === true || deviceContext.attestationPayload?.emulatorVerdict === true) {
    deviceSignals.push({ factor: "EMULATOR", signalCode: "DEVICE_EMULATOR", weight: dw.EMULATOR, layer: "DEVICE_TRUST" });
  }
  if (deviceContext.isOutdatedOs === true) {
    deviceSignals.push({ factor: "OUTDATED_OS", signalCode: "DEVICE_OUTDATED_OS", weight: dw.OUTDATED_OS, layer: "DEVICE_TRUST" });
  }

  // Network & Geo Layer evaluation
  if (networkContext.isNewIp === true || networkContext.ipUnseen === true) {
    networkSignals.push({ factor: "NEW_IP", signalCode: "IP_UNSEEN", weight: nw.NEW_IP, layer: "NETWORK_GEO" });
  }
  if (networkContext.isNewCountry === true || (networkContext.country && networkContext.previousCountry && networkContext.country !== networkContext.previousCountry)) {
    networkSignals.push({ factor: "NEW_COUNTRY", signalCode: "COUNTRY_ANOMALY", weight: nw.NEW_COUNTRY, layer: "NETWORK_GEO" });
  }

  const allSignals = [...deviceSignals, ...networkSignals];
  const factors = new Set(allSignals.map(s => s.factor));

  const deviceTrustScore = Math.min(100, deviceSignals.reduce((a, s) => a + s.weight, 0));
  const networkGeoScore = Math.min(100, networkSignals.reduce((a, s) => a + s.weight, 0));
  const authRiskRawScore = deviceTrustScore + networkGeoScore;
  const authRiskScore = Math.min(100, authRiskRawScore);

  const override = applyOverrides(factors);
  const authRecommendedAction = override ?? scoreToAction(authRiskScore, factors);
  const authRiskLevel = scoreToLevel(authRiskScore);

  const scoreBreakdown = allSignals.map(s => ({
    layer: s.layer,
    factorCode: s.factor,
    signalCode: s.signalCode,
    weight: s.weight,
  }));

  return NextResponse.json({
    authRiskScore,
    authRiskLevel,
    authRecommendedAction,
    scoreBreakdown,
    reasonCodes: allSignals.map(s => s.signalCode),
    layerScores: { deviceTrustScore, networkGeoScore },
    overrideApplied: !!override,
    evaluatedAt: new Date().toISOString(),
    userId: body.userId ?? null,
    sessionId: body.sessionId ?? null,
    deviceId: body.deviceContext?.deviceId ?? null,
  });
}
