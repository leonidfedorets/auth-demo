"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sliders, Save, RefreshCw, Shield, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { DashNav } from "@/components/dash-nav";

const SIM_SIGNALS = [
  { key: "knownDevice",       label: "Unknown device",         risk: false, weight: 35, help: "Device not previously seen" },
  { key: "deviceHealthy",     label: "Unhealthy device",       risk: false, weight: 25, help: "Device integrity check failed" },
  { key: "rootedDevice",      label: "Rooted / jailbroken",    risk: true,  weight: 35, help: "OS integrity compromised" },
  { key: "torExitNode",       label: "Tor exit node",          risk: true,  weight: 30, help: "Connection from Tor network" },
  { key: "developerMode",     label: "Developer mode on",      risk: true,  weight: 20, help: "Device is in debug mode" },
  { key: "highRiskCountry",   label: "High-risk country",      risk: true,  weight: 20, help: "Transaction origin flagged" },
  { key: "biometricUsed",     label: "No biometric auth",      risk: false, weight: 15, help: "Biometric not used" },
  { key: "screenLockEnabled", label: "No screen lock",         risk: false, weight: 10, help: "Device screen lock disabled" },
  { key: "vpnDetected",       label: "VPN active",             risk: true,  weight: 10, help: "Traffic through VPN" },
  { key: "ipReputationClean", label: "Bad IP reputation",      risk: false, weight: 10, help: "IP flagged by threat intel" },
  { key: "asnResidential",    label: "Non-residential ASN",    risk: false, weight: 5,  help: "Data-center ASN detected" },
];

function computeSimScore(sigs: Record<string, boolean>): number {
  let score = 0;
  if (sigs.knownDevice === true)         score += 35;
  if (sigs.deviceHealthy === true)       score += 25;
  if (sigs.rootedDevice === true)        score += 35;
  if (sigs.torExitNode === true)         score += 30;
  if (sigs.developerMode === true)       score += 20;
  if (sigs.highRiskCountry === true)     score += 20;
  if (sigs.biometricUsed === true)       score += 15;
  if (sigs.screenLockEnabled === true)   score += 10;
  if (sigs.vpnDetected === true)         score += 10;
  if (sigs.ipReputationClean === true)   score += 10;
  if (sigs.asnResidential === true)      score += 5;
  return Math.min(100, score);
}

export default function RiskRulesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rules, setRules] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // sim: each key=true means "risk signal active" (toggled ON in UI)
  const [sim, setSim] = useState<Record<string, boolean>>({});

  useEffect(()=>{
    fetch("/api/auth/me").then(async r=>{ if(r.status===401){router.push("/login");return;} const d=await r.json(); setUser(d.user); });
    fetch("/api/admin/risk-rules").then(r=>r.json()).then(d=>{ setRules(d.rules); setLoading(false); });
  },[]);

  async function save() {
    setSaving(true);
    const r = await fetch("/api/admin/risk-rules", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(rules) });
    const data = await r.json();
    if (data.success) toast.success("Risk rules saved"); else toast.error("Save failed");
    setSaving(false);
  }

  function setThreshold(k: string, v: number) { setRules((r:any)=>({...r,thresholds:{...r.thresholds,[k]:v}})); }
  function toggleOverride(id:string) { setRules((r:any)=>({...r,overrides:r.overrides.map((o:any)=>o.id===id?{...o,enabled:!o.enabled}:o)})); }
  function toggleDa(k:string) { setRules((r:any)=>({...r,deviceAttestation:{...r.deviceAttestation,[k]:!r.deviceAttestation[k]}})); }
  function setDaMin(v:string) { setRules((r:any)=>({...r,deviceAttestation:{...r.deviceAttestation,minimumStatus:v}})); }

  if (loading||!rules) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 text-sm">Loading…</div>;

  return (<div className="min-h-screen bg-zinc-950 text-white"><DashNav user={user}/>
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-yellow-500/15"><Sliders className="w-5 h-5 text-yellow-400"/></div><div><h1 className="text-2xl font-black text-white">Risk Rules</h1><p className="text-zinc-400 text-sm">Tenant-level risk engine configuration</p></div></div>
        <div className="flex gap-2"><Button onClick={()=>{setLoading(true);fetch("/api/admin/risk-rules").then(r=>r.json()).then(d=>{setRules(d.rules);setLoading(false);});}} variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white h-9"><RefreshCw className="w-4 h-4"/></Button><Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 h-9"><Save className="w-4 h-4 mr-1.5"/>{saving?"Saving…":"Save changes"}</Button></div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Thresholds */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
          <h3 className="text-white font-semibold">Risk Score Thresholds</h3>
          <p className="text-zinc-500 text-xs">Adjust at what score each risk level is assigned.</p>
          {[["low","Low → Medium boundary"],["medium","Medium → High boundary"],["high","High → Critical boundary"]].map(([k,desc])=>(<div key={k}><Label className="text-zinc-400 text-xs capitalize mb-1 block">{k} threshold (current: {rules.thresholds[k]})</Label><div className="flex items-center gap-3"><input type="range" min={0} max={100} value={rules.thresholds[k]} onChange={e=>setThreshold(k,Number(e.target.value))} className="flex-1 accent-indigo-500"/><span className="text-white font-mono text-sm w-8 text-right">{rules.thresholds[k]}</span></div><p className="text-zinc-600 text-[10px] mt-0.5">{desc}</p></div>))}
          <div className="border-t border-zinc-800 pt-3 space-y-2">
            <div><Label className="text-zinc-400 text-xs mb-1 block">Step-up SCA threshold</Label><div className="flex items-center gap-3"><input type="range" min={0} max={100} value={rules.stepUpThreshold} onChange={e=>setRules((r:any)=>({...r,stepUpThreshold:Number(e.target.value)}))} className="flex-1 accent-yellow-500"/><span className="text-white font-mono text-sm w-8 text-right">{rules.stepUpThreshold}</span></div></div>
            <div><Label className="text-zinc-400 text-xs mb-1 block">Deny threshold</Label><div className="flex items-center gap-3"><input type="range" min={0} max={100} value={rules.denyThreshold} onChange={e=>setRules((r:any)=>({...r,denyThreshold:Number(e.target.value)}))} className="flex-1 accent-red-500"/><span className="text-white font-mono text-sm w-8 text-right">{rules.denyThreshold}</span></div></div>
          </div>
        </div>

        {/* Override rules */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
          <h3 className="text-white font-semibold">Override Rules</h3>
          <p className="text-zinc-500 text-xs">Rules applied before the score threshold — highest priority.</p>
          <div className="space-y-2">{rules.overrides.map((o:any)=>(<div key={o.id} className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-zinc-800/50">
            <div><div className="flex items-center gap-2"><Badge variant="outline" className="text-[10px] border-zinc-600 text-zinc-400">Rule {o.id}</Badge><span className="text-zinc-300 text-xs">{o.name}</span></div><p className="text-zinc-600 text-[10px] mt-0.5 font-mono">{o.action}</p></div>
            <button onClick={()=>toggleOverride(o.id)} className={`w-9 h-5 rounded-full transition-colors relative ${o.enabled?"bg-indigo-600":"bg-zinc-700"}`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${o.enabled?"translate-x-[18px]":"translate-x-0.5"}`}/></button>
          </div>))}</div>
        </div>

        {/* Device Attestation settings */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4 md:col-span-2">
          <h3 className="text-white font-semibold flex items-center gap-2"><Shield className="w-4 h-4 text-green-400"/>Device Attestation Settings</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-3">{[["requiredForPayments","Require attestation for payments"],["blockRooted","Block rooted/jailbroken devices"],["blockEmulator","Block emulator/VM"],["blockDebug","Block debug builds"]].map(([k,label])=>(<label key={k} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-zinc-800/50"><span className="text-zinc-300 text-xs">{label}</span><button type="button" onClick={()=>toggleDa(k)} className={`w-9 h-5 rounded-full transition-colors relative ${rules.deviceAttestation[k]?"bg-indigo-600":"bg-zinc-700"}`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${rules.deviceAttestation[k]?"translate-x-[18px]":"translate-x-0.5"}`}/></button></label>))}</div>
            <div><Label className="text-zinc-400 text-xs mb-2 block">Minimum accepted device status</Label>
              <div className="space-y-1">{["healthy","degraded","restricted"].map(s=>(<label key={s} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-colors capitalize text-sm ${rules.deviceAttestation.minimumStatus===s?"border-indigo-500 bg-indigo-500/10 text-white":"border-zinc-800 text-zinc-400 hover:border-zinc-600"}`}><input type="radio" name="minStatus" value={s} checked={rules.deviceAttestation.minimumStatus===s} onChange={()=>setDaMin(s)} className="accent-indigo-500"/>{s}</label>))}</div>
            </div>
          </div>
        </div>

        {/* Risk Simulation Panel */}
        <SimPanel rules={rules} sim={sim} setSim={setSim} />
      </div>
    </div>
  </div>);
}

function SimPanel({ rules, sim, setSim }: { rules: any; sim: Record<string, boolean>; setSim: React.Dispatch<React.SetStateAction<Record<string, boolean>>> }) {
  const score = computeSimScore(sim);
  const deny = rules.denyThreshold ?? 75;
  const stepUp = rules.stepUpThreshold ?? 40;

  let decision = "ALLOW";
  if (sim.torExitNode || sim.rootedDevice) decision = "DENY";
  else if (score >= deny) decision = "DENY";
  else if (score >= stepUp) decision = "STEP_UP";

  let level = "low";
  if (score > 75) level = "critical";
  else if (score > 50) level = "high";
  else if (score > 25) level = "medium";

  const barColor = decision === "DENY" ? "bg-red-500" : decision === "STEP_UP" ? "bg-yellow-500" : "bg-green-500";
  const decisionColor = decision === "DENY" ? "text-red-400 bg-red-500/10 border-red-500/30" : decision === "STEP_UP" ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" : "text-green-400 bg-green-500/10 border-green-500/30";

  const activeCount = Object.values(sim).filter(Boolean).length;

  return (
    <div className="rounded-xl border border-indigo-500/30 bg-zinc-900 p-5 space-y-5 md:col-span-2">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-indigo-400"/>
          Risk Simulation
          <span className="text-zinc-600 font-normal text-xs">— toggle signals to preview score &amp; decision</span>
        </h3>
        {activeCount > 0 && (
          <button onClick={() => setSim({})} className="text-xs text-zinc-500 hover:text-white transition-colors cursor-pointer">
            Clear all
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {SIM_SIGNALS.map(({ key, label, weight, help }) => {
          const active = !!sim[key];
          return (
            <button
              key={key}
              onClick={() => setSim(s => ({ ...s, [key]: !s[key] }))}
              className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                active
                  ? "border-red-500/50 bg-red-500/10"
                  : "border-zinc-800 bg-zinc-800/30 hover:border-zinc-600"
              }`}
            >
              <div>
                <div className={`text-xs font-medium ${active ? "text-red-300" : "text-zinc-400"}`}>{label}</div>
                <div className="text-[10px] text-zinc-600 mt-0.5">{help}</div>
              </div>
              <div className={`text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded ${active ? "bg-red-500/20 text-red-400" : "bg-zinc-800 text-zinc-500"}`}>
                +{weight}
              </div>
            </button>
          );
        })}
      </div>

      {/* Live result */}
      <div className="border-t border-zinc-800 pt-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1 w-full">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-zinc-500 text-xs">Risk score</span>
            <span className="text-white font-bold font-mono text-lg">{score}</span>
          </div>
          <div className="h-2.5 rounded-full bg-zinc-800 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${score}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-zinc-700 mt-1">
            <span>0</span>
            <span className="text-yellow-700">SCA@{stepUp}</span>
            <span className="text-red-700">DENY@{deny}</span>
            <span>100</span>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:shrink-0">
          <div className="text-center">
            <div className="text-zinc-500 text-[10px] mb-1">Level</div>
            <span className="text-xs capitalize font-semibold text-zinc-300">{level}</span>
          </div>
          <div className={`px-4 py-2 rounded-lg border text-sm font-bold tracking-wide ${decisionColor}`}>
            {decision}
          </div>
        </div>
      </div>
      {(sim.torExitNode || sim.rootedDevice) && (
        <p className="text-[10px] text-red-500/70">Override rule active — decision is DENY regardless of score threshold.</p>
      )}
    </div>
  );
}
