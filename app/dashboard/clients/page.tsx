"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, Search, ShieldCheck, ShieldOff, Clock, Activity, Building2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DashNav } from "@/components/dash-nav";

const KYB_KEY = "kyb_data_v4";

function getKybStatus(email: string): { label: string; cls: string } | null {
  try {
    const raw = localStorage.getItem(KYB_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const clients: any[] = data.clients ?? [];
    const match = clients.find((c: any) =>
      c.email?.toLowerCase() === email?.toLowerCase() ||
      c.contactEmail?.toLowerCase() === email?.toLowerCase()
    );
    if (!match) return null;
    const score = match.riskScore ?? 0;
    if (score > 80) return { label: "KYB · High Risk", cls: "bg-red-500/10 text-red-400 border-red-500/30" };
    if (score > 50) return { label: "KYB · Medium Risk", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" };
    return { label: "KYB · Verified", cls: "bg-green-500/10 text-green-400 border-green-500/30" };
  } catch { return null; }
}

function getKybRecord(email: string): any | null {
  try {
    const raw = localStorage.getItem(KYB_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const clients: any[] = data.clients ?? [];
    return clients.find((c: any) =>
      c.email?.toLowerCase() === email?.toLowerCase() ||
      c.contactEmail?.toLowerCase() === email?.toLowerCase()
    ) ?? null;
  } catch { return null; }
}

const RISK_COLORS: Record<string,string> = { low:"text-green-400",medium:"text-yellow-400",high:"text-orange-400",critical:"text-red-400" };

export default function ClientsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);

  useEffect(()=>{
    fetch("/api/auth/me").then(async r=>{ if(r.status===401){router.push("/login");return;} const d=await r.json(); setUser(d.user); });
    fetch("/api/admin/users").then(r=>r.json()).then(d=>{ setClients(d.users||[]); setLoading(false); });
  },[]);

  async function handleSearch(q: string) {
    setSearch(q);
    const r = await fetch(`/api/admin/users${q?`?search=${encodeURIComponent(q)}`:""}`);
    const data = await r.json();
    setClients(data.users||[]);
  }

  function timeAgo(ts: string) {
    if (!ts) return "never";
    const s = Math.floor((Date.now()-new Date(ts).getTime())/1000);
    if (s<60) return `${s}s ago`;
    if (s<3600) return `${Math.floor(s/60)}m ago`;
    if (s<86400) return `${Math.floor(s/3600)}h ago`;
    return `${Math.floor(s/86400)}d ago`;
  }

  const kybStatus = selected ? getKybStatus(selected.email) : null;
  const kybRecord = selected ? getKybRecord(selected.email) : null;

  return (<div className="min-h-screen bg-zinc-950 text-white"><DashNav user={user}/>
    <div className="flex h-[calc(100vh-44px)]">
      <div className={`flex-1 flex flex-col overflow-hidden ${selected?"lg:max-w-[60%]":""}`}>
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-3">
          <h1 className="text-lg font-black text-white flex items-center gap-2"><Users className="w-4 h-4 text-indigo-400"/>Tenant Clients</h1>
          <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs">{clients.length} clients</Badge>
          <div className="ml-auto relative"><Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2"/><Input placeholder="Search email…" value={search} onChange={e=>handleSearch(e.target.value)} className="bg-zinc-900 border-zinc-700 text-white text-xs h-7 pl-7 w-48"/></div>
        </div>
        <div className="flex-1 overflow-auto">
          {loading ? <div className="text-zinc-500 text-sm p-8">Loading…</div> : (
          clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-center">
              <Users className="w-10 h-10 text-zinc-700 mb-3"/>
              <p className="text-zinc-400 font-medium text-sm">No clients yet</p>
              <p className="text-zinc-600 text-xs mt-1 max-w-xs">Use your application API key to call <code className="font-mono bg-zinc-800 px-1 rounded">POST /api/auth/register</code> to register clients in your application.</p>
            </div>
          ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-zinc-950 border-b border-zinc-800"><tr>{["Client","KYB","Application","Client ID","MFA","Sessions","Last active",""].map(h=>(<th key={h} className="text-left px-4 py-2.5 text-zinc-500 font-medium">{h}</th>))}</tr></thead>
            <tbody>{clients.map(c=>{
              const kyb = getKybStatus(c.email);
              return (<tr key={c.id} onClick={()=>setSelected(c)} className={`border-b border-zinc-800/40 hover:bg-zinc-900 cursor-pointer ${selected?.id===c.id?"bg-zinc-900":""}`}>
                <td className="px-4 py-3"><div className="text-white font-medium">{c.display_name||c.email}</div><div className="text-zinc-500 font-mono text-[10px]">{c.email}</div></td>
                <td className="px-4 py-3">{kyb ? <Badge variant="outline" className={`text-[10px] ${kyb.cls}`}>{kyb.label}</Badge> : <span className="text-zinc-600 text-[10px]">—</span>}</td>
                <td className="px-4 py-3"><span className="text-indigo-300 text-[11px] font-medium">{c.app_name||<span className="text-zinc-600">—</span>}</span></td>
                <td className="px-4 py-3 font-mono text-zinc-500 text-[10px]">{c.id.slice(0,8)}…</td>
                <td className="px-4 py-3">{c.mfa_enabled?<ShieldCheck className="w-4 h-4 text-green-400"/>:<ShieldOff className="w-4 h-4 text-zinc-600"/>}</td>
                <td className="px-4 py-3 text-zinc-400">{c.active_sessions??0} <span className="text-zinc-600">/ {c.total_sessions??0}</span></td>
                <td className="px-4 py-3 text-zinc-500 flex items-center gap-1"><Clock className="w-3 h-3"/>{timeAgo(c.last_login_at||c.last_session_at)}</td>
                <td className="px-4 py-3 text-zinc-600">›</td>
              </tr>);
            })}</tbody>
          </table>))}
        </div>
      </div>
      {selected && (<div className="w-full lg:w-[40%] border-l border-zinc-800 bg-zinc-950 overflow-auto flex-shrink-0">
        <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 px-5 py-3 flex justify-between items-center">
          <h2 className="text-white font-semibold text-sm">Client Detail</h2>
          <button onClick={()=>setSelected(null)} className="text-zinc-500 hover:text-white text-xs cursor-pointer">✕</button>
        </div>
        <div className="p-5 space-y-4">
          {/* Avatar + identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
              {(selected.display_name||selected.email||"?")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold">{selected.display_name||"—"}</p>
              <p className="text-zinc-400 text-xs truncate">{selected.email}</p>
            </div>
            {kybStatus && (
              <Badge variant="outline" className={`text-[10px] shrink-0 ${kybStatus.cls}`}>{kybStatus.label}</Badge>
            )}
          </div>

          {/* Core fields */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800/50">
            {([
              ["Client ID", selected.id, true],
              ["Application", selected.app_name||"—"],
              ["App ID", selected.app_id||"—", true],
              ["Created", new Date(selected.created_at).toLocaleDateString()],
              ["Last seen", (selected.last_login_at||selected.last_session_at) ? new Date(selected.last_login_at||selected.last_session_at).toLocaleString() : "never"],
              ["MFA Enabled", selected.mfa_enabled?"Yes":"No"],
              ["Active sessions", String(selected.active_sessions??0)],
              ["Total sessions", String(selected.total_sessions??0)],
            ] as [string,string,boolean?][]).map(([l,v,m])=>(
              <div key={l} className="flex items-center justify-between px-3 py-1.5 gap-2">
                <span className="text-zinc-500 text-xs">{l}</span>
                <span className={`text-xs text-right truncate max-w-[60%] ${m?"font-mono text-indigo-300":"text-zinc-300"}`}>{v}</span>
              </div>
            ))}
          </div>

          {/* KYB record */}
          {kybRecord ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 space-y-1.5">
              <p className="text-zinc-500 text-[10px] uppercase tracking-wide font-semibold mb-2 flex items-center gap-1.5">
                <Building2 className="w-3 h-3"/> KYB Record
              </p>
              {[
                ["Business", kybRecord.businessName||"—"],
                ["Type", kybRecord.businessType||"—"],
                ["Risk score", kybRecord.riskScore != null ? `${kybRecord.riskScore}` : "—"],
                ["Risk level", kybRecord.riskLevel||"—"],
                ["Jurisdiction", kybRecord.jurisdiction||"—"],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between text-xs">
                  <span className="text-zinc-500">{l}</span>
                  <span className="text-zinc-300">{v}</span>
                </div>
              ))}
              <Link href="/dashboard/kyb" className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-xs mt-2">
                Open in KYB <AlertTriangle className="w-3 h-3"/>
              </Link>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-800 p-3 text-center">
              <p className="text-zinc-600 text-xs">No KYB record linked</p>
              <Link href="/dashboard/kyb" className="text-indigo-400 hover:text-indigo-300 text-xs mt-1 block">
                Add KYB record →
              </Link>
            </div>
          )}

          {/* Actions */}
          <Link href={`/dashboard/transactions?userId=${selected.id}`} className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm border border-indigo-500/30 rounded-lg px-3 py-2 hover:bg-indigo-500/5">
            <Activity className="w-4 h-4"/>View transactions for this client
          </Link>
        </div>
      </div>)}
    </div>
  </div>);
}
