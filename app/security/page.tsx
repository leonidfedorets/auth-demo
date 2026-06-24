import Link from "next/link";
import { Shield, Lock, Eye, RefreshCw, Server, FileText } from "lucide-react";
const MEASURES = [
  { icon: Lock, title: "Encryption at rest and in transit", body: "All data is encrypted at rest using AES-256 and in transit using TLS 1.3. JWT tokens use RS256 (RSA-2048) signing keys rotated every 90 days." },
  { icon: Shield, title: "Zero-trust session model", body: "Short-lived access tokens (15 min TTL), refresh token rotation, device-bound session binding. No long-lived cookies." },
  { icon: Eye, title: "Immutable audit log", body: "Every authentication event, risk decision, and SCA challenge is written to an append-only audit log with cryptographic chaining. Exportable for SIEM integration." },
  { icon: RefreshCw, title: "Penetration testing", body: "UTH undergoes annual third-party penetration testing. Customers on Enterprise plans may request the latest pentest executive summary under NDA." },
  { icon: Server, title: "Infrastructure security", body: "Hosted on Vercel Edge Network with Neon Postgres (SOC 2 Type II) and Upstash Redis. All sub-processors are contractually bound via DPA with SCCs." },
  { icon: FileText, title: "Vulnerability disclosure", body: "We operate a responsible disclosure programme. Report security vulnerabilities to security@empatixtech.com. We aim to acknowledge within 24 hours and patch within 72 hours for critical severity." },
];
export default function SecurityPage() {
  return (<div className="min-h-screen bg-zinc-950 text-white">
    <nav className="border-b border-white/8 px-6 py-4 flex items-center justify-between sticky top-0 bg-zinc-950/90 backdrop-blur-xl z-50"><Link href="/" className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center"><span className="font-black text-white text-xs">UTH</span></div><span className="font-black tracking-tighter text-lg"><span className="text-indigo-400">U</span><span className="text-indigo-300">T</span><span className="text-indigo-200">H</span></span></Link></nav>
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-12"><div className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Trust · Empatixtech</div><h1 className="text-4xl font-black text-white mb-3">Security at UTH</h1><p className="text-zinc-400 text-lg">Authentication infrastructure that protects your users and your business.</p></div>
      <div className="grid gap-5 mb-12">{MEASURES.map(m => (<div key={m.title} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex gap-4"><div className="p-2 rounded-lg bg-indigo-600/15 h-fit"><m.icon className="w-5 h-5 text-indigo-400" /></div><div><h3 className="font-semibold text-white mb-1">{m.title}</h3><p className="text-zinc-400 text-sm leading-relaxed">{m.body}</p></div></div>))}</div>
      <div className="rounded-xl border border-indigo-500/30 bg-indigo-600/10 p-6 text-center"><h3 className="font-semibold text-white mb-1">Report a vulnerability</h3><p className="text-zinc-400 text-sm mb-3">Contact our security team at <a href="mailto:security@empatixtech.com" className="text-indigo-400 hover:underline">security@empatixtech.com</a></p><p className="text-zinc-500 text-xs">PGP key available on request · We do not pursue legal action against researchers acting in good faith</p></div>
    </div>
    <footer className="border-t border-white/8 px-6 py-6 text-center text-zinc-600 text-xs">© 2025 Empatixtech. <Link href="/" className="hover:text-zinc-400 ml-1">← Back to UTH</Link></footer>
  </div>);
}
