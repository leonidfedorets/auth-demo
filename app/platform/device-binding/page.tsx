"use client";
import { useState } from "react";
import Link from "next/link";
import { Link2, ShieldCheck, Unlink, RefreshCw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

function UthNav() {
  return (<nav className="border-b border-zinc-800 px-6 py-3 flex items-center gap-4 bg-zinc-950"><Link href="/" className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center"><span className="font-black text-white text-[10px]">UTH</span></div><span className="font-black text-sm tracking-tighter"><span className="text-indigo-400">U</span><span className="text-indigo-300">T</span><span className="text-indigo-200">H</span></span></Link><span className="text-zinc-600">/</span><span className="text-zinc-400 text-sm">Device Binding</span><div className="ml-auto flex gap-3"><Link href="/platform/device-attestation" className="text-zinc-500 hover:text-white text-xs">Attestation</Link><Link href="/dashboard" className="text-zinc-500 hover:text-white text-xs">Dashboard</Link></div></nav>);
}

type DeviceState = "unbound"|"pending"|"bound"|"suspended"|"revoked";

export default function DeviceBindingPage() {
  const [userId, setUserId] = useState("user-abc-123");
  const [fingerprint, setFingerprint] = useState("a1b2c3d4e5f6");
  const [deviceState, setDeviceState] = useState<DeviceState>("unbound");
  const [log, setLog] = useState<{ts:string,action:string,from:string,to:string}[]>([]);
  const [loading, setLoading] = useState(false);

  function addLog(action:string, from: DeviceState, to: DeviceState) {
    setLog(l=>[{ts:new Date().toISOString(),action,from,to},...l]);
  }

  async function generateFp() {
    const parts = [navigator.userAgent, navigator.language, screen.width, screen.height];
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parts.join("|")));
    setFingerprint(Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("").slice(0,16));
  }

  function bind() { addLog("bind",deviceState,"bound"); setDeviceState("bound"); }
  function suspend() { addLog("suspend",deviceState,"suspended"); setDeviceState("suspended"); }
  function reinstate() { addLog("reinstate",deviceState,"bound"); setDeviceState("bound"); }
  function revoke() { addLog("revoke",deviceState,"revoked"); setDeviceState("revoked"); }
  function reset() { addLog("reset",deviceState,"unbound"); setDeviceState("unbound"); }

  const stateColor: Record<DeviceState,string> = { unbound:"text-zinc-400",pending:"text-yellow-400",bound:"text-green-400",suspended:"text-orange-400",revoked:"text-red-400" };
  const stateBg: Record<DeviceState,string> = { unbound:"bg-zinc-800",pending:"bg-yellow-500/15",bound:"bg-green-500/15",suspended:"bg-orange-500/15",revoked:"bg-red-500/15" };

  return (<div className="min-h-screen bg-zinc-950 text-white"><UthNav />
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-8"><div className="p-2 rounded-lg bg-blue-500/15"><Link2 className="w-5 h-5 text-blue-400" /></div><div><h1 className="text-2xl font-black text-white">Device Binding</h1><p className="text-zinc-400 text-sm">Lifecycle: unbound → pending → bound → suspended / revoked</p></div></div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
            <h3 className="text-white font-semibold text-sm">Device Identity</h3>
            <div><Label className="text-zinc-400 text-xs mb-1 block">User ID</Label><Input value={userId} onChange={e=>setUserId(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white font-mono text-sm"/></div>
            <div><Label className="text-zinc-400 text-xs mb-1 block">Device Fingerprint</Label><div className="flex gap-2"><Input value={fingerprint} onChange={e=>setFingerprint(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white font-mono text-sm"/><Button size="sm" onClick={generateFp} variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white shrink-0"><RefreshCw className="w-3 h-3"/></Button></div></div>
          </div>
          <div className={`rounded-xl border border-zinc-800 p-5 ${stateBg[deviceState]}`}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-white font-semibold text-sm">Current State</h3><span className={`text-xl font-black uppercase ${stateColor[deviceState]}`}>{deviceState}</span></div>
            <div className="flex flex-wrap gap-2">
              {deviceState==="unbound" && <Button size="sm" onClick={bind} className="bg-green-600 hover:bg-green-700 flex items-center gap-1"><Plus className="w-3 h-3"/>Bind</Button>}
              {deviceState==="bound" && (<><Button size="sm" onClick={suspend} className="bg-orange-600 hover:bg-orange-700">Suspend</Button><Button size="sm" onClick={revoke} className="bg-red-600 hover:bg-red-700 flex items-center gap-1"><Unlink className="w-3 h-3"/>Revoke</Button></>)}
              {deviceState==="suspended" && (<><Button size="sm" onClick={reinstate} className="bg-green-600 hover:bg-green-700">Reinstate</Button><Button size="sm" onClick={revoke} className="bg-red-600 hover:bg-red-700">Revoke</Button></>)}
              {(deviceState==="revoked"||deviceState==="bound") && <Button size="sm" onClick={reset} variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white">Reset</Button>}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-mono text-xs space-y-1 text-zinc-400">
            <p><span className="text-zinc-500">userId: </span><span className="text-indigo-300">{userId}</span></p>
            <p><span className="text-zinc-500">fingerprint: </span><span className="text-indigo-300">{fingerprint}</span></p>
            <p><span className="text-zinc-500">state: </span><span className={stateColor[deviceState]}>{deviceState}</span></p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><h3 className="text-white text-xs font-semibold mb-3 uppercase tracking-wide">State Lifecycle</h3>
            <div className="space-y-2 text-xs">{[["unbound","No binding exists → bind via POST /api/devices"],["pending","Binding created, awaiting OTP confirmation"],["bound","Device fully trusted, fingerprint stored"],["suspended","Temporarily restricted, can be reinstated"],["revoked","Permanent revocation, requires re-bind flow"]].map(([s,d])=>(<div key={s} className="flex gap-2"><span className={`font-mono w-20 shrink-0 ${stateColor[s as DeviceState]}`}>{s}</span><span className="text-zinc-500">{d}</span></div>))}</div>
          </div>
          {log.length>0 && (<div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><h3 className="text-white text-xs font-semibold mb-3 uppercase tracking-wide">Event Log</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">{log.map((e,i)=>(<div key={i} className="text-xs flex gap-2 border-b border-zinc-800/50 py-1"><span className="text-zinc-600 font-mono">{e.ts.slice(11,19)}</span><span className="text-zinc-400">{e.action}</span><span className="text-zinc-600">{e.from}→{e.to}</span></div>))}</div>
          </div>)}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><h3 className="text-white text-xs font-semibold mb-2 uppercase tracking-wide">API</h3>
            <div className="space-y-1 text-xs font-mono">{[["POST","Register device + get fingerprint"],["GET","List bound devices for user"],["PATCH","Update state (suspend/revoke/reinstate)"],["DELETE","Hard delete device binding"]].map(([m,d])=>(<div key={d} className="flex gap-2 text-zinc-400"><span className="text-blue-400">{m}</span><span>/api/devices — {d}</span></div>))}</div>
          </div>
        </div>
      </div>
    </div>
  </div>);
}
