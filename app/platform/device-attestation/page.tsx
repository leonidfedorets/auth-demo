"use client";
import { useState } from "react";
import Link from "next/link";
import { Smartphone, Shield, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
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

const PRESETS = {
  healthy: { label: "Healthy iPhone", active: ["KD","DH","BIO","SLE","TPM","SEA","IPR","ASN","OS"], platform: "ios" },
  degraded: { label: "Degraded Android", active: ["KD","DH","SLE","DEV","VPN"], platform: "android" },
  restricted: { label: "Restricted (jailbroken)", active: ["KD","ROOT","INT","GEO"], platform: "ios" },
  blocked: { label: "Blocked (compromised)", active: ["ROOT","HOOK","INT","EMU","TOR"], platform: "android" },
};

export default function DeviceAttestationPage() {
  const [activeSignals, setActiveSignals] = useState<string[]>(["KD","DH","BIO","SLE","TPM","SEA","IPR","ASN","OS"]);
  const [platform, setPlatform] = useState("ios");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  function toggleSignal(code: string) {
    setActiveSignals(s => s.includes(code) ? s.filter(x=>x!==code) : [...s,code]);
  }
  function applyPreset(key: keyof typeof PRESETS) {
    setActiveSignals(PRESETS[key].active);
    setPlatform(PRESETS[key].platform);
  }

  async function evaluate() {
    setLoading(true);
    const signals = Object.fromEntries(ALL_SIGNALS.map(s => [s.code.toLowerCase(), activeSignals.includes(s.code)]));
    const r = await fetch("/api/device-attestation", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ signals, platform, deviceId: "test-device-"+Date.now() }) });
    const data = await r.json();
    setResult(data);
    setLoading(false);
  }

  const statusColor: Record<string,string> = { healthy:"text-green-400",degraded:"text-yellow-400",restricted:"text-orange-400",blocked:"text-red-400",unknown:"text-zinc-400" };
  const statusBg: Record<string,string> = { healthy:"border-green-500/40 bg-green-500/5",degraded:"border-yellow-500/40 bg-yellow-500/5",restricted:"border-orange-500/40 bg-orange-500/5",blocked:"border-red-500/40 bg-red-500/5",unknown:"border-zinc-700 bg-zinc-900" };

  return (<div className="min-h-screen bg-zinc-950 text-white"><UthNav />
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-6"><div className="p-2 rounded-lg bg-green-500/15"><Smartphone className="w-5 h-5 text-green-400" /></div><div><h1 className="text-2xl font-black text-white">Device Attestation</h1><p className="text-zinc-400 text-sm">18 signals · 5 status states: healthy / degraded / restricted / blocked / unknown</p></div></div>
      <div className="flex gap-2 mb-6">{Object.entries(PRESETS).map(([k,p])=>(<button key={k} onClick={()=>applyPreset(k as any)} className="text-xs border border-zinc-700 hover:border-indigo-500 text-zinc-400 hover:text-white rounded-lg px-3 py-1.5 transition-colors">{p.label}</button>))}</div>
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
          <Button onClick={evaluate} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 h-11">{loading?"Evaluating…":"Evaluate Device →"}</Button>
        </div>
        <div className="lg:col-span-2 space-y-4">
          {result ? (<>
            <div className={`rounded-xl border p-5 ${statusBg[result.status]||statusBg.unknown}`}>
              <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-white">Attestation Result</h3><span className={`text-xl font-black uppercase ${statusColor[result.status]||"text-zinc-400"}`}>{result.status}</span></div>
              <div className="grid grid-cols-2 gap-3 mb-4"><div className="bg-zinc-900 rounded-lg p-3 text-center"><p className="text-zinc-500 text-xs mb-1">Trust Score</p><p className="text-white font-bold text-lg">{result.trustScore ?? result.score ?? "—"}</p></div><div className="bg-zinc-900 rounded-lg p-3 text-center"><p className="text-zinc-500 text-xs mb-1">DBA</p><p className={`font-bold text-sm ${result.dba==="allowed"?"text-green-400":result.dba==="restricted"?"text-yellow-400":"text-red-400"}`}>{result.dba}</p></div></div>
              {result.signals?.triggered?.length>0 && (<div className="mb-3"><p className="text-zinc-500 text-xs mb-2 uppercase tracking-wide">Risk signals triggered</p><div className="flex flex-wrap gap-1">{result.signals.triggered.map((s:string)=>(<Badge key={s} className="bg-red-500/20 text-red-300 border-red-500/30 text-xs">{s}</Badge>))}</div></div>)}
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
