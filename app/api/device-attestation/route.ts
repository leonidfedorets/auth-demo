import { NextRequest, NextResponse } from "next/server";

// Device Attestation Engine — exact spec signal codes + status model
// Rule order: blocked → restricted → degraded → healthy → unknown

const BLOCKING_SIGNALS = new Set([
  "ROOT_DETECTED","JAILBREAK_DETECTED","APP_TAMPER_DETECTED",
  "RUNTIME_HOOK_DETECTED","EMULATOR_DETECTED","SIMULATOR_DETECTED",
  "POLICY_EXPLICITLY_BLOCKS_ENVIRONMENT",
]);
const RESTRICTED_SIGNALS = new Set([
  "NO_SECURE_HARDWARE","NO_SCREEN_LOCK","ATTESTATION_BINDING_MISMATCH",
  "ATTESTATION_SESSION_MISMATCH","POLICY_REQUIRES_STRONGER_DEVICE_TRUST",
  "DEBUG_RUNTIME_DETECTED","CREDENTIAL_ABSENT","AUTOMATION_ENVIRONMENT_DETECTED",
]);
const DEGRADED_SIGNALS = new Set([
  "ATTESTATION_UNAVAILABLE","ATTESTATION_SOURCE_UNSUPPORTED","ATTESTATION_TIMEOUT",
  "WEAK_KEY_PROTECTION","BIOMETRIC_NOT_AVAILABLE","LOCAL_AUTH_WEAK",
]);
const INVALID_SIGNALS = new Set(["ATTESTATION_INVALID"]);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const platform: string = body.platform ?? "web";
  const payload = body.attestationPayload ?? {};

  const signalCodes: string[] = [];

  // Normalize raw evidence → signal codes
  if (payload.rootVerdict === true || (payload.rootIndicators ?? []).length > 0)
    signalCodes.push("ROOT_DETECTED");
  if (payload.jailbreakVerdict === true)
    signalCodes.push("JAILBREAK_DETECTED");
  if (payload.tamperVerdict === true || body.appSignatureValid === false)
    signalCodes.push("APP_TAMPER_DETECTED");
  if (payload.hookVerdict === true)
    signalCodes.push("RUNTIME_HOOK_DETECTED");
  if (payload.debugVerdict === true)
    signalCodes.push("DEBUG_RUNTIME_DETECTED");
  if (payload.emulatorVerdict === true)
    signalCodes.push("EMULATOR_DETECTED");
  if (payload.simulatorVerdict === true)
    signalCodes.push("SIMULATOR_DETECTED");
  if (payload.automationIndicator === true || payload.headlessIndicator === true)
    signalCodes.push("AUTOMATION_ENVIRONMENT_DETECTED");
  if (payload.secureHardwareAvailable === false)
    signalCodes.push("NO_SECURE_HARDWARE");
  if (payload.keyProtectionLevel === "software_backed" || payload.keyProtectionLevel === "unknown")
    signalCodes.push("WEAK_KEY_PROTECTION");
  if (!body.credentialId && body.requiresCredential)
    signalCodes.push("CREDENTIAL_ABSENT");
  if (payload.screenLockEnabled === false)
    signalCodes.push("NO_SCREEN_LOCK");
  if (payload.biometricAvailable === false)
    signalCodes.push("BIOMETRIC_NOT_AVAILABLE");
  if (payload.localAuthStrength === "weak")
    signalCodes.push("LOCAL_AUTH_WEAK");
  if (!body.attestationPayload || Object.keys(payload).length === 0)
    signalCodes.push("ATTESTATION_UNAVAILABLE");
  if (payload.integrityVerdict === "invalid" || payload.signatureValid === false)
    signalCodes.push("ATTESTATION_INVALID");
  if (body.attestationSource === "unsupported")
    signalCodes.push("ATTESTATION_SOURCE_UNSUPPORTED");
  if (body.attestationTimeout === true)
    signalCodes.push("ATTESTATION_TIMEOUT");

  // Status calculation — strict rule order
  const sigSet = new Set(signalCodes);

  let attestationStatus: string;
  let statusReason: string;

  if ([...sigSet].some(s => INVALID_SIGNALS.has(s)) && signalCodes.length === 1) {
    attestationStatus = "unknown";
    statusReason = "Attestation payload invalid or unparseable — cannot safely classify";
  } else if ([...sigSet].some(s => BLOCKING_SIGNALS.has(s))) {
    attestationStatus = "blocked";
    statusReason = `Hard-fail integrity signals detected: ${[...sigSet].filter(s => BLOCKING_SIGNALS.has(s)).join(", ")}`;
  } else if ([...sigSet].some(s => RESTRICTED_SIGNALS.has(s))) {
    attestationStatus = "restricted";
    statusReason = `Security weakness detected: ${[...sigSet].filter(s => RESTRICTED_SIGNALS.has(s)).join(", ")}`;
  } else if ([...sigSet].some(s => DEGRADED_SIGNALS.has(s))) {
    attestationStatus = "degraded";
    statusReason = `Evidence weaker than preferred: ${[...sigSet].filter(s => DEGRADED_SIGNALS.has(s)).join(", ")}`;
  } else if (signalCodes.length === 0) {
    attestationStatus = "healthy";
    statusReason = "No negative signals detected — environment acceptable";
  } else {
    attestationStatus = "unknown";
    statusReason = "Cannot safely classify from available evidence";
  }

  const allowsTrustedContinuation = attestationStatus === "healthy" || attestationStatus === "degraded";
  const requiresStepUp = attestationStatus === "restricted";

  // Binding + Attestation composition (from spec DBA table)
  const bindingStatus = body.bindingStatus ?? "active";
  let compositeResult = "";
  if (bindingStatus === "active" && attestationStatus === "healthy") compositeResult = "DBA-01: Allow normal continuation";
  else if (bindingStatus === "active" && attestationStatus === "degraded") compositeResult = "DBA-02: Continue per policy, reduced trust";
  else if (bindingStatus === "active" && attestationStatus === "restricted") compositeResult = "DBA-03: Require step-up auth";
  else if (bindingStatus === "active" && attestationStatus === "blocked") compositeResult = "DBA-04: Deny — known device now unsafe";
  else if (bindingStatus === "active" && attestationStatus === "unknown") compositeResult = "DBA-05: Never treat as healthy; fallback per policy";
  else if (bindingStatus === "new" && attestationStatus === "healthy") compositeResult = "DBA-06: Continue onboarding/first-bind";
  else if (bindingStatus === "new" && attestationStatus === "blocked") compositeResult = "DBA-09: Deny binding activation";
  else if (bindingStatus === "revoked") compositeResult = "DBA-11/14/15: Rebind path only — not normal reuse";
  else if (bindingStatus === "compromised") compositeResult = "DBA-19/22: No reuse; full re-registration required";
  else compositeResult = "Route per policy";

  return NextResponse.json({
    attestationStatus,
    statusReason,
    signalCodes,
    bindingStatus,
    compositeResult,
    allowsTrustedContinuationByAttestation: allowsTrustedContinuation,
    requiresStepUpByAttestation: requiresStepUp,
    platform,
    evaluatedAt: new Date().toISOString(),
    bindingId: body.bindingId ?? null,
    deviceId: body.deviceId ?? null,
  });
}
