"use client";
import { useState } from "react";
import Link from "next/link";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function UthNav() {
  return (<nav className="border-b border-zinc-800 px-6 py-3 flex items-center gap-4 bg-zinc-950"><Link href="/" className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center"><span className="font-black text-white text-[10px]">UTH</span></div><span className="font-black text-sm tracking-tighter"><span className="text-indigo-400">U</span><span className="text-indigo-300">T</span><span className="text-indigo-200">H</span></span></Link><span className="text-zinc-600">/</span><span className="text-zinc-400 text-sm">Engine Risk</span><div className="ml-auto flex gap-3"><Link href="/platform/risk-engine" className="text-zinc-500 hover:text-white text-xs">Auth Risk</Link><Link href="/platform/sca" className="text-zinc-500 hover:text-white text-xs">SCA</Link><Link href="/dashboard" className="text-zinc-500 hover:text-white text-xs">Dashboard</Link></div></nav>);
}

const LAYER_DEFAULTS = {
  failedLoginsLast24h: 0,
  accountAgeDays: 180,
  passwordBreached: false,
  mfaEnabled: true,
  sessionDurationMinutes: 12,
  concurrentSessions: 1,
  geoVelocityKmH: 0,
  operationType: "payment",
  operationAmountEur: 150,
  scaMethod: "totp",
  scaChallengesLast7d: 1,
};

function computeEngineRisk(params: typeof LAYER_DEFAULTS, authScore: number) {
  // Layer 1: Account Integrity
  let l1 = 0;
  if (params.failedLoginsLast24h >= 5) l1 += 30;
  else if (params.failedLoginsLast24h >= 3) l1 += 20;
  else if (params.failedLoginsLast24h >= 1) l1 += 10;
  if (params.accountAgeDays < 7) l1 += 25;
  else if (params.accountAgeDays < 30) l1 += 15;
  else if (params.accountAgeDays < 90) l1 += 5;
  if (params.passwordBreached) l1 += 30;
  if (!params.mfaEnabled) l1 += 15;
  l1 = Math.min(100, l1);

  // Layer 2: Session / Behavior
  let l2 = 0;
  const hour = new Date().getHours();
  if (hour < 6 || hour > 22) l2 += 15; // unusual_hour
  if (params.concurrentSessions > 3) l2 += 25;
  else if (params.concurrentSessions > 1) l2 += 10;
  if (params.geoVelocityKmH > 900) l2 += 40; // impossible_travel
  else if (params.geoVelocityKmH > 200) l2 += 20;
  if (params.sessionDurationMinutes < 1) l2 += 10; // rapid_requests / very short session
  l2 = Math.min(100, l2);

  // Layer 3: Operation Risk
  let l3 = 0;
  if (params.operationAmountEur > 10000) l3 += 30;
  else if (params.operationAmountEur > 1000) l3 += 20;
  else if (params.operationAmountEur > 100) l3 += 8;
  if (params.operationType === "account_change") l3 += 20;
  if (params.operationType === "data_export") l3 += 25;
  // new_payee / mismatch_currency treated as built into operation type
  l3 = Math.min(100, l3);

  // Layer 4: SCA Quality
  let l4 = 0;
  if (params.scaMethod === "email_otp") l4 += 20; // sca_method_weak
  else if (params.scaMethod === "push") l4 += 10;
  if (params.scaChallengesLast7d === 0) l4 += 30; // no_sca_completed
  else if (params.scaChallengesLast7d < 3) l4 += 10;
  l4 = Math.min(100, l4);

  // Engine Risk Score = average of 4 layers
  const engineRiskScore = Math.round((l1 + l2 + l3 + l4) / 4);

  // Final Risk Score = 50/50 consolidation with Auth Risk
  const finalRiskScore = Math.round((authScore * 0.5) + (engineRiskScore * 0.5));

  let decision = "ALLOW";
  let overrideApplied: string | null = null;
  if (finalRiskScore > 75) { decision = "DENY"; }
  else if (finalRiskScore > 50) { decision = "STEP_UP + notify"; overrideApplied = "High risk threshold exceeded — SCA + user notification"; }
  else if (finalRiskScore > 25) { decision = "STEP_UP"; }

  return {
    finalRiskScore,
    engineRiskScore,
    authRiskScore: authScore,
    decision,
    layers: {
      account_integrity: l1,
      session_behavior: l2,
      operation_risk: l3,
      sca_quality: l4,
    },
    layerDetails: {
      "Layer 1 — Account Integrity": l1,
      "Layer 2 — Session/Behavior": l2,
      "Layer 3 — Operation Risk": l3,
      "Layer 4 — SCA Quality": l4,
    },
    overrideApplied,
    formula: `round((${authScore} × 0.5) + (${engineRiskScore} × 0.5)) = ${finalRiskScore}`,
    evaluatedAt: new Date().toISOString(),
  };
}

export default function EngineRiskPage() {
  const [params, setParams] = useState(LAYER_DEFAULTS);
  const [authScore, setAuthScore] = useState(10);
  const [result, setResult] = useState<ReturnType<typeof computeEngineRisk> | null>(null);

  function set(k: string, v: unknown) { setParams(p => ({...p,[k]:v})); }

  function evaluate() {
    setResult(computeEngineRisk(params, authScore));
  }

  const decisionColor = (d: string) => d === "ALLOW" ? "text-green-400" : d.startsWith("STEP_UP") ? "text-yellow-400" : "text-red-400";

  return (<div className="min-h-screen bg-zinc-950 text-white"><UthNav />
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-8"><div className="p-2 rounded-lg bg-purple-500/15"><Layers className="w-5 h-5 text-purple-400" /></div><div><h1 className="text-2xl font-black text-white">Engine Risk</h1><p className="text-zinc-400 text-sm">4 layers × 50/50 consolidation — FinalRiskScore = round((AuthRiskScore × 0.5) + (EngineRiskScore × 0.5))</p></div></div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <h3 className="text-white text-sm font-semibold">Auth Risk Score (input)</h3>
            <div><Label className="text-zinc-400 text-xs mb-1 block">AuthRiskScore (0–100)</Label><Input type="number" min={0} max={100} value={authScore} onChange={e=>setAuthScore(Number(e.target.value))} className="bg-zinc-800 border-zinc-700 text-white font-mono" /></div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <h3 className="text-white text-sm font-semibold">Layer 1 — Account Integrity</h3>
            <div><Label className="text-zinc-400 text-xs mb-1 block">Failed logins (24h)</Label><Input type="number" min={0} value={params.failedLoginsLast24h} onChange={e=>set("failedLoginsLast24h",Number(e.target.value))} className="bg-zinc-800 border-zinc-700 text-white font-mono" /></div>
            <div><Label className="text-zinc-400 text-xs mb-1 block">Account age (days)</Label><Input type="number" min={0} value={params.accountAgeDays} onChange={e=>set("accountAgeDays",Number(e.target.value))} className="bg-zinc-800 border-zinc-700 text-white font-mono" /></div>
            <label className="flex items-center justify-between"><span className="text-zinc-400 text-xs">Password breached</span><button type="button" onClick={()=>set("passwordBreached",!params.passwordBreached)} className={`w-9 h-5 rounded-full transition-colors relative ${params.passwordBreached?"bg-red-600":"bg-zinc-700"}`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${params.passwordBreached?"translate-x-[18px]":"translate-x-0.5"}`}/></button></label>
            <label className="flex items-center justify-between"><span className="text-zinc-400 text-xs">MFA enabled</span><button type="button" onClick={()=>set("mfaEnabled",!params.mfaEnabled)} className={`w-9 h-5 rounded-full transition-colors relative ${params.mfaEnabled?"bg-indigo-600":"bg-zinc-700"}`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${params.mfaEnabled?"translate-x-[18px]":"translate-x-0.5"}`}/></button></label>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <h3 className="text-white text-sm font-semibold">Layer 2 — Session / Behavior</h3>
            <div><Label className="text-zinc-400 text-xs mb-1 block">Session duration (min)</Label><Input type="number" min={0} value={params.sessionDurationMinutes} onChange={e=>set("sessionDurationMinutes",Number(e.target.value))} className="bg-zinc-800 border-zinc-700 text-white font-mono" /></div>
            <div><Label className="text-zinc-400 text-xs mb-1 block">Concurrent sessions</Label><Input type="number" min={1} value={params.concurrentSessions} onChange={e=>set("concurrentSessions",Number(e.target.value))} className="bg-zinc-800 border-zinc-700 text-white font-mono" /></div>
            <div><Label className="text-zinc-400 text-xs mb-1 block">Geo velocity (km/h)</Label><Input type="number" min={0} value={params.geoVelocityKmH} onChange={e=>set("geoVelocityKmH",Number(e.target.value))} className="bg-zinc-800 border-zinc-700 text-white font-mono" /></div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <h3 className="text-white text-sm font-semibold">Layer 3 — Operation Risk</h3>
            <div><Label className="text-zinc-400 text-xs mb-1 block">Operation type</Label><select value={params.operationType} onChange={e=>set("operationType",e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-md px-3 py-2 text-sm"><option value="payment">Payment</option><option value="account_change">Account change</option><option value="login">Login</option><option value="data_export">Data export</option></select></div>
            <div><Label className="text-zinc-400 text-xs mb-1 block">Amount (EUR)</Label><Input type="number" min={0} value={params.operationAmountEur} onChange={e=>set("operationAmountEur",Number(e.target.value))} className="bg-zinc-800 border-zinc-700 text-white font-mono" /></div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <h3 className="text-white text-sm font-semibold">Layer 4 — SCA Quality</h3>
            <div><Label className="text-zinc-400 text-xs mb-1 block">SCA method</Label><select value={params.scaMethod} onChange={e=>set("scaMethod",e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-md px-3 py-2 text-sm"><option value="webauthn">WebAuthn (strongest)</option><option value="totp">TOTP</option><option value="push">Push</option><option value="email_otp">Email OTP (weakest)</option></select></div>
            <div><Label className="text-zinc-400 text-xs mb-1 block">SCA challenges completed (7d)</Label><Input type="number" min={0} value={params.scaChallengesLast7d} onChange={e=>set("scaChallengesLast7d",Number(e.target.value))} className="bg-zinc-800 border-zinc-700 text-white font-mono" /></div>
          </div>
          <Button onClick={evaluate} className="w-full bg-indigo-600 hover:bg-indigo-700 h-11">Evaluate Engine Risk →</Button>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {result ? (<>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-white">Consolidated Score</h3><div className="text-right"><div className="text-3xl font-black text-white">{result.finalRiskScore}</div><div className="text-zinc-500 text-xs">FinalRiskScore</div></div></div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-zinc-800 rounded-lg p-3 text-center"><p className="text-zinc-500 text-xs mb-1">Auth Risk</p><p className="text-indigo-300 font-bold">{result.authRiskScore}</p></div>
                <div className="bg-zinc-800 rounded-lg p-3 text-center"><p className="text-zinc-500 text-xs mb-1">Engine Risk</p><p className="text-purple-300 font-bold">{result.engineRiskScore}</p></div>
                <div className="bg-zinc-800 rounded-lg p-3 text-center"><p className="text-zinc-500 text-xs mb-1">Decision</p><p className={`font-bold text-sm ${decisionColor(result.decision)}`}>{result.decision}</p></div>
              </div>
              <div className="space-y-2">
                {Object.entries(result.layerDetails).map(([layer,score])=>(<div key={layer} className="flex items-center justify-between text-xs bg-zinc-800 rounded px-3 py-2"><span className="text-zinc-400">{layer}</span><span className="font-mono text-white">{String(score)}</span></div>))}
              </div>
              <div className="mt-3 bg-zinc-800 rounded-lg p-3 font-mono text-xs text-indigo-300 text-center">{result.formula}</div>
              {result.overrideApplied && <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-300">Override: {result.overrideApplied}</div>}
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-mono text-xs text-zinc-400 overflow-auto max-h-56"><pre>{JSON.stringify(result, null, 2)}</pre></div>
          </>) : (<div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-12 text-center"><Layers className="w-8 h-8 text-zinc-700 mx-auto mb-3"/><p className="text-zinc-500">Configure parameters and click Evaluate</p></div>)}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><h3 className="text-white text-xs font-semibold mb-3 uppercase tracking-wide">50/50 Consolidation Formula</h3><div className="bg-zinc-800 rounded-lg p-3 font-mono text-xs text-indigo-300 text-center">FinalRiskScore = round((AuthRiskScore × 0.5) + (EngineRiskScore × 0.5))</div><div className="mt-3 grid grid-cols-2 gap-2 text-xs">{[["≤ 25","ALLOW — proceed"],["26–50","STEP_UP — trigger SCA"],["51–75","STEP_UP + notify"],["76–100","DENY + lock"]].map(([r,d])=>(<div key={r} className="bg-zinc-800 rounded px-2 py-1.5"><span className="text-zinc-400 font-mono">{r}: </span><span className="text-zinc-300">{d}</span></div>))}</div></div>
        </div>
      </div>
    </div>
  </div>);
}
