"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings, Save, Clock, Shield, Smartphone, Activity, Key, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function DashNav({ user }: { user: any }) {
  return (<nav className="border-b border-zinc-800 px-6 py-3 flex items-center gap-4 bg-zinc-950 sticky top-0 z-40">
    <Link href="/" className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center"><span className="font-black text-white text-[10px]">UTH</span></div><span className="font-black text-sm tracking-tighter"><span className="text-indigo-400">U</span><span className="text-indigo-300">T</span><span className="text-indigo-200">H</span></span></Link>
    <span className="text-zinc-600">/</span><Link href="/dashboard" className="text-zinc-500 hover:text-white text-sm">Dashboard</Link>
    <span className="text-zinc-600">/</span><span className="text-zinc-400 text-sm">Tenant Settings</span>
    <div className="ml-auto text-xs text-zinc-500">{user?.email}</div>
  </nav>);
}

const ALL_CLAIMS = ["sub","email","tid","sid","did","dfp","amr","acr","risk","risk_lvl","sca","sca_method","sca_ts","ttype","roles","iat","exp","iss"];
const CLAIM_DESCRIPTIONS: Record<string,string> = { sub:"User ID",email:"Email address",tid:"Tenant ID",sid:"Session ID",did:"Device ID",dfp:"Device fingerprint",amr:"Auth methods ref",acr:"Auth context ref",risk:"Risk score (0–100)",risk_lvl:"Risk level (low/medium/high/critical)",sca:"SCA completed",sca_method:"SCA method used",sca_ts:"SCA timestamp",ttype:"Token type (access/refresh)",roles:"User roles",iat:"Issued at",exp:"Expiry",iss:"Issuer" };
const ALL_ATTESTATION_SIGNALS = ["KD","DH","BIO","SLE","TPM","SEA","DEV","ROOT","EMU","DBG","HOOK","INT","VPN","TOR","GEO","IPR","ASN","OS"];
const ATTESTATION_LABELS: Record<string,string> = { KD:"Known Device",DH:"Device Healthy",BIO:"Biometric Auth",SLE:"Screen Lock",TPM:"TPM Present",SEA:"Secure Enclave",DEV:"Developer Mode",ROOT:"Rooted/Jailbroken",EMU:"Emulator/VM",DBG:"Debug Build",HOOK:"Frida/Hook",INT:"App Integrity Fail",VPN:"VPN Active",TOR:"Tor Exit Node",GEO:"High-Risk Country",IPR:"IP Reputation",ASN:"ASN Residential",OS:"OS Up-to-date" };
const ALL_RISK_SIGNALS = ["knownDevice","deviceHealthy","biometricUsed","screenLockEnabled","developerMode","rootedDevice","vpnDetected","torExitNode","highRiskCountry","ipReputationClean","asnResidential"];
const RISK_LABELS: Record<string,string> = { knownDevice:"Known Device",deviceHealthy:"Device Healthy",biometricUsed:"Biometric Used",screenLockEnabled:"Screen Lock",developerMode:"Developer Mode",rootedDevice:"Rooted/Jailbroken",vpnDetected:"VPN Detected",torExitNode:"Tor Exit Node",highRiskCountry:"High-Risk Country",ipReputationClean:"IP Reputation Clean",asnResidential:"ASN Residential" };

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"jwt"|"device"|"attestation"|"risk">("jwt");

  useEffect(()=>{
    fetch("/api/auth/me").then(async r=>{ if(r.status===401){router.push("/login");return;} const d=await r.json(); setUser(d.user); });
    fetch("/api/admin/settings").then(r=>r.json()).then(d=>{ setSettings(d.settings); setLoading(false); });
  },[]);

  async function save() {
    setSaving(true);
    const r = await fetch("/api/admin/settings", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(settings) });
    const data = await r.json();
    if (data.success) toast.success("Settings saved"); else toast.error("Save failed");
    setSaving(false);
  }

  function setJwt(k: string, v: any) { setSettings((s:any)=>({...s,jwt:{...s.jwt,[k]:v}})); }
  function setDb(k: string, v: any) { setSettings((s:any)=>({...s,deviceBinding:{...s.deviceBinding,[k]:v}})); }
  function setAtt(k: string, v: any) { setSettings((s:any)=>({...s,attestation:{...s.attestation,[k]:v}})); }
  function setRisk(k: string, v: any) { setSettings((s:any)=>({...s,risk:{...s.risk,[k]:v}})); }

  function toggleClaim(claim: string) {
    const excl: string[] = settings.jwt.excludedClaims || [];
    setSettings((s:any)=>({...s,jwt:{...s.jwt,excludedClaims:excl.includes(claim)?excl.filter((c:string)=>c!==claim):[...excl,claim]}}));
  }
  function toggleAttSignal(sig: string) {
    const disabled: string[] = settings.attestation.disabledSignals || [];
    setSettings((s:any)=>({...s,attestation:{...s.attestation,disabledSignals:disabled.includes(sig)?disabled.filter((x:string)=>x!==sig):[...disabled,sig]}}));
  }
  function toggleRiskSignal(sig: string) {
    const disabled: string[] = settings.risk.disabledSignals || [];
    setSettings((s:any)=>({...s,risk:{...s.risk,disabledSignals:disabled.includes(sig)?disabled.filter((x:string)=>x!==sig):[...disabled,sig]}}));
  }

  if (loading||!settings) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 text-sm">Loading…</div>;

  const excl: string[] = settings.jwt.excludedClaims||[];
  const attDisabled: string[] = settings.attestation.disabledSignals||[];
  const riskDisabled: string[] = settings.risk.disabledSignals||[];

  const TABS = [{ id:"jwt",label:"JWT & Session",icon:Key },{ id:"device",label:"Device Binding",icon:Smartphone },{ id:"attestation",label:"Attestation Signals",icon:Shield },{ id:"risk",label:"Risk Signals",icon:Activity }];

  return (<div className="min-h-screen bg-zinc-950 text-white"><DashNav user={user}/>
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-zinc-800"><Settings className="w-5 h-5 text-zinc-300"/></div><div><h1 className="text-2xl font-black text-white">Tenant Settings</h1><p className="text-zinc-400 text-sm">Configure JWT claims, device binding, attestation and risk signals</p></div></div>
        <div className="flex gap-2"><Button onClick={()=>{setLoading(true);fetch("/api/admin/settings").then(r=>r.json()).then(d=>{setSettings(d.settings);setLoading(false);});}} variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white h-9"><RefreshCw className="w-4 h-4"/></Button><Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 h-9"><Save className="w-4 h-4 mr-1.5"/>{saving?"Saving…":"Save"}</Button></div>
      </div>

      <div className="flex gap-1 mb-6 border-b border-zinc-800">{TABS.map(t=>(<button key={t.id} onClick={()=>setTab(t.id as any)} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px ${tab===t.id?"border-indigo-500 text-white":"border-transparent text-zinc-500 hover:text-zinc-300"}`}><t.icon className="w-3.5 h-3.5"/>{t.label}</button>))}</div>

      {tab==="jwt" && (<div className="space-y-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
          <h3 className="text-white font-semibold flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-400"/>Token Lifetimes</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div><Label className="text-zinc-400 text-xs mb-1 block">Access token TTL (seconds)</Label><Input type="number" value={settings.jwt.accessTokenTtlSeconds} onChange={e=>setJwt("accessTokenTtlSeconds",Number(e.target.value))} className="bg-zinc-800 border-zinc-700 text-white font-mono"/><p className="text-zinc-600 text-[10px] mt-1">Default: 900 (15 min)</p></div>
            <div><Label className="text-zinc-400 text-xs mb-1 block">Refresh token TTL (seconds)</Label><Input type="number" value={settings.jwt.refreshTokenTtlSeconds} onChange={e=>setJwt("refreshTokenTtlSeconds",Number(e.target.value))} className="bg-zinc-800 border-zinc-700 text-white font-mono"/><p className="text-zinc-600 text-[10px] mt-1">Default: 2592000 (30 days)</p></div>
            <div><Label className="text-zinc-400 text-xs mb-1 block">Session rotation (seconds)</Label><Input type="number" value={settings.jwt.sessionRotationSeconds} onChange={e=>setJwt("sessionRotationSeconds",Number(e.target.value))} className="bg-zinc-800 border-zinc-700 text-white font-mono"/><p className="text-zinc-600 text-[10px] mt-1">Default: 86400 (24h)</p></div>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"><h3 className="text-white font-semibold mb-1">JWT Claims</h3><p className="text-zinc-500 text-xs mb-4">Toggle which claims are included in every access token your tenant issues. Always included: sub, iat, exp, iss.</p>
          <div className="grid sm:grid-cols-2 gap-2">{ALL_CLAIMS.filter(c=>!["sub","iat","exp","iss"].includes(c)).map(c=>{
            const excluded = excl.includes(c);
            return (<label key={c} className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${excluded?"border-zinc-800 opacity-50":"border-zinc-700 bg-zinc-800/40"}`}>
              <div><p className="text-zinc-200 text-xs font-mono">{c}</p><p className="text-zinc-500 text-[10px]">{CLAIM_DESCRIPTIONS[c]}</p></div>
              <button type="button" onClick={()=>toggleClaim(c)} className={`w-8 h-4.5 rounded-full transition-colors relative ${excluded?"bg-zinc-700":"bg-indigo-600"}`}><span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${excluded?"translate-x-0.5":"translate-x-[14px]"}`}/></button>
            </label>);
          })}</div>
        </div>
      </div>)}

      {tab==="device" && (<div className="space-y-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
          <h3 className="text-white font-semibold">Device Binding Configuration</h3>
          <div><Label className="text-zinc-400 text-xs mb-1 block">Max devices per user</Label><div className="flex items-center gap-3"><input type="range" min={1} max={10} value={settings.deviceBinding.maxDevicesPerUser} onChange={e=>setDb("maxDevicesPerUser",Number(e.target.value))} className="flex-1 accent-indigo-500"/><span className="text-white font-mono font-bold w-4">{settings.deviceBinding.maxDevicesPerUser}</span></div><p className="text-zinc-600 text-xs mt-1">Devices beyond this limit require revocation of an existing binding.</p></div>
          <div><Label className="text-zinc-400 text-xs mb-1 block">Silent login risk threshold (score ≤ X → skip re-auth)</Label><div className="flex items-center gap-3"><input type="range" min={0} max={50} value={settings.deviceBinding.riskThresholdForSilentLogin||25} onChange={e=>setDb("riskThresholdForSilentLogin",Number(e.target.value))} className="flex-1 accent-green-500"/><span className="text-white font-mono font-bold w-6">{settings.deviceBinding.riskThresholdForSilentLogin||25}</span></div></div>
          <div className="space-y-2">{[["requireAttestationForBinding","Require device attestation before binding"],["silentLoginIfRiskLow","Allow silent login for known low-risk devices"]].map(([k,label])=>(<label key={k} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50"><span className="text-zinc-300 text-sm">{label}</span><button type="button" onClick={()=>setDb(k,!settings.deviceBinding[k])} className={`w-9 h-5 rounded-full transition-colors relative ${settings.deviceBinding[k]?"bg-indigo-600":"bg-zinc-700"}`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.deviceBinding[k]?"translate-x-[18px]":"translate-x-0.5"}`}/></button></label>))}</div>
        </div>
      </div>)}

      {tab==="attestation" && (<div className="space-y-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h3 className="text-white font-semibold mb-1">Attestation Signals</h3><p className="text-zinc-500 text-xs mb-4">Disabled signals are ignored during device evaluation — useful if your use case doesn't support TPM or biometrics.</p>
          <div className="grid sm:grid-cols-2 gap-2">{ALL_ATTESTATION_SIGNALS.map(sig=>{
            const disabled = attDisabled.includes(sig);
            return (<label key={sig} className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${disabled?"border-zinc-800 opacity-40":"border-zinc-700 bg-zinc-800/40"}`}>
              <div><p className="text-zinc-200 text-xs font-mono">{sig}</p><p className="text-zinc-500 text-[10px]">{ATTESTATION_LABELS[sig]}</p></div>
              <button type="button" onClick={()=>toggleAttSignal(sig)} className={`w-8 h-4 rounded-full transition-colors relative ${disabled?"bg-zinc-700":"bg-indigo-600"}`}><span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${disabled?"translate-x-0.5":"translate-x-[16px]"}`}/></button>
            </label>);
          })}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><Label className="text-zinc-400 text-xs mb-2 block">Minimum accepted status</Label>
          <div className="flex gap-2">{["healthy","degraded","restricted"].map(s=>(<button key={s} onClick={()=>setAtt("minimumStatus",s)} className={`flex-1 text-xs rounded-lg py-2 capitalize transition-colors ${settings.attestation.minimumStatus===s?"bg-indigo-600 text-white":"bg-zinc-800 text-zinc-400 hover:text-white"}`}>{s}</button>))}</div>
        </div>
      </div>)}

      {tab==="risk" && (<div className="space-y-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h3 className="text-white font-semibold mb-1">Risk Engine Signals</h3><p className="text-zinc-500 text-xs mb-4">Disable signals that are not applicable to your platform (e.g. biometric is irrelevant for web-only tenants).</p>
          <div className="grid sm:grid-cols-2 gap-2">{ALL_RISK_SIGNALS.map(sig=>{
            const disabled = riskDisabled.includes(sig);
            return (<label key={sig} className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${disabled?"border-zinc-800 opacity-40":"border-zinc-700 bg-zinc-800/40"}`}>
              <div><p className="text-zinc-200 text-xs font-mono">{sig}</p><p className="text-zinc-500 text-[10px]">{RISK_LABELS[sig]}</p></div>
              <button type="button" onClick={()=>toggleRiskSignal(sig)} className={`w-8 h-4 rounded-full transition-colors relative ${disabled?"bg-zinc-700":"bg-indigo-600"}`}><span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${disabled?"translate-x-0.5":"translate-x-[16px]"}`}/></button>
            </label>);
          })}</div>
        </div>
      </div>)}
    </div>
  </div>);
}
