"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, Save, Clock, Shield, Smartphone, Activity, Key, RefreshCw, Eye, EyeOff, Copy, KeyRound, LayoutGrid, Plus, Trash2, Edit2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { DashNav } from "@/components/dash-nav";

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
  const [tab, setTab] = useState<"jwt"|"device"|"attestation"|"risk"|"apikeys"|"apps">("jwt");
  const [apps, setApps] = useState<any[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [newAppForm, setNewAppForm] = useState(false);
  const [newAppName, setNewAppName] = useState("");
  const [newAppDesc, setNewAppDesc] = useState("");
  const [newAppSaving, setNewAppSaving] = useState(false);
  const [appNewKeys, setAppNewKeys] = useState<Record<string, string>>({});
  const [editingApp, setEditingApp] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [apiKeyData, setApiKeyData] = useState<{keyPrefix:string;keySuffix:string;keyMasked:string;createdAt:string;tid:string}|null>(null);
  const [apiKeyRevealed, setApiKeyRevealed] = useState(false);
  const [fullApiKey, setFullApiKey] = useState<string|null>(null);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [revokeModal, setRevokeModal] = useState(false);
  const [apiSnippetTab, setApiSnippetTab] = useState<"curl"|"js"|"python">("curl");

  useEffect(()=>{
    fetch("/api/auth/me").then(async r=>{ if(r.status===401){router.push("/login");return;} const d=await r.json(); setUser(d.user); });
    fetch("/api/admin/settings").then(r=>r.json()).then(d=>{ setSettings(d.settings); setLoading(false); });
    fetch("/api/admin/api-key").then(r=>r.json()).then(d=>{ if(!d.error) setApiKeyData(d); });
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

  async function loadApiKey() {
    setApiKeyLoading(true);
    const r = await fetch("/api/admin/api-key");
    const d = await r.json();
    if (!d.error) setApiKeyData(d);
    setApiKeyLoading(false);
  }

  async function regenerateKey() {
    setApiKeyLoading(true);
    const r = await fetch("/api/admin/api-key", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"regenerate" }) });
    const d = await r.json();
    if (d.key) {
      setFullApiKey(d.key);
      setApiKeyRevealed(true);
      toast.success("API key regenerated — copy it now, it will not be shown again.");
      await loadApiKey();
    } else {
      toast.error("Failed to regenerate key");
    }
    setRevokeModal(false);
    setApiKeyLoading(false);
  }

  function copyKey() {
    const key = fullApiKey || (apiKeyData ? apiKeyData.keyMasked : "");
    navigator.clipboard.writeText(key);
    toast.success("Copied to clipboard");
  }

  async function loadApps() {
    setAppsLoading(true);
    const r = await fetch("/api/admin/applications");
    const d = await r.json();
    if (!d.error) setApps(d.applications || []);
    setAppsLoading(false);
  }

  async function createApp() {
    if (!newAppName.trim()) return;
    setNewAppSaving(true);
    const r = await fetch("/api/admin/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newAppName.trim(), description: newAppDesc.trim() }),
    });
    const d = await r.json();
    if (d.application) {
      if (d.key) setAppNewKeys(k => ({ ...k, [d.application.id]: d.key }));
      setApps(a => [d.application, ...a]);
      setNewAppForm(false);
      setNewAppName("");
      setNewAppDesc("");
      toast.success("Application created");
    } else {
      toast.error(d.error || "Failed to create application");
    }
    setNewAppSaving(false);
  }

  async function deleteApp(id: string) {
    const r = await fetch(`/api/admin/applications/${id}`, { method: "DELETE" });
    const d = await r.json();
    if (d.success) {
      setApps(a => a.filter(x => x.id !== id));
      toast.success("Application deleted");
    } else {
      toast.error("Failed to delete");
    }
  }

  async function saveEditApp(id: string) {
    const r = await fetch(`/api/admin/applications/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, description: editDesc }),
    });
    const d = await r.json();
    if (d.application) {
      setApps(a => a.map(x => x.id === id ? d.application : x));
      setEditingApp(null);
      toast.success("Updated");
    } else {
      toast.error(d.error || "Failed to update");
    }
  }

  async function regenerateAppKey(id: string, appName: string) {
    const r = await fetch(`/api/admin/applications/${id}/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "regenerate" }),
    });
    const d = await r.json();
    if (d.key) {
      setAppNewKeys(k => ({ ...k, [id]: d.key }));
      toast.success(`Key regenerated for ${appName} — copy it now`);
    } else {
      toast.error("Failed to regenerate");
    }
  }

  async function revokeAppKey(id: string) {
    const r = await fetch(`/api/admin/applications/${id}/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke" }),
    });
    const d = await r.json();
    if (d.success) {
      setAppNewKeys(k => { const n = { ...k }; delete n[id]; return n; });
      toast.success("Key revoked");
    } else {
      toast.error("Failed to revoke");
    }
  }

  const TABS = [{ id:"jwt",label:"JWT & Session",icon:Key },{ id:"device",label:"Device Binding",icon:Smartphone },{ id:"attestation",label:"Attestation Signals",icon:Shield },{ id:"risk",label:"Risk Signals",icon:Activity },{ id:"apikeys",label:"API Keys",icon:KeyRound },{ id:"apps",label:"Applications",icon:LayoutGrid }];

  return (<div className="min-h-screen bg-zinc-950 text-white"><DashNav user={user}/>
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-zinc-800"><Settings className="w-5 h-5 text-zinc-300"/></div><div><h1 className="text-2xl font-black text-white">Tenant Settings</h1><p className="text-zinc-400 text-sm">Configure JWT claims, device binding, attestation and risk signals</p></div></div>
        <div className="flex gap-2"><Button onClick={()=>{setLoading(true);fetch("/api/admin/settings").then(r=>r.json()).then(d=>{setSettings(d.settings);setLoading(false);});}} variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white h-9"><RefreshCw className="w-4 h-4"/></Button><Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 h-9"><Save className="w-4 h-4 mr-1.5"/>{saving?"Saving…":"Save"}</Button></div>
      </div>

      <div className="flex gap-1 mb-6 border-b border-zinc-800">{TABS.map(t=>(<button key={t.id} onClick={()=>{ setTab(t.id as any); if(t.id==="apps") loadApps(); }} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px ${tab===t.id?"border-indigo-500 text-white":"border-transparent text-zinc-500 hover:text-zinc-300"}`}><t.icon className="w-3.5 h-3.5"/>{t.label}</button>))}</div>

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

      {tab==="apikeys" && (<div className="space-y-6">
        {/* Current Key */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
          <h3 className="text-white font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4 text-indigo-400"/>API Key</h3>
          {apiKeyData && (<>
            <div>
              <Label className="text-zinc-400 text-xs mb-2 block">Current API Key</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-zinc-200 truncate">
                  {apiKeyRevealed && fullApiKey ? fullApiKey : apiKeyData.keyMasked}
                </code>
                <button onClick={()=>setApiKeyRevealed(r=>!r)} className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white transition-colors" title="Reveal/hide key">
                  {apiKeyRevealed ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                </button>
                <button onClick={copyKey} className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white transition-colors" title="Copy key">
                  <Copy className="w-4 h-4"/>
                </button>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 text-xs">
              <div><span className="text-zinc-500">Tenant ID</span><p className="text-zinc-300 font-mono mt-0.5">{apiKeyData.tid}</p></div>
              <div><span className="text-zinc-500">Created</span><p className="text-zinc-300 mt-0.5">{new Date(apiKeyData.createdAt).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</p></div>
            </div>
          </>)}
          <div className="pt-2 border-t border-zinc-800">
            <Button onClick={()=>setRevokeModal(true)} disabled={apiKeyLoading} variant="outline" className="border-red-800 text-red-400 hover:bg-red-900/20 hover:text-red-300 h-9">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5"/>Revoke &amp; Regenerate
            </Button>
          </div>
        </div>

        {/* Integration Snippets */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h3 className="text-white font-semibold mb-4">Integration Snippets</h3>
          <div className="flex gap-1 mb-4 border-b border-zinc-800">
            {(["curl","js","python"] as const).map(t=>(<button key={t} onClick={()=>setApiSnippetTab(t)} className={`px-3 py-2 text-xs transition-colors border-b-2 -mb-px ${apiSnippetTab===t?"border-indigo-500 text-white":"border-transparent text-zinc-500 hover:text-zinc-300"}`}>{t==="js"?"JavaScript":t==="python"?"Python":"cURL"}</button>))}
          </div>
          {apiSnippetTab==="curl" && (<pre className="bg-zinc-800 rounded-lg p-4 text-xs text-zinc-300 overflow-x-auto whitespace-pre">{`curl -X POST https://auth-demo-rouge.vercel.app/api/auth/login \\
  -H "X-API-Key: ${(apiKeyRevealed && fullApiKey) ? fullApiKey : (apiKeyData?.keyMasked || "YOUR_API_KEY")}" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com","password":"...","deviceFingerprint":"..."}'`}</pre>)}
          {apiSnippetTab==="js" && (<pre className="bg-zinc-800 rounded-lg p-4 text-xs text-zinc-300 overflow-x-auto whitespace-pre">{`// JavaScript SDK
const uth = new UTHClient({
  apiKey: '${(apiKeyRevealed && fullApiKey) ? fullApiKey : (apiKeyData?.keyMasked || "YOUR_API_KEY")}',
  baseUrl: 'https://auth-demo-rouge.vercel.app'
});

const result = await uth.auth.login({
  email,
  password,
  deviceFingerprint
});`}</pre>)}
          {apiSnippetTab==="python" && (<pre className="bg-zinc-800 rounded-lg p-4 text-xs text-zinc-300 overflow-x-auto whitespace-pre">{`# Python
import uth_sdk

client = uth_sdk.Client(
    api_key="${(apiKeyRevealed && fullApiKey) ? fullApiKey : (apiKeyData?.keyMasked || "YOUR_API_KEY")}"
)

result = client.auth.login(
    email=email,
    password=password
)`}</pre>)}
        </div>
      </div>)}

      {tab==="apps" && (<div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-semibold">Applications</h3>
          <Button onClick={()=>setNewAppForm(f=>!f)} className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs px-3"><Plus className="w-3.5 h-3.5 mr-1"/>New Application</Button>
        </div>

        {newAppForm && (<div className="rounded-xl border border-indigo-700 bg-zinc-900 p-4 space-y-3">
          <h4 className="text-white text-sm font-semibold">New Application</h4>
          <div><Label className="text-zinc-400 text-xs mb-1 block">Name *</Label><Input value={newAppName} onChange={e=>setNewAppName(e.target.value)} placeholder="My App" className="bg-zinc-800 border-zinc-700 text-white" maxLength={100}/></div>
          <div><Label className="text-zinc-400 text-xs mb-1 block">Description</Label><Input value={newAppDesc} onChange={e=>setNewAppDesc(e.target.value)} placeholder="Optional description" className="bg-zinc-800 border-zinc-700 text-white"/></div>
          <div className="flex gap-2 pt-1">
            <Button onClick={createApp} disabled={newAppSaving||!newAppName.trim()} className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs">{newAppSaving?"Creating…":"Create"}</Button>
            <Button onClick={()=>{setNewAppForm(false);setNewAppName("");setNewAppDesc("");}} variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white h-8 text-xs">Cancel</Button>
          </div>
        </div>)}

        {appsLoading && <p className="text-zinc-500 text-sm">Loading…</p>}
        {!appsLoading && apps.length === 0 && <p className="text-zinc-500 text-sm">No applications yet. Create one above.</p>}

        {apps.map(app=>(<div key={app.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {editingApp===app.id ? (<div className="space-y-2">
                <Input value={editName} onChange={e=>setEditName(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white text-sm" maxLength={100}/>
                <Input value={editDesc} onChange={e=>setEditDesc(e.target.value)} placeholder="Description" className="bg-zinc-800 border-zinc-700 text-white text-sm"/>
                <div className="flex gap-1">
                  <button onClick={()=>saveEditApp(app.id)} className="p-1 rounded text-green-400 hover:bg-zinc-700"><Check className="w-4 h-4"/></button>
                  <button onClick={()=>setEditingApp(null)} className="p-1 rounded text-zinc-500 hover:bg-zinc-700"><X className="w-4 h-4"/></button>
                </div>
              </div>) : (<>
                <div className="flex items-center gap-2">
                  <p className="text-white font-semibold text-sm truncate">{app.name}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${app.is_active?"bg-green-900 text-green-300":"bg-zinc-700 text-zinc-400"}`}>{app.is_active?"active":"inactive"}</span>
                </div>
                {app.description && <p className="text-zinc-500 text-xs mt-0.5 truncate">{app.description}</p>}
                <p className="text-zinc-600 text-[10px] mt-1">{new Date(app.created_at).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</p>
              </>)}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {editingApp!==app.id && (<button onClick={()=>{setEditingApp(app.id);setEditName(app.name);setEditDesc(app.description||"");}} className="p-1.5 rounded text-zinc-500 hover:text-white hover:bg-zinc-700" title="Edit"><Edit2 className="w-3.5 h-3.5"/></button>)}
              <button onClick={()=>deleteApp(app.id)} className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-700" title="Delete"><Trash2 className="w-3.5 h-3.5"/></button>
            </div>
          </div>

          {/* API Key section */}
          <div className="border-t border-zinc-800 pt-3 space-y-2">
            <p className="text-zinc-500 text-xs font-medium">API Key</p>
            {appNewKeys[app.id] && (<div className="bg-zinc-800 rounded-lg px-3 py-2 flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-green-300 truncate">{appNewKeys[app.id]}</code>
              <button onClick={()=>{navigator.clipboard.writeText(appNewKeys[app.id]);toast.success("Copied");}} className="text-zinc-400 hover:text-white"><Copy className="w-3.5 h-3.5"/></button>
            </div>)}
            {!appNewKeys[app.id] && <p className="text-zinc-600 text-xs font-mono">uth_live_••••••••...••••</p>}
            <div className="flex gap-2">
              <button onClick={()=>regenerateAppKey(app.id,app.name)} className="text-xs px-2.5 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-700 flex items-center gap-1"><RefreshCw className="w-3 h-3"/>Regenerate</button>
              <button onClick={()=>revokeAppKey(app.id)} className="text-xs px-2.5 py-1 rounded-md bg-zinc-800 border border-red-900 text-red-400 hover:bg-red-900/20 hover:text-red-300 flex items-center gap-1"><X className="w-3 h-3"/>Revoke</button>
            </div>
          </div>
        </div>))}
      </div>)}

      {/* Revoke confirmation modal */}
      {revokeModal && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"><div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full mx-4 space-y-4">
        <h3 className="text-white font-bold text-lg">Revoke &amp; Regenerate API Key?</h3>
        <p className="text-zinc-400 text-sm">This will invalidate your current key. All integrations using this key will stop working immediately.</p>
        <div className="flex gap-3 pt-2">
          <Button onClick={()=>setRevokeModal(false)} variant="outline" className="flex-1 border-zinc-700 text-zinc-400 hover:text-white">Cancel</Button>
          <Button onClick={regenerateKey} disabled={apiKeyLoading} className="flex-1 bg-red-600 hover:bg-red-700">{apiKeyLoading?"Regenerating…":"Revoke & Regenerate"}</Button>
        </div>
      </div></div>)}
    </div>
  </div>);
}
