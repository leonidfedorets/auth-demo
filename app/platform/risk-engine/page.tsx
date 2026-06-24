"use client";
import { useState } from "react";
import Link from "next/link";
import { Activity, Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

function UthNav() {
  return (
    <nav className="border-b border-zinc-800 px-6 py-3 flex items-center gap-4 bg-zinc-950">
      <Link href="/" className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center"><span className="font-black text-white text-[10px]">UTH</span></div>
        <span className="font-black text-sm tracking-tighter"><span className="text-indigo-400">U</span><span className="text-indigo-300">T</span><span className="text-indigo-200">H</span></span>
      </Link>
      <span className="text-zinc-600">/</span>
      <span className="text-zinc-400 text-sm">Auth Risk Engine</span>
      <div className="ml-auto flex gap-3">
        <Link href="/platform/engine-risk" className="text-zinc-500 hover:text-white text-xs">Engine Risk</Link>
        <Link href="/platform/device-attestation" className="text-zinc-500 hover:text-white text-xs">Attestation</Link>
        <Link href="/dashboard" className="text-zinc-500 hover:text-white text-xs">Dashboard</Link>
      </div>
    </nav>
  );
}

// Signal toggle state
const SIGNAL_DEFAULTS = {
  knownDevice: true,
  deviceHealthy: true,
  biometricUsed: false,
  screenLockEnabled: true,
  developerMode: false,
  rootedDevice: false,
  vpnDetected: false,
  torExitNode: false,
  highRiskCountry: false,
  ipReputationClean: true,
  asnResidential: true,
};

const SIGNAL_LABELS: Record<string, string> = {
  knownDevice: "Known device",
  deviceHealthy: "Device healthy",
  biometricUsed: "Biometric used",
  screenLockEnabled: "Screen lock enabled",
  developerMode: "Developer mode",
  rootedDevice: "Rooted / Jailbroken",
  vpnDetected: "VPN detected",
  torExitNode: "Tor exit node",
  highRiskCountry: "High-risk country",
  ipReputationClean: "IP reputation clean",
  asnResidential: "ASN residential",
};

// Signal weight table (positive = risk added, negative = risk reduced)
const SIGNAL_WEIGHTS: Record<string, { weight: number; label: string; risky: boolean }> = {
  knownDevice:        { weight: -35, label: "known_device_match",   risky: false },
  deviceHealthy:      { weight: -25, label: "device_health_ok",     risky: false },
  biometricUsed:      { weight: -15, label: "biometric_auth",       risky: false },
  screenLockEnabled:  { weight: -10, label: "screen_lock_on",       risky: false },
  developerMode:      { weight:  20, label: "developer_mode",       risky: true  },
  rootedDevice:       { weight:  35, label: "root_jailbreak",       risky: true  },
  vpnDetected:        { weight:  10, label: "vpn_active",           risky: true  },
  torExitNode:        { weight:  30, label: "tor_exit",             risky: true  },
  highRiskCountry:    { weight:  20, label: "high_risk_country",    risky: true  },
  ipReputationClean:  { weight: -10, label: "ip_reputation",        risky: false },
  asnResidential:     { weight:  -5, label: "asn_residential",      risky: false },
};

function computeRisk(signals: Record<string, boolean>) {
  let score = 0;
  const triggered: { name: string; weight: number }[] = [];

  for (const [key, active] of Object.entries(signals)) {
    const def = SIGNAL_WEIGHTS[key];
    if (!def) continue;
    // For risky signals: add score when ON; for trust signals: add benefit when ON (negative weight)
    if (active) {
      score += def.weight;
      triggered.push({ name: def.label, weight: def.weight });
    }
  }

  // Clamp to 0–100
  score = Math.min(100, Math.max(0, score));

  const level = score >= 75 ? "critical" : score >= 50 ? "high" : score >= 25 ? "medium" : "low";

  // Override rules
  let decision: string;
  let overrideApplied: string | null = null;

  if (signals.torExitNode) {
    decision = "BLOCK";
    overrideApplied = "Rule A — Tor exit node immediate block";
  } else if (signals.rootedDevice && signals.vpnDetected) {
    decision = "BLOCK";
    overrideApplied = "Rule B — Rooted device + VPN";
  } else if (score >= 75) {
    decision = "BLOCK";
  } else if (score >= 50) {
    decision = "STEP_UP_SCA";
  } else if (score >= 25) {
    decision = "STEP_UP_MFA";
  } else {
    decision = "ALLOW";
  }

  const deviceTrustScore = Math.min(100, Math.max(0,
    (signals.knownDevice ? -35 : 0) +
    (signals.deviceHealthy ? -25 : 0) +
    (signals.biometricUsed ? -15 : 0) +
    (signals.screenLockEnabled ? -10 : 0) +
    (signals.developerMode ? 20 : 0) +
    (signals.rootedDevice ? 35 : 0)
  ));
  const networkGeoScore = Math.min(100, Math.max(0,
    (signals.vpnDetected ? 10 : 0) +
    (signals.torExitNode ? 30 : 0) +
    (signals.highRiskCountry ? 20 : 0) +
    (signals.ipReputationClean ? -10 : 0) +
    (signals.asnResidential ? -5 : 0)
  ));

  return {
    authRiskScore: score,
    authRiskLevel: level,
    authRecommendedAction: decision,
    overrideApplied,
    scoreBreakdown: triggered,
    layerScores: { deviceTrustScore, networkGeoScore },
  };
}

const LEVEL_COLOR: Record<string, string> = {
  low: "text-green-400",
  medium: "text-yellow-400",
  high: "text-orange-400",
  critical: "text-red-400",
};

const LEVEL_BADGE: Record<string, string> = {
  low: "bg-green-500/20 text-green-300",
  medium: "bg-yellow-500/20 text-yellow-300",
  high: "bg-orange-500/20 text-orange-300",
  critical: "bg-red-500/20 text-red-300",
};

const DECISION_COLOR: Record<string, string> = {
  ALLOW: "text-green-400",
  STEP_UP_MFA: "text-yellow-400",
  STEP_UP_SCA: "text-orange-400",
  BLOCK: "text-red-400",
};

export default function RiskEnginePage() {
  const [signals, setSignals] = useState<Record<string, boolean>>(SIGNAL_DEFAULTS);
  const [ip, setIp] = useState("195.12.50.10");
  const [result, setResult] = useState<ReturnType<typeof computeRisk> | null>(null);

  function evaluate() {
    setResult(computeRisk(signals));
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <UthNav />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-yellow-500/15"><Activity className="w-5 h-5 text-yellow-400" /></div>
          <div>
            <h1 className="text-2xl font-black text-white">Auth Risk Engine</h1>
            <p className="text-zinc-400 text-sm">Device Trust Layer (9 signals) + Network &amp; Geo Layer — AuthRiskScore = min(100, DeviceTrust + NetworkGeo)</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Signals */}
          <div className="lg:col-span-1 space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <h3 className="font-semibold text-white mb-3 text-sm">Device &amp; Network Signals</h3>
              <div className="space-y-2">
                {Object.entries(signals).map(([k, v]) => (
                  <label key={k} className="flex items-center justify-between gap-2 py-1 cursor-pointer group">
                    <span className="text-zinc-400 text-xs group-hover:text-white">{SIGNAL_LABELS[k]}</span>
                    <button
                      type="button"
                      onClick={() => setSignals(s => ({ ...s, [k]: !v }))}
                      className={`w-9 h-5 rounded-full transition-colors relative ${v ? "bg-indigo-600" : "bg-zinc-700"}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${v ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                    </button>
                  </label>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <Label className="text-zinc-400 text-xs mb-1.5 block">Client IP</Label>
              <Input value={ip} onChange={e => setIp(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white font-mono text-sm" />
            </div>
            <Button onClick={evaluate} className="w-full bg-indigo-600 hover:bg-indigo-700 h-11 cursor-pointer">
              Evaluate Risk →
            </Button>
          </div>

          {/* Result */}
          <div className="lg:col-span-2 space-y-4">
            {result ? (
              <>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-white">Result</h3>
                    <span className={`text-3xl font-black ${LEVEL_COLOR[result.authRiskLevel] ?? "text-white"}`}>
                      {result.authRiskScore}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-zinc-800 rounded-lg p-3 text-center">
                      <p className="text-zinc-500 text-xs mb-1">Risk Level</p>
                      <Badge className={`${LEVEL_BADGE[result.authRiskLevel] ?? ""} border-0 text-sm`}>
                        {result.authRiskLevel}
                      </Badge>
                    </div>
                    <div className="bg-zinc-800 rounded-lg p-3 text-center">
                      <p className="text-zinc-500 text-xs mb-1">Decision</p>
                      <p className={`font-bold text-sm ${DECISION_COLOR[result.authRecommendedAction] ?? "text-white"}`}>
                        {result.authRecommendedAction}
                      </p>
                    </div>
                  </div>
                  {/* Layer scores */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-zinc-800/60 rounded-lg p-3">
                      <p className="text-zinc-500 text-[10px] uppercase tracking-wide mb-1">Device Trust Score</p>
                      <p className="text-white font-bold">{result.layerScores.deviceTrustScore}</p>
                    </div>
                    <div className="bg-zinc-800/60 rounded-lg p-3">
                      <p className="text-zinc-500 text-[10px] uppercase tracking-wide mb-1">Network &amp; Geo Score</p>
                      <p className="text-white font-bold">{result.layerScores.networkGeoScore}</p>
                    </div>
                  </div>
                  {/* Triggered signals */}
                  {result.scoreBreakdown.length > 0 && (
                    <div>
                      <p className="text-zinc-500 text-xs mb-2 uppercase tracking-wide">Active signals</p>
                      <div className="space-y-1">
                        {result.scoreBreakdown.map(s => (
                          <div key={s.name} className="flex justify-between text-xs bg-zinc-800 rounded px-3 py-1.5">
                            <span className="text-zinc-300 font-mono">{s.name}</span>
                            <span className={s.weight > 0 ? "text-red-400 font-mono" : "text-green-400 font-mono"}>
                              {s.weight > 0 ? `+${s.weight}` : s.weight}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.overrideApplied && (
                    <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-300">
                      Override applied: {result.overrideApplied}
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-mono text-xs text-zinc-400 overflow-auto max-h-48">
                  <pre>{JSON.stringify({ authRiskScore: result.authRiskScore, authRiskLevel: result.authRiskLevel, authRecommendedAction: result.authRecommendedAction, scoreBreakdown: result.scoreBreakdown, layerScores: result.layerScores, overrideApplied: result.overrideApplied }, null, 2)}</pre>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-12 text-center">
                <Sliders className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-500">Adjust signals and click Evaluate Risk</p>
              </div>
            )}

            {/* Signal weights reference */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <h3 className="text-white text-xs font-semibold mb-3 uppercase tracking-wide">Signal Weights (Device Trust Layer)</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(SIGNAL_WEIGHTS).map(([key, def]) => (
                  <div key={key} className={`flex justify-between rounded px-2 py-1 ${signals[key] ? "bg-zinc-700" : "bg-zinc-800"}`}>
                    <span className="text-zinc-400 font-mono">{def.label}</span>
                    <span className={def.weight > 0 ? "text-red-400" : "text-green-400"}>
                      {def.weight > 0 ? `+${def.weight}` : def.weight}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
