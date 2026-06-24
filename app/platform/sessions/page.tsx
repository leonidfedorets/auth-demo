"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, LogOut, Clock, Globe, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function UthNav() {
  return (<nav className="border-b border-zinc-800 px-6 py-3 flex items-center gap-4 bg-zinc-950"><Link href="/" className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center"><span className="font-black text-white text-[10px]">UTH</span></div><span className="font-black text-sm tracking-tighter"><span className="text-indigo-400">U</span><span className="text-indigo-300">T</span><span className="text-indigo-200">H</span></span></Link><span className="text-zinc-600">/</span><span className="text-zinc-400 text-sm">Sessions</span><div className="ml-auto flex gap-3"><Link href="/dashboard" className="text-zinc-500 hover:text-white text-xs">Dashboard</Link></div></nav>);
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    fetch("/api/sessions").then(r=>r.json()).then(d=>{ setSessions(d.sessions||[]); setLoading(false); }).catch(()=>setLoading(false));
  },[]);

  async function revokeSession(sid: string) {
    await fetch("/api/sessions", { method: "DELETE", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ sessionId: sid }) });
    setSessions(s=>s.filter(x=>x.sid!==sid));
  }

  return (<div className="min-h-screen bg-zinc-950 text-white"><UthNav />
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-8"><div className="p-2 rounded-lg bg-indigo-500/15"><Activity className="w-5 h-5 text-indigo-400"/></div><div><h1 className="text-2xl font-black text-white">Active Sessions</h1><p className="text-zinc-400 text-sm">JWT sessions with device + risk binding</p></div></div>
      {loading ? <div className="text-zinc-500 text-sm">Loading…</div> : sessions.length===0 ? (<div className="rounded-xl border border-dashed border-zinc-800 p-12 text-center"><Activity className="w-8 h-8 text-zinc-700 mx-auto mb-3"/><p className="text-zinc-500">No active sessions. <Link href="/login" className="text-indigo-400 hover:underline">Sign in</Link> to see your session.</p></div>) : (
        <div className="space-y-3">{sessions.map((s:any)=>(<div key={s.sid} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"><div className="flex items-start justify-between"><div className="space-y-1"><p className="text-white font-mono text-xs">{s.sid}</p><div className="flex gap-2 flex-wrap"><Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">ACR: {s.acr}</Badge><Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">Risk: {s.risk_lvl||"low"}</Badge>{s.sca&&<Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">SCA</Badge>}</div></div><Button size="sm" onClick={()=>revokeSession(s.sid)} variant="outline" className="border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-400"><LogOut className="w-3 h-3 mr-1"/>Revoke</Button></div></div>))}</div>
      )}
    </div>
  </div>);
}
