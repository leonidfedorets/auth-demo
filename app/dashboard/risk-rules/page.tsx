"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sliders, Save, RefreshCw, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function DashNav({ user }: { user: any }) {
  return (<nav className="border-b border-zinc-800 px-6 py-3 flex items-center gap-4 bg-zinc-950 sticky top-0 z-40">
    <Link href="/" className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center"><span className="font-black text-white text-[10px]">UTH</span></div><span className="font-black text-sm tracking-tighter"><span className="text-indigo-400">U</span><span className="text-indigo-300">T</span><span className="text-indigo-200">H</span></span></Link>
    <span className="text-zinc-600">/</span><Link href="/dashboard" className="text-zinc-500 hover:text-white text-sm">Dashboard</Link>
    <span className="text-zinc-600">/</span><span className="text-zinc-400 text-sm">Risk Rules</span>
    <div className="ml-auto text-xs text-zinc-500">{user?.email}</div>
  </nav>);
}

export default function RiskRulesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rules, setRules] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      </div>
    </div>
  </div>);
}
