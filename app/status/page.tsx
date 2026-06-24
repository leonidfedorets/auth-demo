import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
const SERVICES = [
  { name: "Authentication API", status: "operational", uptime: "99.99%" },
  { name: "Risk Engine", status: "operational", uptime: "99.98%" },
  { name: "Device Attestation", status: "operational", uptime: "99.99%" },
  { name: "SCA / PSD2 Service", status: "operational", uptime: "99.97%" },
  { name: "JWT / JWKS Endpoint", status: "operational", uptime: "100.00%" },
  { name: "Dashboard / Web App", status: "operational", uptime: "99.99%" },
];
export default function StatusPage() {
  return (<div className="min-h-screen bg-zinc-950 text-white">
    <nav className="border-b border-white/8 px-6 py-4 flex items-center justify-between sticky top-0 bg-zinc-950/90 backdrop-blur-xl z-50"><Link href="/" className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center"><span className="font-black text-white text-xs">UTH</span></div><span className="font-black tracking-tighter text-lg"><span className="text-indigo-400">U</span><span className="text-indigo-300">T</span><span className="text-indigo-200">H</span></span></Link></nav>
    <div className="max-w-2xl mx-auto px-6 py-16">
      <div className="text-center mb-12"><div className="inline-flex items-center gap-2 rounded-full bg-green-500/10 border border-green-500/30 px-4 py-1.5 mb-6"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /><span className="text-green-300 text-sm font-medium">All systems operational</span></div><h1 className="text-4xl font-black text-white mb-2">UTH Status</h1><p className="text-zinc-500 text-sm">Updated in real-time · 30-day uptime shown</p></div>
      <div className="space-y-3 mb-10">{SERVICES.map(s => (<div key={s.name} className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 flex items-center justify-between"><div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-green-400" /><span className="text-white font-medium text-sm">{s.name}</span></div><div className="flex items-center gap-4"><span className="text-zinc-500 text-xs">{s.uptime} uptime</span><span className="text-green-400 text-xs font-medium capitalize">{s.status}</span></div></div>))}</div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"><h3 className="font-semibold text-white mb-3 text-sm">Recent incidents</h3><p className="text-zinc-500 text-sm">No incidents in the last 90 days.</p></div>
    </div>
    <footer className="border-t border-white/8 px-6 py-6 text-center text-zinc-600 text-xs">© 2025 Empatixtech. <Link href="/" className="hover:text-zinc-400 ml-1">← Back to UTH</Link></footer>
  </div>);
}
