import { NextRequest, NextResponse } from "next/server";

// Engine Risk Service — exact spec implementation
// EngineRiskScore = min(100, AccountIntegrity + SessionBehavior + OperationRisk + SCAQuality)
// FinalRiskScore = round((AuthRiskScore * 0.5) + (EngineRiskScore * 0.5))

const LAYER_WEIGHTS: Record<string, number> = {
  // Account Integrity
  RECENT_EMAIL_CHANGE: 30, RECENT_PHONE_CHANGE: 30, RECENT_PASSWORD_RESET: 30,
  RECENT_DEVICE_ADD: 30, NEW_ACCOUNT: 30, ACCOUNT_RESTRICTED: 100,
  // Session / Behavior
  FAST_ACTIONS: 40, FAILED_LOGIN_BURST: 60, UNUSUAL_NAVIGATION: 20, UNUSUAL_TIME: 10,
  FAILED_SCA_BURST: 60, OPERATION_BURST: 40, LONG_IDLE_REAUTH: 20,
  // Operation Risk
  NEW_PAYEE: 40, WITHDRAWAL: 40, HIGH_AMOUNT: 30, TOPUP_CARD: 60,
  LIMITS_CHANGE: 20, VELOCITY_HIGH: 40, VERY_HIGH_AMOUNT: 60, CRITICAL_CHANGE: 50,
  RECOVERY_OPERATION: 60, DEVICE_OPERATION: 40, SENSITIVE_DATA_EXPORT: 40,
  // SCA Quality
  FALLBACK_FACTOR_USED: 100, CHANNEL_MISMATCH: 60, SCA_FAILURE_HISTORY: 30,
  WEAK_CURRENT_AUTH: 40, LIMITED_FACTOR_SET: 30,
};

function applyEngineOverrides(factors: Set<string>): string | null {
  if (factors.has("ACCOUNT_RESTRICTED")) return "BLOCK";
  if (factors.has("USER_STATUS_RESTRICTED")) return "BLOCK";
  if (factors.has("RECENT_RECOVERY_CHANGE") && factors.has("RECOVERY_OPERATION")) return "BLOCK";
  if (factors.has("FAILED_SCA_BURST") && factors.has("SCA_FAILURE_HISTORY")) return "BLOCK";
  if (factors.has("VERY_HIGH_AMOUNT") && factors.has("NEW_PAYEE") && factors.has("WEAK_CURRENT_AUTH")) return "BLOCK";
  if (factors.has("CRITICAL_CHANGE") && factors.has("RECENT_PASSWORD_RESET") && factors.has("WEAK_CURRENT_AUTH")) return "BLOCK";
  if (factors.has("SENSITIVE_DATA_EXPORT") && factors.has("RECENT_EMAIL_CHANGE") && factors.has("CHANNEL_MISMATCH")) return "BLOCK";
  if (factors.has("RECOVERY_OPERATION") && factors.has("CHANNEL_MISMATCH") && factors.has("WEAK_CURRENT_AUTH")) return "BLOCK";
  if (factors.has("CHANNEL_MISMATCH") && (factors.has("FAST_ACTIONS") || factors.has("NEW_PAYEE") || factors.has("CRITICAL_CHANGE") || factors.has("SENSITIVE_DATA_EXPORT") || factors.has("WEAK_CURRENT_AUTH"))) return "CHANNEL_SWITCH";
  if (factors.has("FAILED_LOGIN_BURST") || factors.has("FAILED_SCA_BURST") || factors.has("SCA_FAILURE_HISTORY")) return "THROTTLE";
  if ((factors.has("NEW_ACCOUNT") || factors.has("OPERATION_BURST") || factors.has("VERY_HIGH_AMOUNT")) && !factors.has("BLOCK")) return null;
  return null;
}

function engineScoreToAction(score: number, factors: Set<string>): string {
  if (score >= 90) return "BLOCK";
  if (score >= 60) {
    if (factors.has("NEW_ACCOUNT") || factors.has("OPERATION_BURST") || factors.has("VERY_HIGH_AMOUNT")) return "LIMIT";
    if (factors.has("CHANNEL_MISMATCH")) return "CHANNEL_SWITCH";
    if (factors.has("FAILED_LOGIN_BURST") || factors.has("FAILED_SCA_BURST") || factors.has("SCA_FAILURE_HISTORY")) return "THROTTLE";
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
  const authRiskScore: number = body.authRiskScore ?? 0;
  const account = body.account ?? {};
  const session = body.session ?? {};
  const operation = body.operation ?? {};
  const sca = body.sca ?? {};
  const w = { ...LAYER_WEIGHTS, ...(body.weights ?? {}) };

  const signals: { layer: string; factorCode: string; weight: number }[] = [];

  // Account Integrity Layer
  const threshold = 72;
  const now = new Date(body.currentRequestAt ?? new Date());
  if (account.emailChanged && account.emailChangedAt && (now.getTime() - new Date(account.emailChangedAt).getTime()) / 3600000 <= threshold)
    signals.push({ layer: "ACCOUNT_INTEGRITY", factorCode: "RECENT_EMAIL_CHANGE", weight: w.RECENT_EMAIL_CHANGE });
  if (account.phoneChanged && account.phoneChangedAt && (now.getTime() - new Date(account.phoneChangedAt).getTime()) / 3600000 <= threshold)
    signals.push({ layer: "ACCOUNT_INTEGRITY", factorCode: "RECENT_PHONE_CHANGE", weight: w.RECENT_PHONE_CHANGE });
  if (account.passwordReset && account.passwordResetAt && (now.getTime() - new Date(account.passwordResetAt).getTime()) / 3600000 <= threshold)
    signals.push({ layer: "ACCOUNT_INTEGRITY", factorCode: "RECENT_PASSWORD_RESET", weight: w.RECENT_PASSWORD_RESET });
  if (account.deviceAdded && account.deviceAddedAt && (now.getTime() - new Date(account.deviceAddedAt).getTime()) / 3600000 <= threshold)
    signals.push({ layer: "ACCOUNT_INTEGRITY", factorCode: "RECENT_DEVICE_ADD", weight: w.RECENT_DEVICE_ADD });
  if (account.accountCreatedAt && (now.getTime() - new Date(account.accountCreatedAt).getTime()) / 3600000 <= threshold)
    signals.push({ layer: "ACCOUNT_INTEGRITY", factorCode: "NEW_ACCOUNT", weight: w.NEW_ACCOUNT });
  if (account.status === "restricted")
    signals.push({ layer: "ACCOUNT_INTEGRITY", factorCode: "ACCOUNT_RESTRICTED", weight: w.ACCOUNT_RESTRICTED });

  // Session / Behavior Layer
  if (session.secondsFromLoginToAction != null && session.secondsFromLoginToAction <= (session.fastActionThresholdSeconds ?? 30))
    signals.push({ layer: "SESSION_BEHAVIOR", factorCode: "FAST_ACTIONS", weight: w.FAST_ACTIONS });
  if ((session.failedLoginAttemptsWindow ?? 0) >= (session.failedLoginBurstThreshold ?? 5))
    signals.push({ layer: "SESSION_BEHAVIOR", factorCode: "FAILED_LOGIN_BURST", weight: w.FAILED_LOGIN_BURST });
  if ((session.failedSCAAttemptsWindow ?? 0) >= (session.failedSCABurstThreshold ?? 3))
    signals.push({ layer: "SESSION_BEHAVIOR", factorCode: "FAILED_SCA_BURST", weight: w.FAILED_SCA_BURST });
  if (session.navigationPattern === "anomalous")
    signals.push({ layer: "SESSION_BEHAVIOR", factorCode: "UNUSUAL_NAVIGATION", weight: w.UNUSUAL_NAVIGATION });
  if (session.isTimeOfDayAnomalous === true)
    signals.push({ layer: "SESSION_BEHAVIOR", factorCode: "UNUSUAL_TIME", weight: w.UNUSUAL_TIME });
  if ((session.operationsLast5Min ?? 0) >= (session.operationBurstThreshold ?? 10))
    signals.push({ layer: "SESSION_BEHAVIOR", factorCode: "OPERATION_BURST", weight: w.OPERATION_BURST });

  // Operation Risk Layer
  if (operation.isNewPayee === true)
    signals.push({ layer: "OPERATION_RISK", factorCode: "NEW_PAYEE", weight: w.NEW_PAYEE });
  if (operation.isWithdrawal === true)
    signals.push({ layer: "OPERATION_RISK", factorCode: "WITHDRAWAL", weight: w.WITHDRAWAL });
  if (operation.amount != null && operation.amount >= (operation.highAmountThreshold ?? 5000))
    signals.push({ layer: "OPERATION_RISK", factorCode: "HIGH_AMOUNT", weight: w.HIGH_AMOUNT });
  if (operation.amount != null && operation.amount >= (operation.veryHighAmountThreshold ?? 20000))
    signals.push({ layer: "OPERATION_RISK", factorCode: "VERY_HIGH_AMOUNT", weight: w.VERY_HIGH_AMOUNT });
  if (operation.type === "TOPUP_CARD")
    signals.push({ layer: "OPERATION_RISK", factorCode: "TOPUP_CARD", weight: w.TOPUP_CARD });
  if (operation.limitsChanged === true)
    signals.push({ layer: "OPERATION_RISK", factorCode: "LIMITS_CHANGE", weight: w.LIMITS_CHANGE });
  if (operation.operationsLast10Min != null && operation.operationsLast10Min > 10)
    signals.push({ layer: "OPERATION_RISK", factorCode: "VELOCITY_HIGH", weight: w.VELOCITY_HIGH });
  if (operation.type === "RECOVERY") signals.push({ layer: "OPERATION_RISK", factorCode: "RECOVERY_OPERATION", weight: w.RECOVERY_OPERATION });
  if (operation.type === "CRITICAL_CHANGE") signals.push({ layer: "OPERATION_RISK", factorCode: "CRITICAL_CHANGE", weight: w.CRITICAL_CHANGE });

  // SCA Quality Layer
  if (sca.hardwareKeyAbsent === true)
    signals.push({ layer: "SCA_QUALITY", factorCode: "FALLBACK_FACTOR_USED", weight: w.FALLBACK_FACTOR_USED });
  if (sca.initiatedChannel && sca.completionChannel && sca.initiatedChannel !== sca.completionChannel)
    signals.push({ layer: "SCA_QUALITY", factorCode: "CHANNEL_MISMATCH", weight: w.CHANNEL_MISMATCH });
  if ((sca.recentSCAFailuresWindow ?? 0) >= (sca.scaFailureThreshold ?? 3))
    signals.push({ layer: "SCA_QUALITY", factorCode: "SCA_FAILURE_HISTORY", weight: w.SCA_FAILURE_HISTORY });
  if (sca.weakCurrentAuth === true)
    signals.push({ layer: "SCA_QUALITY", factorCode: "WEAK_CURRENT_AUTH", weight: w.WEAK_CURRENT_AUTH });

  const factors = new Set(signals.map(s => s.factorCode));
  const engineRiskRawScore = signals.reduce((a, s) => a + s.weight, 0);
  const engineRiskScore = Math.min(100, engineRiskRawScore);

  const override = applyEngineOverrides(factors);
  const engineRecommendedAction = override ?? engineScoreToAction(engineRiskScore, factors);
  const engineRiskLevel = scoreToLevel(engineRiskScore);

  const finalRiskScore = Math.round((authRiskScore * 0.5) + (engineRiskScore * 0.5));
  const finalRiskLevel = scoreToLevel(finalRiskScore);
  const finalRecommendedAction = [engineRecommendedAction].includes("BLOCK") || authRiskScore >= 90
    ? "BLOCK"
    : engineRecommendedAction;

  // Layer subtotals
  const layerScores = { accountIntegrity: 0, sessionBehavior: 0, operationRisk: 0, scaQuality: 0 };
  for (const s of signals) {
    if (s.layer === "ACCOUNT_INTEGRITY") layerScores.accountIntegrity += s.weight;
    else if (s.layer === "SESSION_BEHAVIOR") layerScores.sessionBehavior += s.weight;
    else if (s.layer === "OPERATION_RISK") layerScores.operationRisk += s.weight;
    else if (s.layer === "SCA_QUALITY") layerScores.scaQuality += s.weight;
  }

  return NextResponse.json({
    authRiskScore,
    engineRiskScore,
    finalRiskScore,
    finalRiskLevel,
    finalRecommendedAction,
    engineRiskLevel,
    engineRecommendedAction,
    overrideApplied: !!override,
    scoreBreakdown: signals.map(s => ({ ...s, signalCode: s.factorCode })),
    layerScores,
    reasonCodes: signals.map(s => s.factorCode),
    evaluatedAt: new Date().toISOString(),
    userId: body.userId ?? null,
    sessionId: body.session?.sessionId ?? null,
    deviceId: body.deviceId ?? null,
  });
}
