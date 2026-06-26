"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, Search, ShieldCheck, ShieldOff, Clock, Activity } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

function DashNav({ user }: { user: any }) {
  return (<nav className="border-b border-zinc-800 px-6 py-3 flex items-center gap-4 bg-zinc-950 sticky top-0 z-40">
    <Link href="/" className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center"><span className="font-black text-white text-[10px]">UTH</span></div><span className="font-black text-sm tracking-tighter"><span className="text-indigo-400">U</span><span className="text-indigo-300">T</span><span className="text-indigo-200">H</span></span></Link>
    <span className="text-zinc-600">/</span><Link href="/dashboard" className="text-zinc-500 hover:text-white text-sm">Dashboard</Link>
    <span className="text-zinc-600">/</span><span className="text-zinc-400 text-sm">Users</span>
    <div className="ml-auto text-xs text-zinc-500">{user?.email}</div>
  </nav>);
}

const RISK_COLORS: Record<string,string> = { low:"text-green-400",medium:"text-yellow-400",high:"text-orange-400",critical:"text-red-400" };

export default function UsersPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);

  useEffect(()=>{
    fetch("/api/auth/me").then(async r=>{ if(r.status===401){router.push("/login");return;} const d=await r.json(); setUser(d.user); });
    fetch("/api/admin/users").then(r=>r.json()).then(d=>{ setUsers(d.users||[]); setLoading(false); });
  },[]);

  async function handleSearch(q: string) {
    setSearch(q);
    const r = await fetch(`/api/admin/users${q?`?search=${encodeURIComponent(q)}`:""}`);
    const data = await r.json();
    setUsers(data.users||[]);
  }

  function timeAgo(ts: string) {
    if (!ts) return "never";
    const s = Math.floor((Date.now()-new Date(ts).getTime())/1000);
    if (s<60) return `${s}s ago`;
    if (s<3600) return `${Math.floor(s/60)}m ago`;
    if (s<86400) return `${Math.floor(s/3600)}h ago`;
    return `${Math.floor(s/86400)}d ago`;
  }

  return (<div className="min-h-screen bg-zinc-950 text-white"><DashNav user={user}/>
    <div className="flex h-[calc(100vh-49px)]">
      <div className={`flex-1 flex flex-col overflow-hidden ${selected?"lg:max-w-[60%]":""}`}>
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-3">
          <h1 className="text-lg font-black text-white flex items-center gap-2"><Users className="w-4 h-4 text-indigo-400"/>Tenant Users</h1>
          <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs">{users.length} users</Badge>
          <div className="ml-auto relative"><Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2"/><Input placeholder="Search email…" value={search} onChange={e=>handleSearch(e.target.value)} className="bg-zinc-900 border-zinc-700 text-white text-xs h-7 pl-7 w-48"/></div>
        </div>
        <div className="flex-1 overflow-auto">
          {loading ? <div className="text-zinc-500 text-sm p-8">Loading…</div> : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-zinc-950 border-b border-zinc-800"><tr>{["User","MFA","Sessions","Last active","Risk",""].map(h=>(<th key={h} className="text-left px-4 py-2.5 text-zinc-500 font-medium">{h}</th>))}</tr></thead>
            <tbody>{users.map(u=>(<tr key={u.id} onClick={()=>setSelected(u)} className={`border-b border-zinc-800/40 hover:bg-zinc-900 cursor-pointer ${selected?.id===u.id?"bg-zinc-900":""}`}>
              <td className="px-4 py-3"><div className="text-white font-medium">{u.display_name||u.email}</div><div className="text-zinc-500 font-mono text-[10px]">{u.email}</div></td>
              <td className="px-4 py-3">{u.mfa_enabled||u.totp_enabled?<ShieldCheck className="w-4 h-4 text-green-400"/>:<ShieldOff className="w-4 h-4 text-zinc-600"/>}</td>
              <td className="px-4 py-3 text-zinc-400">{u.active_sessions??u.total_sessions??0}</td>
              <td className="px-4 py-3 text-zinc-500 flex items-center gap-1"><Clock className="w-3 h-3"/>{timeAgo(u.last_login_at||u.last_session_at||u.last_seen)}</td>
              <td className="px-4 py-3"><span className={`font-medium capitalize ${RISK_COLORS[u.last_risk]||"text-zinc-400"}`}>{u.last_risk||"—"}</span></td>
              <td className="px-4 py-3 text-zinc-600">›</td>
            </tr>))}</tbody>
          </table>)}
        </div>
      </div>
      {selected && (<div className="w-full lg:w-[40%] border-l border-zinc-800 bg-zinc-950 overflow-auto flex-shrink-0">
        <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 px-5 py-3 flex justify-between items-center"><h2 className="text-white font-semibold text-sm">User Detail</h2><button onClick={()=>setSelected(null)} className="text-zinc-500 hover:text-white text-xs">✕</button></div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">{(selected.display_name||selected.email||"?")[0].toUpperCase()}</div><div><p className="text-white font-semibold">{selected.display_name||"—"}</p><p className="text-zinc-400 text-xs">{selected.email}</p></div></div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800/50">
            {[["User ID",selected.id,true],["Tenant",selected.tenant_id||"default",true],["Created",new Date(selected.created_at).toLocaleDateString()],["Last seen",(selected.last_login_at||selected.last_session_at||selected.last_seen)?new Date(selected.last_login_at||selected.last_session_at||selected.last_seen).toLocaleString():"never"],["MFA Enabled",selected.mfa_enabled||selected.totp_enabled?"Yes":"No"],["TOTP",selected.totp_enabled?"Enrolled":"Not enrolled"],["Sessions",String(selected.total_sessions??0)],["Last risk",selected.last_risk||"—"]].map(([l,v,m])=>(<div key={String(l)} className="flex items-center justify-between px-3 py-1.5 gap-2"><span className="text-zinc-500 text-xs">{l}</span><span className={`text-xs text-right truncate ${m?"font-mono text-indigo-300":"text-zinc-300"}`}>{String(v)}</span></div>))}
          </div>
          <Link href={`/dashboard/transactions?userId=${selected.id}`} className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm border border-indigo-500/30 rounded-lg px-3 py-2 hover:bg-indigo-500/5"><Activity className="w-4 h-4"/>View transactions for this user</Link>
        </div>
      </div>)}
    </div>
  </div>);
}
