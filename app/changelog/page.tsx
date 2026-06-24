import Link from "next/link";
const RELEASES = [
  { version: "1.3.0", date: "2025-06-01", badge: "latest", items: ["Engine Risk 50/50 consolidation formula GA", "FIDO2 MDS3 metadata service integration", "Custom CEL risk rules (Enterprise)", "Kafka event streaming for SCA challenges"] },
  { version: "1.2.0", date: "2025-04-15", badge: null, items: ["WebAuthn / Passkeys support (FIDO2 L2)", "Device Attestation: iOS App Attest + Android Play Integrity", "SCA / PSD2 dynamic linking with IBAN/amount binding", "Audit log immutability hardening (append-only)"] },
  { version: "1.1.0", date: "2025-02-28", badge: null, items: ["Auth Risk Engine: Device Trust Layer (9 signals)", "Network & Geo Layer: IP reputation + ASN check", "Auth Risk override rules A–E", "GDPR data erasure API endpoint"] },
  { version: "1.0.0", date: "2025-01-10", badge: null, items: ["Initial platform release", "JWT session management (HS256/RS256)", "Password + TOTP authentication", "Basic IP/Geo risk check", "Multi-tenant onboarding"] },
];
export default function ChangelogPage() {
  return (<div className="min-h-screen bg-zinc-950 text-white">
    <nav className="border-b border-white/8 px-6 py-4 flex items-center justify-between sticky top-0 bg-zinc-950/90 backdrop-blur-xl z-50"><Link href="/" className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center"><span className="font-black text-white text-xs">UTH</span></div><span className="font-black tracking-tighter text-lg"><span className="text-indigo-400">U</span><span className="text-indigo-300">T</span><span className="text-indigo-200">H</span></span></Link></nav>
    <div className="max-w-2xl mx-auto px-6 py-16">
      <div className="mb-12"><div className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Product</div><h1 className="text-4xl font-black text-white mb-3">Changelog</h1><p className="text-zinc-400">What's new in UTH.</p></div>
      <div className="space-y-8">{RELEASES.map(r => (<div key={r.version} className="relative pl-5 border-l border-zinc-800"><div className="absolute -left-1.5 top-1 w-3 h-3 rounded-full bg-indigo-600" /><div className="flex items-center gap-2.5 mb-2"><span className="text-white font-bold">v{r.version}</span>{r.badge && <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded">{r.badge}</span>}<span className="text-zinc-500 text-sm">{r.date}</span></div><ul className="space-y-1">{r.items.map(i => (<li key={i} className="text-zinc-400 text-sm before:content-['—'] before:mr-2 before:text-zinc-600">{i}</li>))}</ul></div>))}</div>
    </div>
    <footer className="border-t border-white/8 px-6 py-6 text-center text-zinc-600 text-xs">© 2025 Empatixtech. <Link href="/" className="hover:text-zinc-400 ml-1">← Back to UTH</Link></footer>
  </div>);
}
