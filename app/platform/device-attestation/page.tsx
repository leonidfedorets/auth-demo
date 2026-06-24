"use client";
import { useState } from "react";
import Link from "next/link";
import { Smartphone, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function UthNav() {
  return (<nav className="border-b border-zinc-800 px-6 py-3 flex items-center gap-4 bg-zinc-950"><Link href="/" className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center"><span className="font-black text-white text-[10px]">UTH</span></div><span className="font-black text-sm tracking-tighter"><span className="text-indigo-400">U</span><span className="text-indigo-300">T</span><span className="text-indigo-200">H</span></span></Link><span className="text-zinc-600">/</span><span className="text-zinc-400 text-sm">Device Attestation</span><div className="ml-auto flex gap-3"><Link href="/platform/risk-engine" className="text-zinc-500 hover:text-white text-xs">Risk Engine</Link><Link href="/dashboard" className="text-zinc-500 hover:text-white text-xs">Dashboard</Link></div></nav>);
}

const ALL_SIGNALS = [
  { code: "KD", label: "Known Device", risk: false, weight: -35 },
  { code: "DH", label: "Device Healthy", risk: false, weight: -25 },
  { code: "BIO", label: "Biometric Auth", risk: false, weight: -15 },
  { code: "SLE", label: "Screen Lock", risk: false, weight: -10 },
  { code: "TPM", label: "TPM Present", risk: false, weight: -20 },
  { code: "SEA", label: "Secure Enclave Active", risk: false, weight: -15 },
  { code: "DEV", label: "Developer Mode", risk: true, weight: +20 },
  { code: "ROOT", label: "Rooted / Jailbroken", risk: true, weight: +35 },
  { code: "EMU", label: "Emulator / VM", risk: true, weight: +40 },
  { code: "DBG", label: "Debug Build", risk: true, weight: +25 },
  { code: "HOOK", label: "Frida / Hook Detected", risk: true, weight: +50 },
  { code: "INT", label: "App Integrity Fail", risk: true, weight: +30 },
  { code: "VPN", label: "VPN Active", risk: true, weight: +10 },
  { code: "TOR", label: "Tor Exit Node", risk: true, weight: +30 },
  { code: "GEO", label: "High-Risk Country", risk: true, weight: +20 },
  { code: "IPR", label: "IP Reputation Clean", risk: false, weight: -10 },
  { code: "ASN", label: "ASN Residential", risk: false, weight: -5 },
  { code: "OS", label: "OS Up-to-date", risk: false, weight: -10 },
];

// Signal codes → attestation verdict mapping
const BLOCKED_SIGNALS = new Set(["ROOT", "HOOK", "INT", "EMU"]);    // ROOT_DETECTED, JAILBREAK_DETECTED, APP_TAMPER_DETECTED, RUNTIME_HOOK_DETECTED, EMULATOR_DETECTED
const RESTRICTED_SIGNALS = new Set(["DBG", "SLE", "TPM", "SEA"]);   // DEBUG_RUNTIME, NO_SCREEN_LOCK, NO_SECURE_HARDWARE, CREDENTIAL_ABSENT
const DEGRADED_SIGNALS = new Set(["DEV", "BIO", "KD"]);             // ATTESTATION_UNAVAILABLE, BIOMETRIC_NOT_AVAILABLE, WEAK_KEY_PROTECTION

// Signal code descriptions for report
const SIGNAL_DESCRIPTIONS: Record<string, string> = {
  ROOT: "ROOT_DETECTED — device is rooted or jailbroken",
  HOOK: "RUNTIME_HOOK_DETECTED — Frida or similar framework active",
  INT: "APP_TAMPER_DETECTED — application integrity check failed",
  EMU: "EMULATOR_DETECTED — running in emulator or VM",
  DBG: "DEBUG_RUNTIME_DETECTED — debug build or debug flag",
  SLE: "NO_SCREEN_LOCK — screen lock not configured",
  TPM: "NO_SECURE_HARDWARE — TPM/secure enclave absent",
  SEA: "CREDENTIAL_ABSENT — secure enclave not active",
  DEV: "ATTESTATION_UNAVAILABLE — developer mode bypasses attestation",
  BIO: "BIOMETRIC_NOT_AVAILABLE — biometric auth not enrolled",
  KD: "WEAK_KEY_PROTECTION — device not previously bound",
  VPN: "VPN_ACTIVE — VPN tunnel detected",
  TOR: "TOR_EXIT_NODE — traffic through Tor exit node",
  GEO: "HIGH_RISK_COUNTRY — request originates from high-risk geography",
};

const PRESETS = {
  healthy: { label: "Healthy iPhone", active: ["KD","DH","BIO","SLE","TPM","SEA","IPR","ASN","OS"], platform: "ios" },
  degraded: { label: "Degraded Android", active: ["KD","DH","SLE","DEV","VPN"], platform: "android" },
  restricted: { label: "Restricted (jailbroken)", active: ["KD","ROOT","INT","GEO"], platform: "ios" },
  blocked: { label: "Blocked (compromised)", active: ["ROOT","HOOK","INT","EMU","TOR"], platform: "android" },
};

function computeAttestation(activeSignals: string[], platform: string) {
  // Risk signals that ARE active (risk:true and toggled on)
  const riskActive = ALL_SIGNALS.filter(s => s.risk && activeSignals.includes(s.code));
  // Good signals that are NOT active (risk:false and toggled off = bad)
  const goodMissing = ALL_SIGNALS.filter(s => !s.risk && !activeSignals.includes(s.code));

  // Trust score: start at 100, add weights of active risk signals, subtract for missing good signals
  let trustScore = 100;
  for (const s of riskActive) trustScore += s.weight; // weight is positive for risk signals
  for (const s of goodMissing) trustScore += s.weight; // weight is negative for good signals (now missing)
  trustScore = Math.max(0, Math.min(100, trustScore));

  // Triggered signal codes
  const triggeredCodes: string[] = [];
  for (const s of riskActive) triggeredCodes.push(s.code);
  // Missing good signals that map to verdicts
  for (const s of goodMissing) {
    if (RESTRICTED_SIGNALS.has(s.code) || DEGRADED_SIGNALS.has(s.code)) {
      triggeredCodes.push(s.code);
    }
  }

  // Determine status
  let status: string;
  const hasBlocked = riskActive.some(s => BLOCKED_SIGNALS.has(s.code));
  const hasRestricted = riskActive.some(s => RESTRICTED_SIGNALS.has(s.code)) ||
    goodMissing.some(s => RESTRICTED_SIGNALS.has(s.code));
  const hasDegraded = riskActive.some(s => DEGRADED_SIGNALS.has(s.code)) ||
    goodMissing.some(s => DEGRADED_SIGNALS.has(s.code));

  const totalActiveSignals = activeSignals.length;

  if (totalActiveSignals < 2) {
    status = "unknown";
  } else if (hasBlocked) {
    status = "blocked";
  } else if (hasRestricted) {
    status = "restricted";
  } else if (hasDegraded || riskActive.length > 0) {
    status = "degraded";
  } else {
    status = "healthy";
  }

  // DBA
  const dba = status === "healthy" ? "allowed" : status === "degraded" ? "restricted" : "deny";

  // Decision recommendation
  const recommendations: Record<string, string> = {
    healthy: "Device trusted — all critical checks pass. Silent login eligible for low-risk operations.",
    degraded: "Device has minor risk signals. Require explicit authentication; silent login not permitted.",
    restricted: "Significant risk signals detected. Restrict to read-only operations; require re-auth and SCA for writes.",
    blocked: "Critical signals detected — deny all access immediately. Block session and require full re-registration.",
    unknown: "Insufficient signal data to evaluate device trust. Request additional attestation proofs.",
  };

  const triggeredWithDesc = triggeredCodes.map(code => ({
    code,
    description: SIGNAL_DESCRIPTIONS[code] || code,
  }));

  return {
    status,
    trustScore,
    dba,
    platform,
    signals: {
      triggered: triggeredCodes,
      triggeredWithDescriptions: triggeredWithDesc,
      passed: ALL_SIGNALS.filter(s => !s.risk && activeSignals.includes(s.code)).map(s => s.code),
    },
    recommendation: recommendations[status],
    evaluatedAt: new Date().toISOString(),
  };
}

export default function DeviceAttestationPage() {
  const [activeSignals, setActiveSignals] = useState<string[]>(["KD","DH","BIO","SLE","TPM","SEA","IPR","ASN","OS"]);
  const [platform, setPlatform] = useState("ios");
  const [result, setResult] = useState<ReturnType<typeof computeAttestation> | null>(null);

  function toggleSignal(code: string) {
    setActiveSignals(s => s.includes(code) ? s.filter(x=>x!==code) : [...s,code]);
  }
  function applyPreset(key: keyof typeof PRESETS) {
    setActiveSignals(PRESETS[key].active);
    setPlatform(PRESETS[key].platform);
  }

  function evaluate() {
    setResult(computeAttestation(activeSignals, platform));
  }

  const statusColor: Record<string,string> = { healthy:"text-green-400",degraded:"text-yellow-400",restricted:"text-orange-400",blocked:"text-red-400",unknown:"text-zinc-400" };
  const statusBg: Record<string,string> = { healthy:"border-green-500/40 bg-green-500/5",degraded:"border-yellow-500/40 bg-yellow-500/5",restricted:"border-orange-500/40 bg-orange-500/5",blocked:"border-red-500/40 bg-red-500/5",unknown:"border-zinc-700 bg-zinc-900" };

  return (<div className="min-h-screen bg-zinc-950 text-white"><UthNav />
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-6"><div className="p-2 rounded-lg bg-green-500/15"><Smartphone className="w-5 h-5 text-green-400" /></div><div><h1 className="text-2xl font-black text-white">Device Attestation</h1><p className="text-zinc-400 text-sm">18 signals · 5 status states: healthy / degraded / restricted / blocked / unknown</p></div></div>
      <div className="flex gap-2 mb-6">{Object.entries(PRESETS).map(([k,p])=>(<button key={k} onClick={()=>applyPreset(k as keyof typeof PRESETS)} className="text-xs border border-zinc-700 hover:border-indigo-500 text-zinc-400 hover:text-white rounded-lg px-3 py-1.5 transition-colors">{p.label}</button>))}</div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="text-white text-sm font-semibold mb-3">Platform</h3>
            <div className="flex gap-2">{["ios","android","web","windows"].map(p=>(<button key={p} onClick={()=>setPlatform(p)} className={`flex-1 text-xs rounded-lg py-1.5 capitalize transition-colors ${platform===p?"bg-indigo-600 text-white":"bg-zinc-800 text-zinc-400 hover:text-white"}`}>{p}</button>))}</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="text-white text-sm font-semibold mb-3">Signals ({activeSignals.length}/{ALL_SIGNALS.length})</h3>
            <div className="space-y-1 max-h-80 overflow-y-auto">{ALL_SIGNALS.map(s=>(<label key={s.code} className="flex items-center justify-between gap-2 py-1 cursor-pointer group"><div className="flex items-center gap-1.5"><input type="checkbox" checked={activeSignals.includes(s.code)} onChange={()=>toggleSignal(s.code)} className="accent-indigo-500"/><span className="text-zinc-400 text-xs group-hover:text-white">{s.label}</span></div><span className={`text-xs font-mono ${s.risk?"text-red-400":"text-green-400"}`}>{s.risk?"+":""}{s.weight}</span></label>))}</div>
          </div>
          <Button onClick={evaluate} className="w-full bg-indigo-600 hover:bg-indigo-700 h-11">Evaluate Device →</Button>
        </div>
        <div className="lg:col-span-2 space-y-4">
          {result ? (<>
            <div className={`rounded-xl border p-5 ${statusBg[result.status]||statusBg.unknown}`}>
              <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-white">Attestation Result</h3><span className={`text-xl font-black uppercase ${statusColor[result.status]||"text-zinc-400"}`}>{result.status}</span></div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-zinc-900 rounded-lg p-3 text-center"><p className="text-zinc-500 text-xs mb-1">Trust Score</p><p className="text-white font-bold text-lg">{result.trustScore}</p></div>
                <div className="bg-zinc-900 rounded-lg p-3 text-center"><p className="text-zinc-500 text-xs mb-1">DBA</p><p className={`font-bold text-sm ${result.dba==="allowed"?"text-green-400":result.dba==="restricted"?"text-yellow-400":"text-red-400"}`}>{result.dba}</p></div>
              </div>
              {result.signals.triggeredWithDescriptions.length > 0 && (<div className="mb-3">
                <p className="text-zinc-500 text-xs mb-2 uppercase tracking-wide">Risk signals triggered</p>
                <div className="space-y-1">{result.signals.triggeredWithDescriptions.map(s=>(<div key={s.code} className="flex items-start gap-2"><Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-xs shrink-0">{s.code}</Badge><span className="text-zinc-400 text-xs">{s.description}</span></div>))}</div>
              </div>)}
              {result.signals.passed.length > 0 && (<div className="mb-3">
                <p className="text-zinc-500 text-xs mb-2 uppercase tracking-wide">Good signals active</p>
                <div className="flex flex-wrap gap-1">{result.signals.passed.map(c=>(<Badge key={c} className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">{c}</Badge>))}</div>
              </div>)}
              {result.recommendation && <div className="bg-zinc-900 rounded-lg p-3 text-xs text-zinc-400">{result.recommendation}</div>}
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-mono text-xs text-zinc-400 overflow-auto max-h-48"><pre>{JSON.stringify(result, null, 2)}</pre></div>
          </>) : (<div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-12 text-center"><Shield className="w-8 h-8 text-zinc-700 mx-auto mb-3"/><p className="text-zinc-500">Select signals and click Evaluate</p></div>)}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><h3 className="text-white text-xs font-semibold mb-3 uppercase tracking-wide">Status Model</h3><div className="space-y-2">{[["healthy","All critical checks pass, no risk signals","green"],["degraded","Minor risk signals, core checks pass","yellow"],["restricted","Significant risk signals, limited access","orange"],["blocked","Critical signals, deny access immediately","red"],["unknown","Insufficient signals to evaluate","zinc"]].map(([s,d,c])=>(<div key={s} className="flex items-start gap-2 text-xs"><span className={`font-bold uppercase w-20 shrink-0 text-${c}-400`}>{s}</span><span className="text-zinc-500">{d}</span></div>))}</div></div>
        </div>
      </div>
    </div>
  </div>);
}
