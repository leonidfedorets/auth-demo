import Link from "next/link";
import { Shield, Lock, Smartphone, Activity, Key, Globe, ArrowRight, CheckCircle2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const features = [
  { icon: Key, title: "JWT + Sessions", desc: "RS256/ES256 tokens with configurable claims — sid, did, amr, acr, risk score, SCA state", href: "/dashboard", color: "text-blue-400" },
  { icon: Lock, title: "WebAuthn / Passkeys", desc: "FIDO2 passwordless authentication — register and use platform authenticators in your browser", href: "/demo/webauthn", color: "text-purple-400" },
  { icon: Smartphone, title: "Device Attestation", desc: "18 signal codes · 5 status states · Apple App Attest · Play Integrity · Windows TPM", href: "/demo/attestation", color: "text-green-400" },
  { icon: Activity, title: "Auth Risk Engine", desc: "Device Trust Layer (9 signals) + Network & Geo (2 signals). Override rules A–E. Score 0–100.", href: "/demo/auth-risk", color: "text-yellow-400" },
  { icon: Shield, title: "Engine Risk (50/50)", desc: "4 engine layers + 50/50 consolidation with Auth Risk. FinalScore = (AuthRisk + EngineRisk) / 2", href: "/demo/engine-risk", color: "text-orange-400" },
  { icon: Globe, title: "SCA / PSD2", desc: "Dynamic linking, single-use challenges, WebAuthn SCA, TOTP step-up. ALLOW/DENY result.", href: "/demo/sca-service", color: "text-red-400" },
];

const compliance = ["PCI DSS v4.0", "GDPR (EU) 2016/679", "PSD2 / SCA", "FIDO2 / WebAuthn L2", "OIDC / OAuth 2.0", "RFC 8176 (AMR)", "RFC 6711 (ACR)"];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between sticky top-0 bg-gray-950/80 backdrop-blur-xl z-50">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-400" />
          <span className="font-bold text-lg">Auth Service</span>
          <Badge variant="secondary" className="text-xs">Demo</Badge>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/pricing" className="text-gray-400 hover:text-white text-sm transition-colors">Pricing</Link>
          <Link href="/demo/auth-risk" className="text-gray-400 hover:text-white text-sm transition-colors">Demo</Link>
          <Link href="/login"><Button variant="ghost" size="sm">Sign In</Button></Link>
          <Link href="/onboarding"><Button size="sm">Get Started</Button></Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <Badge className="mb-6 bg-blue-500/10 text-blue-400 border-blue-500/20">Enterprise Authentication SaaS</Badge>
        <h1 className="text-6xl font-bold tracking-tight mb-6 bg-gradient-to-br from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
          Auth Service<br />Built for Production
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
          Complete authentication platform — JWT, passkeys, device attestation, adaptive risk scoring, and PSD2 SCA. Drop in as SaaS. Works on web, mobile, and desktop.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/register">
            <Button size="lg" className="gap-2">Try Live Demo <ArrowRight className="w-4 h-4" /></Button>
          </Link>
          <Link href="https://github.com/leonidfedorets/auth-service" target="_blank">
            <Button size="lg" variant="outline" className="gap-2">View Source</Button>
          </Link>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {compliance.map(c => (
            <Badge key={c} variant="outline" className="text-xs text-gray-400 border-white/10">
              <CheckCircle2 className="w-3 h-3 mr-1 text-green-400" />{c}
            </Badge>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(f => (
            <Link key={f.title} href={f.href} className="group">
              <div className="h-full rounded-xl border border-white/10 bg-white/5 p-6 hover:bg-white/8 hover:border-white/20 transition-all duration-200">
                <f.icon className={`w-8 h-8 mb-4 ${f.color}`} />
                <h3 className="font-semibold text-lg mb-2 group-hover:text-blue-300 transition-colors">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
                <div className="mt-4 flex items-center gap-1 text-xs text-gray-500 group-hover:text-blue-400 transition-colors">
                  Try it live <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* JWT Claims showcase */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="rounded-xl border border-white/10 bg-gray-900/50 p-8">
          <div className="flex items-center gap-2 mb-6">
            <Zap className="w-5 h-5 text-yellow-400" />
            <h2 className="text-xl font-semibold">Fully Configurable JWT Claims</h2>
          </div>
          <pre className="text-sm text-gray-300 overflow-x-auto leading-relaxed">
{`{
  "sub": "019200ab-...",          // user ID
  "email": "user@company.com",
  "tid": "acme-corp",            // tenant ID
  "sid": "session-uuid",         // session binding
  "did": "device-uuid",          // device binding (attestation)
  "dfp": "a3f9...",              // device fingerprint hash

  "amr": ["pwd", "totp"],        // Authentication Method References (RFC 8176)
  "acr": "urn:mace:incommon:iap:silver",  // Authentication Class Reference

  "risk": 12,                    // risk score 0-100
  "risk_lvl": "low",             // adaptive risk level

  "sca": true,                   // PSD2 SCA completed
  "sca_method": "totp",

  "roles": ["user"],
  "custom": { "org_id": "acme" } // per-tenant custom claims
}`}
          </pre>
        </div>
      </section>

      {/* Pricing CTA */}
      <section className="max-w-4xl mx-auto px-6 pb-24 text-center">
        <div className="rounded-2xl border border-indigo-500/30 bg-indigo-600/10 p-12 space-y-4">
          <h2 className="text-3xl font-black text-white">Ready to integrate?</h2>
          <p className="text-gray-400">Start free for 14 days. No credit card required. Starter from €299/mo.</p>
          <div className="flex items-center justify-center gap-4 pt-2">
            <Link href="/onboarding">
              <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700">
                Start free trial <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10">View pricing</Button>
            </Link>
          </div>
          <p className="text-gray-600 text-xs">PCI DSS v4.0 · GDPR · PSD2/SCA · FIDO2 L2</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-sm text-gray-500">
        <p>Built by <a href="https://github.com/leonidfedorets" className="text-blue-400 hover:underline">Leonid Fedorets</a> · 
        <a href="https://github.com/leonidfedorets/auth-service" className="text-blue-400 hover:underline ml-1">GitHub</a></p>
      </footer>
    </div>
  );
}
