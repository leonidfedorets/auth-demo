"use client";
import { useState } from "react";
import Link from "next/link";
import { Lock, CheckCircle2, XCircle, Clock, AlertTriangle, ChevronRight, Key, Smartphone, Mail, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function UthNav() {
  return (<nav className="border-b border-zinc-800 px-6 py-3 flex items-center gap-4 bg-zinc-950"><Link href="/" className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center"><span className="font-black text-white text-[10px]">UTH</span></div><span className="font-black text-sm tracking-tighter"><span className="text-indigo-400">U</span><span className="text-indigo-300">T</span><span className="text-indigo-200">H</span></span></Link><span className="text-zinc-600">/</span><span className="text-zinc-400 text-sm">SCA / PSD2</span><div className="ml-auto flex gap-3"><Link href="/platform/risk-engine" className="text-zinc-500 hover:text-white text-xs">Risk Engine</Link><Link href="/dashboard/transactions" className="text-zinc-500 hover:text-white text-xs">Transactions</Link></div></nav>);
}

type ScenarioOutcome = "success"|"fail"|"timeout";
const METHODS = [
  { id:"totp", label:"TOTP", desc:"Authenticator app (Google Auth, Authy)", icon:Shield, acr:"silver", amr:["otp","mfa"] },
  { id:"webauthn", label:"WebAuthn", desc:"Passkey / hardware key (FIDO2 L2)", icon:Key, acr:"gold", amr:["hwk"] },
  { id:"push", label:"Push", desc:"Mobile push notification", icon:Smartphone, acr:"silver", amr:["push","mfa"] },
  { id:"email_otp", label:"Email OTP", desc:"One-time code via email", icon:Mail, acr:"bronze", amr:["otp"] },
];
const SCENARIOS: {id:ScenarioOutcome,label:string,desc:string}[] = [
  { id:"success", label:"Success", desc:"User provides correct code / approves push" },
  { id:"fail", label:"Fail", desc:"Wrong code or user rejects" },
  { id:"timeout", label:"Timeout", desc:"Challenge expires after 10 min TTL" },
];

function stepDelay(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

type Step = { status: "waiting"|"active"|"done"|"error"; label: string; detail?: string; ts?: string };

export default function SCAPage() {
  const [method, setMethod] = useState("totp");
  const [outcome, setOutcome] = useState<ScenarioOutcome>("success");
  const [amount, setAmount] = useState("250.00");
  const [iban, setIban] = useState("LV80BANK0000435195001");
  const [currency, setCurrency] = useState("EUR");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [result, setResult] = useState<any>(null);
  const [challengeId] = useState(()=>`chl_${Math.random().toString(36).slice(2,12)}`);

  const m = METHODS.find(x=>x.id===method)!;

  function updateStep(idx: number, patch: Partial<Step>) {
    setSteps(prev => prev.map((s,i)=> i===idx ? {...s,...patch} : s));
  }

  async function runSimulation() {
    setRunning(true);
    setResult(null);
    const cid = `chl_${Math.random().toString(36).slice(2,12)}`;
    const ts = ()=>new Date().toISOString();

    const initialSteps: Step[] = [
      { status:"waiting", label:"Create SCA challenge" },
      { status:"waiting", label:`User receives ${m.label} prompt` },
      { status:"waiting", label:"User responds" },
      { status:"waiting", label:"Verify challenge" },
      { status:"waiting", label:"Issue JWT claims / result" },
    ];
    setSteps(initialSteps);

    // Step 0 — create challenge
    setSteps(s => s.map((x,i)=>i===0?{...x,status:"active"}:x));
    await stepDelay(700);
    setSteps(s => s.map((x,i)=>i===0?{...x,status:"done",detail:`challengeId: ${cid} | TTL: 600s | method: ${method} | amount: ${currency} ${amount} | iban: ${iban}`,ts:ts()}:x));

    // Step 1 — user receives prompt
    setSteps(s => s.map((x,i)=>i===1?{...x,status:"active"}:x));
    await stepDelay(900);
    const promptDetails: Record<string,string> = { totp:"TOTP app displays 6-digit code bound to this challenge", webauthn:"Browser/device authenticator shows payment approval dialog", push:"Push notification: 'Approve payment of EUR 250.00 to LV80...'", email_otp:"Email sent: OTP code valid for 10 minutes" };
    setSteps(s => s.map((x,i)=>i===1?{...x,status:"done",detail:promptDetails[method],ts:ts()}:x));

    // Step 2 — user responds
    setSteps(s => s.map((x,i)=>i===2?{...x,status:"active"}:x));
    await stepDelay(1200);
    if (outcome==="timeout") {
      setSteps(s => s.map((x,i)=>{if(i===2)return{...x,status:"error" as const,detail:"⏱ Challenge expired after 600s TTL",ts:ts()};if(i===3||i===4)return{...x,status:"error" as const,label:x.label+" (skipped)",detail:"Expired"};return x;}));
      setResult({ result:"DENY", reason:"challenge_expired", outcome:"timeout", challengeId:cid, method, ttlExpiredAt:ts(), transaction:{ id:`txn_${Date.now()}`, type:"sca", subtype:"timeout", amount, currency, iban, challengeId:cid, method, result:"DENY", reason:"timeout" }});
      setRunning(false); return;
    }
    const responseDetail: Record<string,Record<ScenarioOutcome,string>> = {
      totp:{ success:"User entered correct 6-digit TOTP code (HMAC-SHA1, T=30s window)", fail:"User entered wrong code: 399821 (expected ~847291)", timeout:"" },
      webauthn:{ success:"Device signed challenge with private key (ES256) — signature verified against stored public key", fail:"User clicked 'Cancel' on authenticator dialog — operation aborted", timeout:"" },
      push:{ success:"User tapped 'Approve' on mobile push — confirmation received", fail:"User tapped 'Deny' on push notification", timeout:"" },
      email_otp:{ success:"User entered 6-digit code from email within TTL", fail:"User entered expired or wrong email OTP", timeout:"" },
    };
    setSteps(s => s.map((x,i)=>i===2?{...x,status:outcome==="fail"?"error":"done",detail:responseDetail[method][outcome],ts:ts()}:x));

    if (outcome==="fail") {
      await stepDelay(600);
      setSteps(s => s.map((x,i)=>i===3?{...x,status:"active"}:x));
      await stepDelay(600);
      setSteps(s => s.map((x,i)=>i===3?{...x,status:"error" as const,detail:"Verification failed",ts:ts()}:i===4?{...x,status:"error" as const,detail:"Skipped"}:x));
      setResult({ result:"DENY", reason:"invalid_credentials", outcome:"fail", challengeId:cid, method, failedAt:ts(), transaction:{ id:`txn_${Date.now()}`, type:"sca", subtype:"fail", amount, currency, iban, challengeId:cid, method, result:"DENY", reason:"wrong_code_or_rejected" }});
      setRunning(false); return;
    }

    // Step 3 — verify
    setSteps(s => s.map((x,i)=>i===3?{...x,status:"active"}:x));
    await stepDelay(800);
    setSteps(s => s.map((x,i)=>i===3?{...x,status:"done",detail:`POST /api/sca/verify → challenge consumed (single-use) | dynamic link verified: amount=${amount} iban=${iban}`,ts:ts()}:x));

    // Step 4 — JWT claims
    setSteps(s => s.map((x,i)=>i===4?{...x,status:"active"}:x));
    await stepDelay(600);
    const jwtClaims = { sca:true, sca_method:method, acr:m.acr, amr:m.amr, sca_ts:Math.floor(Date.now()/1000) };
    setSteps(s => s.map((x,i)=>i===4?{...x,status:"done",detail:`JWT claims added: ${JSON.stringify(jwtClaims)}`,ts:ts()}:x));

    setResult({ result:"ALLOW", challengeId:cid, method, jwtClaims, outcome:"success", verifiedAt:ts(),
      webauthnInfo: method==="webauthn" ? { publicKeyAlgorithm:"ES256 (COSE -7)", credentialType:"platform", userVerification:"required", rpId:"auth-demo-rouge.vercel.app", origin:"https://auth-demo-rouge.vercel.app", aaguid:"adce0002-35bc-c60a-648b-0b25f1f05503", signature:"base64url-encoded ECDSA signature over clientDataHash+authData", publicKey:"MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE..." } : undefined,
      transaction:{ id:`txn_${Date.now()}`, type:"sca", subtype:"success", amount, currency, iban, challengeId:cid, method, result:"ALLOW", jwtClaims, acr:m.acr, amr:m.amr }
    });
    setRunning(false);
  }

  return (<div className="min-h-screen bg-zinc-950 text-white"><UthNav/>
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-2"><div className="p-2 rounded-lg bg-red-500/15"><Lock className="w-5 h-5 text-red-400"/></div><div><h1 className="text-2xl font-black text-white">SCA / PSD2 Flow Simulation</h1><p className="text-zinc-400 text-sm">Simulate all SCA scenarios — real API calls available via <code className="text-indigo-300 font-mono">/api/sca/challenge</code> + <code className="text-indigo-300 font-mono">/api/sca/verify</code></p></div></div>
      <p className="text-zinc-600 text-xs mb-8">This simulator shows the exact flow and produces realistic result payloads. Production requests go in <Link href="/dashboard/transactions" className="text-indigo-400 hover:underline">Transactions</Link>.</p>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Config */}
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3"><h3 className="text-white font-semibold text-sm">Transaction (dynamic linking)</h3>
            <div><Label className="text-zinc-400 text-xs mb-1 block">Amount</Label><div className="flex gap-2"><Input value={amount} onChange={e=>setAmount(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white font-mono"/><select value={currency} onChange={e=>setCurrency(e.target.value)} className="bg-zinc-800 border border-zinc-700 text-white rounded-md px-2 text-sm"><option>EUR</option><option>USD</option><option>GBP</option></select></div></div>
            <div><Label className="text-zinc-400 text-xs mb-1 block">IBAN</Label><Input value={iban} onChange={e=>setIban(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white font-mono text-xs"/></div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><h3 className="text-white font-semibold text-sm mb-3">SCA Method</h3>
            <div className="space-y-1.5">{METHODS.map(m=>(<label key={m.id} className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${method===m.id?"border-indigo-500 bg-indigo-500/10":"border-zinc-800 hover:border-zinc-700"}`}><input type="radio" name="method" value={m.id} checked={method===m.id} onChange={()=>setMethod(m.id)} className="accent-indigo-500"/><m.icon className="w-3.5 h-3.5 text-zinc-400"/><div><p className="text-white text-xs font-medium">{m.label}</p><p className="text-zinc-500 text-[10px]">{m.desc}</p></div><Badge variant="outline" className="ml-auto text-[10px] border-zinc-700 text-zinc-500">ACR:{m.acr}</Badge></label>))}</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><h3 className="text-white font-semibold text-sm mb-3">Scenario</h3>
            <div className="space-y-1.5">{SCENARIOS.map(s=>(<label key={s.id} className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${outcome===s.id?"border-indigo-500 bg-indigo-500/10":"border-zinc-800 hover:border-zinc-700"}`}><input type="radio" name="outcome" value={s.id} checked={outcome===s.id} onChange={()=>setOutcome(s.id)} className="accent-indigo-500"/><div><p className="text-white text-xs font-medium capitalize">{s.label}</p><p className="text-zinc-500 text-[10px]">{s.desc}</p></div></label>))}</div>
          </div>
          <Button onClick={runSimulation} disabled={running} className="w-full bg-indigo-600 hover:bg-indigo-700 h-11">{running?"Running simulation…":"▶ Run Simulation"}</Button>
        </div>

        {/* Flow */}
        <div className="lg:col-span-2 space-y-4">
          {steps.length>0 && (<div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h3 className="text-white font-semibold text-sm mb-4">Flow</h3>
            <div className="space-y-3">{steps.map((s,i)=>(<div key={i} className="flex gap-3">
              <div className="flex flex-col items-center"><div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${s.status==="done"?"bg-green-500/20 text-green-400":s.status==="active"?"bg-indigo-500/20 text-indigo-400 animate-pulse":s.status==="error"?"bg-red-500/20 text-red-400":"bg-zinc-800 text-zinc-600"}`}>{s.status==="done"?<CheckCircle2 className="w-3.5 h-3.5"/>:s.status==="error"?<XCircle className="w-3.5 h-3.5"/>:s.status==="active"?<Clock className="w-3.5 h-3.5"/>:i+1}</div>{i<steps.length-1&&<div className={`w-px flex-1 mt-1 ${s.status==="done"?"bg-green-500/30":s.status==="error"?"bg-red-500/30":"bg-zinc-800"}`}/>}</div>
              <div className="pb-4 flex-1 min-w-0"><p className={`text-sm font-medium ${s.status==="done"?"text-white":s.status==="active"?"text-indigo-300":s.status==="error"?"text-red-300":"text-zinc-600"}`}>{s.label}</p>{s.detail&&<p className="text-zinc-500 text-xs mt-0.5 font-mono break-all">{s.detail}</p>}{s.ts&&<p className="text-zinc-700 text-[10px] mt-0.5">{new Date(s.ts).toISOString()}</p>}</div>
            </div>))}</div>
          </div>)}

          {result && (<>
            <div className={`rounded-xl border p-5 ${result.result==="ALLOW"?"border-green-500/40 bg-green-500/5":"border-red-500/40 bg-red-500/5"}`}>
              <div className="flex items-center gap-3 mb-4">{result.result==="ALLOW"?<CheckCircle2 className="w-5 h-5 text-green-400"/>:<XCircle className="w-5 h-5 text-red-400"/>}<span className={`text-xl font-black ${result.result==="ALLOW"?"text-green-400":"text-red-400"}`}>{result.result}</span>{result.reason&&<Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-xs ml-auto">{result.reason}</Badge>}</div>
              {result.jwtClaims && (<><p className="text-zinc-500 text-xs uppercase tracking-wide mb-2">JWT Claims added to session</p><div className="bg-zinc-900 rounded-lg p-3 font-mono text-xs space-y-1">{Object.entries(result.jwtClaims).map(([k,v])=>(<div key={k}><span className="text-zinc-500">{k}: </span><span className="text-indigo-300">{Array.isArray(v)?`[${v.join(", ")}]`:String(v)}</span></div>))}</div></>)}
              {result.webauthnInfo && (<><p className="text-zinc-500 text-xs uppercase tracking-wide mt-3 mb-2">WebAuthn Credential Info</p><div className="bg-zinc-900 rounded-lg p-3 font-mono text-xs space-y-1">{Object.entries(result.webauthnInfo).map(([k,v])=>(<div key={k}><span className="text-zinc-500">{k}: </span><span className="text-green-300 break-all">{String(v)}</span></div>))}</div></>)}
              {result.outcome==="timeout"&&<p className="text-red-300 text-sm mt-3">Challenge TTL (600s) expired — transaction logged as timeout in audit.</p>}
              {result.outcome==="fail"&&<p className="text-red-300 text-sm mt-3">Verification failed — attempt logged with reason code.</p>}
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-zinc-500 text-xs uppercase tracking-wide mb-2">Transaction record (→ appears in Transactions dashboard)</p>
              <pre className="font-mono text-xs text-zinc-400 overflow-auto max-h-40">{JSON.stringify(result.transaction, null, 2)}</pre>
            </div>
          </>)}

          {steps.length===0&&(<div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center"><Lock className="w-8 h-8 text-zinc-700 mx-auto mb-3"/><p className="text-zinc-500">Configure and click Run Simulation</p></div>)}

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><h3 className="text-white text-xs font-semibold mb-3 uppercase tracking-wide">ACR / AMR by method</h3>
            <table className="w-full text-xs"><thead><tr className="text-zinc-500"><th className="text-left pb-1.5">Method</th><th className="text-left pb-1.5">ACR</th><th className="text-left pb-1.5">AMR</th><th className="text-left pb-1.5">Phishing-resistant</th></tr></thead><tbody className="text-zinc-400">{METHODS.map(m=>(<tr key={m.id} className="border-t border-zinc-800/50"><td className="py-1.5 text-white font-medium">{m.label}</td><td><Badge variant="outline" className="text-[10px] border-zinc-700">{m.acr}</Badge></td><td className="font-mono text-[10px]">{m.amr.join(", ")}</td><td className={m.id==="webauthn"?"text-green-400":"text-zinc-600"}>{m.id==="webauthn"?"Yes":"No"}</td></tr>))}</tbody></table>
          </div>
        </div>
      </div>
    </div>
  </div>);
}
