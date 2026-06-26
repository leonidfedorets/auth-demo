"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Clock, ChevronRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

function DashNav({ user }: { user: any }) {
  return (<nav className="border-b border-zinc-800 px-6 py-3 flex items-center gap-4 bg-zinc-950 sticky top-0 z-40">
    <Link href="/" className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center"><span className="font-black text-white text-[10px]">UTH</span></div><span className="font-black text-sm tracking-tighter"><span className="text-indigo-400">U</span><span className="text-indigo-300">T</span><span className="text-indigo-200">H</span></span></Link>
    <span className="text-zinc-600">/</span><Link href="/dashboard" className="text-zinc-500 hover:text-white text-sm">Dashboard</Link>
    <span className="text-zinc-600">/</span><span className="text-zinc-400 text-sm">Transactions</span>
    <div className="ml-auto flex items-center gap-3 text-xs text-zinc-500">{user?.email}</div>
  </nav>);
}

const TYPE_COLORS: Record<string,string> = {
  auth:"bg-blue-500/20 text-blue-300 border-blue-500/30",
  token_rotation:"bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  session_expiry:"bg-zinc-700 text-zinc-300 border-zinc-600",
  risk:"bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  sca:"bg-red-500/20 text-red-300 border-red-500/30",
  attestation:"bg-green-500/20 text-green-300 border-green-500/30",
  device_binding:"bg-purple-500/20 text-purple-300 border-purple-500/30",
};
const SUBTYPE_LABELS: Record<string,string> = {
  login_success:"Login OK",login_failed:"Login FAIL",login_step_up:"Step-up req",
  access_token_refresh:"Token refresh",refresh_token_rotation:"Session rotate",
  access_token_expired:"Token expired",session_expired:"Session expired",
  success:"SCA ✓",fail:"SCA ✗",timeout:"SCA timeout",
  evaluate:"Evaluated",bind:"Bound",revoke:"Revoked",suspend:"Suspended",
  standalone_evaluate:"Risk eval"
};
const RISK_COLORS: Record<string,string> = { low:"text-green-400",medium:"text-yellow-400",high:"text-orange-400",critical:"text-red-400" };
const DECISION_ICON: Record<string,React.ReactNode> = {
  ALLOW:<CheckCircle2 className="w-3.5 h-3.5 text-green-400"/>,
  DENY:<XCircle className="w-3.5 h-3.5 text-red-400"/>,
  STEP_UP:<AlertTriangle className="w-3.5 h-3.5 text-yellow-400"/>,
};

const ALL_TYPES = ["all","auth","token_rotation","session_expiry","risk","sca","attestation","device_binding"];

export default function TransactionsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState("");

  useEffect(()=>{
    fetch("/api/auth/me").then(async r=>{ if(r.status===401){router.push("/login");return;} const d=await r.json(); setUser(d.user); });
    fetchTx("all");
  },[]);

  async function fetchTx(type:string) {
    setLoading(true);
    const r = await fetch(`/api/transactions${type&&type!=="all"?`?type=${type}`:""}`);
    const data = await r.json();
    setTransactions(data.transactions||[]);
    setLoading(false);
  }

  function handleType(t:string) { setTypeFilter(t); fetchTx(t); }
  const filtered = search ? transactions.filter(tx=>tx.email?.toLowerCase().includes(search.toLowerCase())||tx.id?.includes(search)||tx.ip?.includes(search)||tx.subtype?.includes(search)) : transactions;

  function timeStr(ts:string|null) {
    if(!ts)return"—";
    const d=new Date(ts); return `${d.toLocaleDateString("en-GB",{day:"2-digit",month:"short"})} ${d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}`;
  }

  return (<div className="min-h-screen bg-zinc-950 text-white"><DashNav user={user}/>
    <div className="flex h-[calc(100vh-49px)]">
      <div className={`flex-1 flex flex-col overflow-hidden ${selected?"hidden lg:flex lg:max-w-[58%]":""}`}>
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2 flex-wrap">
          <h1 className="text-base font-black text-white flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-400"/>Auth Transactions</h1>
          <div className="flex gap-1 flex-wrap ml-1 overflow-x-auto">{ALL_TYPES.map(t=>(<button key={t} onClick={()=>handleType(t)} className={`text-[10px] shrink-0 rounded-full px-2.5 py-1 border transition-colors capitalize ${typeFilter===t?"border-indigo-500 text-indigo-300 bg-indigo-500/10":"border-zinc-700 text-zinc-500 hover:text-white"}`}>{t.replace("_"," ")}</button>))}</div>
          <div className="ml-auto flex items-center gap-2"><Input placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} className="bg-zinc-900 border-zinc-700 text-white text-xs h-7 w-32"/><Button size="sm" onClick={()=>fetchTx(typeFilter)} variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white h-7 w-7 p-0"><RefreshCw className="w-3 h-3"/></Button></div>
        </div>
        <div className="flex-1 overflow-auto">
          {loading?<div className="p-8 text-zinc-500 text-sm text-center">Loading…</div>:(
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-zinc-950 border-b border-zinc-800">
              <tr>{["Time","Type","Subtype","User","IP","Risk","Decision",""].map(h=>(<th key={h} className="text-left px-3 py-2 text-zinc-500 font-medium whitespace-nowrap">{h}</th>))}</tr>
            </thead>
            <tbody>{filtered.map(tx=>(<tr key={tx.id} onClick={()=>setSelected(tx)} className={`border-b border-zinc-800/30 hover:bg-zinc-900/70 cursor-pointer transition-colors ${selected?.id===tx.id?"bg-zinc-900":""}`}>
              <td className="px-3 py-2 text-zinc-600 font-mono whitespace-nowrap">{timeStr(tx.created_at||tx.createdAt||(tx.ts?new Date(tx.ts as number).toISOString():null))}</td>
              <td className="px-3 py-2"><Badge className={`${TYPE_COLORS[tx.type]||"bg-zinc-800 text-zinc-400"} border text-[10px] py-0 whitespace-nowrap`}>{tx.type}</Badge></td>
              <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">{SUBTYPE_LABELS[tx.subtype||""]||tx.subtype||"—"}</td>
              <td className="px-3 py-2 text-zinc-300 whitespace-nowrap max-w-[120px] truncate">{tx.email||tx.userId||"—"}</td>
              <td className="px-3 py-2 font-mono text-zinc-500 whitespace-nowrap">{tx.ip||"—"}{tx.country&&<span className="ml-1 text-zinc-700">{tx.country}</span>}</td>
              <td className="px-3 py-2 whitespace-nowrap"><span className={`font-mono font-bold ${RISK_COLORS[(tx.risk as any)?.level||tx.risk_level]||"text-zinc-500"}`}>{(tx.risk as any)?.score??tx.risk_score??""}</span>{((tx.risk as any)?.level||tx.risk_level)&&<span className="text-zinc-600 ml-1 capitalize">{(tx.risk as any)?.level||tx.risk_level}</span>}</td>
              <td className="px-3 py-2"><div className="flex items-center gap-1">{DECISION_ICON[(tx.decision||(tx.risk as any)?.decision)||""]}<span className={`${(tx.decision||(tx.risk as any)?.decision)==="ALLOW"?"text-green-400":(tx.decision||(tx.risk as any)?.decision)==="DENY"?"text-red-400":(tx.decision||(tx.risk as any)?.decision)==="STEP_UP"?"text-yellow-400":"text-zinc-500"}`}>{tx.decision||(tx.risk as any)?.decision||"—"}</span></div></td>
              <td className="px-3 py-2 text-zinc-700"><ChevronRight className="w-3 h-3"/></td>
            </tr>))}</tbody>
          </table>)}
        </div>
      </div>

      {/* Detail panel */}
      {selected&&(<div className="w-full lg:w-[42%] border-l border-zinc-800 bg-zinc-950 overflow-auto flex-shrink-0 flex flex-col">
        <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 px-4 py-2.5 flex items-center justify-between z-10">
          <div className="flex items-center gap-2"><Badge className={`${TYPE_COLORS[selected.type]||""} border text-[10px]`}>{selected.type}</Badge><span className="text-zinc-400 text-xs">{SUBTYPE_LABELS[selected.subtype||""]||selected.subtype}</span></div>
          <button onClick={()=>setSelected(null)} className="text-zinc-500 hover:text-white text-sm px-2">✕</button>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-4 text-xs">
          {/* Decision banner */}
          <div className={`rounded-lg p-3 flex items-center gap-2 ${selected.decision==="ALLOW"?"bg-green-500/10 border border-green-500/30":selected.decision==="DENY"?"bg-red-500/10 border border-red-500/30":selected.decision==="STEP_UP"?"bg-yellow-500/10 border border-yellow-500/30":"bg-zinc-800 border border-zinc-700"}`}>
            {DECISION_ICON[selected.decision||""]}<span className={`font-bold ${selected.decision==="ALLOW"?"text-green-400":selected.decision==="DENY"?"text-red-400":"text-yellow-400"}`}>{selected.decision||"N/A"}</span>
            {selected.failure_reason&&<span className="text-red-300 ml-2">— {selected.failure_reason}</span>}
            {selected.step_up_reason&&<span className="text-yellow-300 ml-2">— {selected.step_up_reason}</span>}
          </div>

          {/* Identity */}
          <Sec title="Identity"><R l="Txn ID" v={selected.id} m/><R l="User" v={selected.email||"—"}/><R l="User ID" v={selected.user_id||"—"} m/><R l="Name" v={selected.display_name||"—"}/><R l="Time" v={timeStr(selected.created_at)}/></Sec>

          {/* Network */}
          <Sec title="Network"><R l="IP" v={selected.ip||"—"} m/><R l="Country" v={selected.country||"—"}/><R l="ASN" v={selected.asn||"—"}/><R l="Risk Score" v={`${selected.risk_score??0} (${selected.risk_level||"—"})`} c={RISK_COLORS[selected.risk_level]}/></Sec>

          {/* Session */}
          {(selected.session_id||selected.jwt)&&(<Sec title="Session & JWT">
            <R l="Session ID" v={selected.session_id||"—"} m/>
            <R l="Auth Method" v={selected.auth_method||"—"}/>
            {selected.session_created_at&&<R l="Session created" v={timeStr(selected.session_created_at)}/>}
            {selected.session_expires_at&&<R l="Session expires" v={timeStr(selected.session_expires_at)}/>}
            {selected.jwt?.claims&&(<>
              <div className="col-span-2 mt-2"><p className="text-zinc-600 text-[10px] uppercase tracking-wide mb-1">JWT Claims</p><div className="bg-zinc-900 rounded-lg p-2.5 space-y-0.5">{Object.entries(selected.jwt.claims).map(([k,v])=>(<div key={k} className="flex justify-between gap-2"><span className="text-zinc-500 font-mono">{k}:</span><span className="text-indigo-300 font-mono text-right truncate max-w-[55%]">{Array.isArray(v)?`[${(v as string[]).join(",")}]`:String(v)}</span></div>))}</div></div>
              {selected.jwt.access_token&&<R l="Access token TTL" v={`${selected.jwt.access_token_ttl}s`}/>}
              {selected.jwt.refresh_token&&<R l="Refresh token TTL" v={`${selected.jwt.refresh_token_ttl}s`}/>}
            </>)}
          </Sec>)}

          {/* Token rotation */}
          {selected.rotation&&(<Sec title="Token Rotation"><R l="Trigger" v={selected.rotation.trigger||selected.subtype}/><R l="Old token expired" v={timeStr(selected.rotation.old_access_token_exp)||"—"}/>{selected.rotation.new_access_token_ttl&&<R l="New access TTL" v={`${selected.rotation.new_access_token_ttl}s`}/>}{selected.rotation.refresh_token_remaining_ttl&&<R l="Refresh remaining" v={`${selected.rotation.refresh_token_remaining_ttl}s`}/>}{selected.rotation.session_rotated!==undefined&&<R l="Session rotated" v={selected.rotation.session_rotated?"Yes":"No"}/>}</Sec>)}

          {/* SCA */}
          {selected.sca&&(<Sec title="SCA Challenge">
            <R l="Challenge ID" v={selected.sca.challenge_id} m/><R l="Method" v={selected.sca.method}/><R l="Result" v={selected.sca.result} c={selected.sca.result==="ALLOW"?"text-green-400":"text-red-400"}/>
            {selected.sca.amount&&<R l="Amount" v={`${selected.sca.currency} ${selected.sca.amount}`}/>}
            {selected.sca.iban&&<R l="IBAN" v={selected.sca.iban} m/>}
            {selected.sca.time_to_verify_seconds&&<R l="Time to verify" v={`${selected.sca.time_to_verify_seconds}s`}/>}
            {selected.sca.failure_reason&&<R l="Failure reason" v={selected.sca.failure_reason}/>}
            {selected.sca.attempts&&<R l="Attempts" v={`${selected.sca.attempts}/${selected.sca.max_attempts}`}/>}
            {selected.sca.webauthn&&(<div className="col-span-2 mt-2"><p className="text-zinc-600 text-[10px] uppercase tracking-wide mb-1">WebAuthn Credential</p><div className="bg-zinc-900 rounded-lg p-2.5 space-y-0.5">{Object.entries(selected.sca.webauthn).map(([k,v])=>(<div key={k} className="flex justify-between gap-2"><span className="text-zinc-500 font-mono">{k}:</span><span className="text-green-300 font-mono text-right truncate max-w-[55%]">{String(v)}</span></div>))}</div></div>)}
            {selected.jwt_claims&&(<div className="col-span-2 mt-2"><p className="text-zinc-600 text-[10px] uppercase tracking-wide mb-1">JWT Claims from SCA</p><div className="bg-zinc-900 rounded-lg p-2.5 space-y-0.5">{Object.entries(selected.jwt_claims).map(([k,v])=>(<div key={k} className="flex justify-between gap-2"><span className="text-zinc-500 font-mono">{k}:</span><span className="text-indigo-300 font-mono">{Array.isArray(v)?`[${(v as string[]).join(",")}]`:String(v)}</span></div>))}</div></div>)}
          </Sec>)}

          {/* Attestation */}
          {selected.attestation&&(<Sec title="Device Attestation">
            <R l="Device ID" v={selected.attestation.device_id} m/><R l="Platform" v={selected.attestation.platform}/><R l="Status" v={selected.attestation.status} c={selected.attestation.status==="healthy"?"text-green-400":selected.attestation.status==="blocked"?"text-red-400":"text-yellow-400"}/><R l="Trust Score" v={String(selected.attestation.trust_score)}/><R l="DBA" v={selected.attestation.dba}/>
            {selected.attestation.signals_passed?.length>0&&<R l="Signals passed" v={selected.attestation.signals_passed.join(", ")}/>}
            {selected.attestation.signals_failed?.length>0&&<R l="Signals failed" v={selected.attestation.signals_failed.join(", ")} c="text-red-300"/>}
            {selected.attestation.recommendation&&<R l="Recommendation" v={selected.attestation.recommendation}/>}
          </Sec>)}

          {/* Device binding */}
          {selected.binding&&(<Sec title="Device Binding">
            <R l="Device ID" v={selected.binding.device_id} m/><R l="Fingerprint" v={selected.binding.fingerprint} m/><R l="State" v={`${selected.binding.state_from} → ${selected.binding.state_to}`}/>{selected.binding.reason&&<R l="Reason" v={selected.binding.reason}/> }{selected.binding.current_device_count&&<R l="Device count" v={`${selected.binding.current_device_count}/${selected.binding.max_devices}`}/>}
          </Sec>)}

          {/* Risk eval */}
          {selected.risk_eval&&(<Sec title="Risk Evaluation">
            <R l="Context" v={selected.risk_eval.context}/><R l="Operation" v={selected.risk_eval.operation_type||"—"}/>{selected.risk_eval.amount&&<R l="Amount" v={`EUR ${selected.risk_eval.amount}`}/>}
            {selected.risk_eval.layers&&(<div className="col-span-2 mt-1"><div className="bg-zinc-900 rounded-lg p-2.5 space-y-0.5">{Object.entries(selected.risk_eval.layers).map(([k,v])=>(<div key={k} className="flex justify-between"><span className="text-zinc-500 font-mono">{k}:</span><span className="text-yellow-300 font-mono">{String(v)}</span></div>))}</div></div>)}
            {selected.risk_eval.triggered_signals?.length>0&&<R l="Triggered" v={selected.risk_eval.triggered_signals.join(", ")} c="text-red-300"/>}
            {selected.risk_eval.required_action&&<R l="Required action" v={selected.risk_eval.required_action}/>}
          </Sec>)}

          {/* Expiry */}
          {selected.expiry&&(<Sec title="Session / Token Expiry"><R l="Token type" v={selected.expiry.token_type}/><R l="TTL was" v={`${selected.expiry.ttl_was}s`}/><R l="Expired at" v={timeStr(selected.expiry.expired_at)}/>{selected.expiry.next_action&&<R l="Next action" v={selected.expiry.next_action}/> }{selected.expiry.reason&&<R l="Reason" v={selected.expiry.reason}/>}</Sec>)}

          {/* Raw */}
          <div><p className="text-zinc-600 text-[10px] uppercase tracking-wide mb-1.5">Raw JSON</p><pre className="bg-zinc-900 rounded-lg p-2.5 text-[10px] font-mono text-zinc-500 overflow-auto max-h-40">{JSON.stringify(selected, null, 2)}</pre></div>
        </div>
      </div>)}
    </div>
  </div>);
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (<div><p className="text-zinc-600 text-[10px] uppercase tracking-widest mb-1.5">{title}</p><div className="rounded-lg border border-zinc-800 bg-zinc-900/50 divide-y divide-zinc-800/40 grid grid-cols-1">{children}</div></div>);
}
function R({ l, v, m, c }: { l: string; v: string; m?: boolean; c?: string }) {
  return (<div className="flex items-start justify-between px-3 py-1.5 gap-2"><span className="text-zinc-600 shrink-0 text-[10px]">{l}</span><span className={`text-[10px] text-right break-all max-w-[62%] ${m?"font-mono":""} ${c||"text-zinc-300"}`}>{v}</span></div>);
}
