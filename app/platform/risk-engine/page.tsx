"use client";
import { useState } from "react";
import Link from "next/link";
import { Activity, Shield, ChevronRight, Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

function UthNav() {
  return (<nav className="border-b border-zinc-800 px-6 py-3 flex items-center gap-4 bg-zinc-950"><Link href="/" className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center"><span className="font-black text-white text-[10px]">UTH</span></div><span className="font-black text-sm tracking-tighter"><span className="text-indigo-400">U</span><span className="text-indigo-300">T</span><span className="text-indigo-200">H</span></span></Link><span className="text-zinc-600">/</span><span className="text-zinc-400 text-sm">Auth Risk Engine</span><div className="ml-auto flex gap-3"><Link href="/platform/engine-risk" className="text-zinc-500 hover:text-white text-xs">Engine Risk</Link><Link href="/platform/device-attestation" className="text-zinc-500 hover:text-white text-xs">Attestation</Link><Link href="/dashboard" className="text-zinc-500 hover:text-white text-xs">Dashboard</Link></div></nav>);
}

const SIGNAL_DEFAULTS = { knownDevice: true, deviceHealthy: true, biometricUsed: false, screenLockEnabled: true, developerMode: false, rootedDevice: false, vpnDetected: false, torExitNode: false, highRiskCountry: false, ipReputationClean: true, asnResidential: true };
const SIGNAL_LABELS: Record<string, string> = { knownDevice:"Known device",deviceHealthy:"Device healthy",biometricUsed:"Biometric used",screenLockEnabled:"Screen lock enabled",developerMode:"Developer mode",rootedDevice:"Rooted/Jailbroken",vpnDetected:"VPN detected",torExitNode:"Tor exit node",highRiskCountry:"High-risk country",ipReputationClean:"IP reputation clean",asnResidential:"ASN residential" };

export default function RiskEnginePage() {
  const [signals, setSignals] = useState<Record<string,boolean>>(SIGNAL_DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [ip, setIp] = useState("195.12.50.10");

  async function evaluate() {
    setLoading(true);
    const r = await fetch("/api/auth-risk", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ signals, ip, userAgent: navigator.userAgent }) });
    const data = await r.json();
    setResult(data);
    setLoading(false);
  }

  const levelColor: Record<string,string> = { low:"text-green-400", medium:"text-yellow-400", high:"text-orange-400", critical:"text-red-400" };

  return (<div className="min-h-screen bg-zinc-950 text-white"><UthNav />
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-8"><div className="p-2 rounded-lg bg-yellow-500/15"><Activity className="w-5 h-5 text-yellow-400" /></div><div><h1 className="text-2xl font-black text-white">Auth Risk Engine</h1><p className="text-zinc-400 text-sm">Device Trust Layer (9 signals) + Network & Geo Layer — AuthRiskScore = min(100, DeviceTrust + NetworkGeo)</p></div></div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><h3 className="font-semibold text-white mb-3 text-sm">Device & Network Signals</h3>
            <div className="space-y-2">{Object.entries(signals).map(([k,v])=>(<label key={k} className="flex items-center justify-between gap-2 py-1 cursor-pointer group"><span className="text-zinc-400 text-xs group-hover:text-white">{SIGNAL_LABELS[k]}</span><button type="button" onClick={()=>setSignals(s=>({...s,[k]:!v}))} className={`w-9 h-5 rounded-full transition-colors relative ${v?"bg-indigo-600":"bg-zinc-700"}`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${v?"translate-x-[18px]":"translate-x-0.5"}`}/></button></label>))}</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><Label className="text-zinc-400 text-xs mb-1.5 block">Client IP</Label><Input value={ip} onChange={e=>setIp(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white font-mono text-sm" /></div>
          <Button onClick={evaluate} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 h-11">{loading?"Evaluating…":"Evaluate Risk →"}</Button>
        </div>
        <div className="lg:col-span-2 space-y-4">
          {result ? (<>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-white">Result</h3><span className={`text-2xl font-black ${levelColor[result.level]||"text-white"}`}>{result.score ?? result.authRiskScore ?? 0}</span></div>
              <div className="grid grid-cols-2 gap-3 mb-4"><div className="bg-zinc-800 rounded-lg p-3 text-center"><p className="text-zinc-500 text-xs mb-1">Risk Level</p><Badge className={`${result.level==="low"?"bg-green-500/20 text-green-300":result.level==="medium"?"bg-yellow-500/20 text-yellow-300":result.level==="high"?"bg-orange-500/20 text-orange-300":"bg-red-500/20 text-red-300"} border-0 text-sm`}>{result.level}</Badge></div><div className="bg-zinc-800 rounded-lg p-3 text-center"><p className="text-zinc-500 text-xs mb-1">Decision</p><p className="text-white font-bold text-sm">{result.decision}</p></div></div>
              {result.signals?.length>0 && (<div><p className="text-zinc-500 text-xs mb-2 uppercase tracking-wide">Triggered signals</p><div className="space-y-1">{result.signals.map((s:any)=>(<div key={s.name} className="flex justify-between text-xs bg-zinc-800 rounded px-3 py-1.5"><span className="text-zinc-300">{s.description||s.name}</span><span className="text-red-400 font-mono">+{s.score}</span></div>))}</div></div>)}
              {result.overrideApplied && <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-300">Override applied: {result.overrideApplied}</div>}
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-mono text-xs text-zinc-400 overflow-auto max-h-48"><pre>{JSON.stringify(result, null, 2)}</pre></div>
          </>) : (<div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-12 text-center"><Sliders className="w-8 h-8 text-zinc-700 mx-auto mb-3"/><p className="text-zinc-500">Adjust signals and click Evaluate</p></div>)}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><h3 className="text-white text-xs font-semibold mb-3 uppercase tracking-wide">Signal Weights (Device Trust Layer)</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">{[["known_device_match","−35"],["device_health_ok","−25"],["biometric_auth","−15"],["screen_lock_on","−10"],["developer_mode","＋20"],["root_jailbreak","＋35"],["vpn_active","＋10"],["tor_exit","＋30"],["high_risk_country","＋20"],["ip_reputation","−10"],["asn_residential","−5"]].map(([sig,w])=>(<div key={sig} className="flex justify-between bg-zinc-800 rounded px-2 py-1"><span className="text-zinc-400 font-mono">{sig}</span><span className={w.startsWith("+")||w.startsWith("＋")?"text-red-400":"text-green-400"}>{w}</span></div>))}</div>
          </div>
        </div>
      </div>
    </div>
  </div>);
}
