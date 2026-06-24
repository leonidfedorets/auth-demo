import Link from "next/link";
import {
  Shield, Lock, Smartphone, Activity, Key, Globe, ArrowRight,
  CheckCircle2, Zap, ChevronRight, Server, Layers, BarChart3,
  Fingerprint, Cpu, FileCheck, GitBranch, Users, Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const NAV_LINKS = [
  { label: "Platform", href: "/platform" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
];

const FEATURES = [
  {
    icon: Key,
    title: "JWT & Session Management",
    desc: "RS256/ES256 signed tokens with full claim set — tenant, session, device, AMR, ACR, risk score, and SCA state. Configurable TTL and rotation.",
    href: "/platform/sessions",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  {
    icon: Fingerprint,
    title: "WebAuthn / Passkeys",
    desc: "FIDO2 Level 2 passwordless authentication. Platform and cross-platform authenticators. AAGUID tracking and MDS3 metadata validation.",
    href: "/platform/passkeys",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
  },
  {
    icon: Smartphone,
    title: "Device Attestation",
    desc: "Apple App Attest, Android Play Integrity, Windows TPM/Health Attest. 18 signal codes, 5 status states, cryptographic binding to JWTs.",
    href: "/platform/device-attestation",
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
  },
  {
    icon: BarChart3,
    title: "Auth Risk Engine",
    desc: "Device Trust Layer (9 signals) + Network & Geo Layer (2 signals). Override rules A–E. Score 0–100 with configurable thresholds and weights.",
    href: "/platform/risk-engine",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
  },
  {
    icon: Layers,
    title: "Engine Risk & 50/50 Model",
    desc: "4 engine-side layers — Account Integrity, Session/Behavior, Operation Risk, SCA Quality. Consolidated with Auth Risk via 50/50 formula.",
    href: "/platform/engine-risk",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
  },
  {
    icon: Shield,
    title: "SCA / PSD2 Compliance",
    desc: "Dynamic-linked single-use challenges. WebAuthn, TOTP, and push-based SCA. ALLOW/DENY result. PSD2 Article 97 compliant with exemption engine.",
    href: "/platform/sca",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
  },
];

const COMPLIANCE_MARKS = [
  "PCI DSS v4.0",
  "GDPR (EU) 2016/679",
  "PSD2 / SCA",
  "FIDO2 / WebAuthn L2",
  "OIDC / OAuth 2.0",
  "RFC 8176 (AMR)",
  "RFC 6711 (ACR)",
];

const STATS = [
  { value: "<2ms", label: "P99 auth latency" },
  { value: "99.99%", label: "Uptime SLA" },
  { value: "18", label: "Attestation signals" },
  { value: "50/50", label: "Risk consolidation" },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Integrate the API",
    desc: "One REST endpoint for registration and login. Drop-in JWT verification middleware available for Node, Go, Python, and Java.",
    icon: Server,
  },
  {
    step: "02",
    title: "Risk scored on every request",
    desc: "The Auth Risk Engine and Engine Risk service evaluate every authentication event in real time. No configuration required to get started.",
    icon: Activity,
  },
  {
    step: "03",
    title: "Adaptive step-up triggers automatically",
    desc: "When risk exceeds your configured thresholds, SCA challenges are issued automatically. Users only see friction when it is warranted.",
    icon: Cpu,
  },
  {
    step: "04",
    title: "Full audit trail from day one",
    desc: "Every auth event, risk evaluation, SCA challenge, and device binding is written to an immutable audit log. PCI DSS ready out of the box.",
    icon: FileCheck,
  },
];

const TENANT_FEATURES = [
  "Row-level tenant isolation in Postgres",
  "Per-tenant risk weight overrides",
  "Per-tenant SCA policy configuration",
  "Webhook delivery per tenant",
  "API key scoped to tenant",
  "Separate audit log streams",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Navigation */}
      <nav className="border-b border-white/8 px-6 py-4 flex items-center justify-between sticky top-0 bg-zinc-950/90 backdrop-blur-xl z-50">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            <span className="font-bold text-white tracking-tight">AuthService</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(l => (
              <Link key={l.label} href={l.href} className="text-sm text-zinc-400 hover:text-white transition-colors">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
              Sign in
            </Button>
          </Link>
          <Link href="/onboarding">
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Get started <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs text-indigo-300 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          SOC 2 Type II audit in progress · PCI DSS v4.0 certified
        </div>
        <h1 className="text-6xl font-black tracking-tight mb-6 leading-tight">
          <span className="text-white">Authentication</span>
          <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
            infrastructure for production.
          </span>
        </h1>
        <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Complete auth stack — JWT sessions, passkeys, device attestation, adaptive risk scoring, and PSD2 SCA — delivered as a single API. No auth team required.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/onboarding">
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 h-12 px-8 text-base">
              Start free — 14 days <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <Link href="/pricing">
            <Button size="lg" variant="outline" className="h-12 px-8 text-base border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white">
              See pricing
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-zinc-600 text-sm">No credit card required · Cancel any time · GDPR-compliant from day one</p>

        {/* Compliance marks */}
        <div className="mt-12 flex flex-wrap justify-center gap-2">
          {COMPLIANCE_MARKS.map(c => (
            <div key={c} className="flex items-center gap-1.5 rounded-full border border-white/8 bg-white/4 px-3 py-1 text-xs text-zinc-500">
              <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
              {c}
            </div>
          ))}
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-white/8 bg-zinc-900/50">
        <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-black text-white">{s.value}</div>
              <div className="text-zinc-500 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs mb-4">Platform</Badge>
          <h2 className="text-4xl font-black text-white mb-3">Everything auth, nothing else.</h2>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Every component is built to production spec — not a wrapper around another library, not a prototype.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(f => (
            <Link key={f.title} href={f.href} className="group">
              <div className={`h-full rounded-2xl border ${f.border} ${f.bg} p-6 hover:border-opacity-60 transition-all duration-200 hover:shadow-lg`}>
                <div className={`inline-flex p-2.5 rounded-xl ${f.bg} border ${f.border} mb-4`}>
                  <f.icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <h3 className="font-bold text-white text-base mb-2 group-hover:text-indigo-300 transition-colors">{f.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
                <div className={`mt-5 flex items-center gap-1 text-xs ${f.color} opacity-70 group-hover:opacity-100 transition-opacity`}>
                  Learn more <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-zinc-900/40 border-y border-white/8 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs mb-4">Integration</Badge>
            <h2 className="text-4xl font-black text-white mb-3">Live in under an hour.</h2>
            <p className="text-zinc-400 text-lg max-w-xl mx-auto">No custom auth logic. No security audits. No on-call rotation for auth incidents.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map(step => (
              <div key={step.step} className="relative">
                <div className="text-5xl font-black text-white/5 mb-4 leading-none">{step.step}</div>
                <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 inline-flex mb-3">
                  <step.icon className="w-5 h-5 text-indigo-400" />
                </div>
                <h3 className="font-bold text-white mb-2">{step.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* JWT claims showcase */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs mb-4">Token design</Badge>
            <h2 className="text-4xl font-black text-white mb-4">Every auth signal, in one token.</h2>
            <p className="text-zinc-400 text-lg mb-6 leading-relaxed">
              AuthService JWTs carry the full context of each authentication event — device binding, risk score, SCA status, AMR, and ACR — so your backend never needs to call a secondary service.
            </p>
            <div className="space-y-3">
              {[
                { label: "AMR / ACR", desc: "RFC 8176 method references and assurance class" },
                { label: "Risk embedded", desc: "Live score and level baked into every token" },
                { label: "SCA claim", desc: "PSD2 SCA completion status and method" },
                { label: "Device binding", desc: "Attested device ID and fingerprint hash" },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-white font-medium text-sm">{item.label}</span>
                    <span className="text-zinc-500 text-sm"> — {item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-zinc-900 p-6 overflow-auto">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
              <span className="ml-2 text-zinc-600 text-xs font-mono">access_token.payload</span>
            </div>
            <pre className="text-sm text-zinc-300 leading-relaxed font-mono">{`{
  "sub": "usr_019200ab-f3c2-...",
  "email": "alex@company.com",
  "tid": "ten_acme-corp",
  "sid": "ses_4f8a9c2d...",

  "did": "dev_a3f9c4b1...",
  "dfp": "8e3a1b7f9c2d...",

  "amr": ["hwk", "pin"],
  "acr": "gold",

  "risk": 8,
  "risk_lvl": "low",

  "sca": true,
  "sca_method": "webauthn",

  "roles": ["user"],
  "iat": 1719187200,
  "exp": 1719188100
}`}</pre>
          </div>
        </div>
      </section>

      {/* Multi-tenancy */}
      <section className="bg-zinc-900/40 border-y border-white/8 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="grid grid-cols-2 gap-4">
              {TENANT_FEATURES.map(f => (
                <div key={f} className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                  <span className="text-zinc-300 text-sm">{f}</span>
                </div>
              ))}
            </div>
            <div>
              <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs mb-4">Multi-tenancy</Badge>
              <h2 className="text-4xl font-black text-white mb-4">Built for SaaS from day one.</h2>
              <p className="text-zinc-400 text-lg mb-6 leading-relaxed">
                Row-level tenant isolation means every customer's data, sessions, and audit logs are completely separated at the database level — not just filtered in application code.
              </p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Users className="w-4 h-4 text-indigo-400" />
                  Up to unlimited tenants on Enterprise
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing CTA */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 bg-indigo-500/10 text-xs mb-6">Pricing</Badge>
        <h2 className="text-4xl font-black text-white mb-4">Start in minutes. Scale without friction.</h2>
        <p className="text-zinc-400 text-lg mb-8">
          Starter from €299/month. Full platform access from day one. Upgrade as you grow.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/onboarding">
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 h-12 px-8 text-base">
              Start free trial <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <Link href="/pricing">
            <Button size="lg" variant="outline" className="h-12 px-8 text-base border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white">
              Compare plans
            </Button>
          </Link>
        </div>
        <p className="mt-6 text-zinc-600 text-xs tracking-wide">
          PCI DSS v4.0 · GDPR · PSD2/SCA · FIDO2 L2 · OIDC/OAuth 2.0
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8 py-12 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-indigo-400" />
              <span className="font-bold text-white text-sm">AuthService</span>
            </div>
            <p className="text-zinc-500 text-xs leading-relaxed">Enterprise authentication infrastructure. Built for teams that cannot afford to get security wrong.</p>
          </div>
          {[
            { heading: "Platform", links: [["Sessions & JWT", "/platform/sessions"], ["WebAuthn", "/platform/passkeys"], ["Device Attestation", "/platform/device-attestation"], ["Risk Engine", "/platform/risk-engine"]] },
            { heading: "Product", links: [["Pricing", "/pricing"], ["Onboarding", "/onboarding"], ["Changelog", "/changelog"], ["Status", "/status"]] },
            { heading: "Legal", links: [["Privacy Policy", "/privacy"], ["Terms of Service", "/terms"], ["DPA", "/dpa"], ["Security", "/security"]] },
          ].map(col => (
            <div key={col.heading}>
              <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-4">{col.heading}</h4>
              <ul className="space-y-2">
                {col.links.map(([label, href]) => (
                  <li key={label}><Link href={href} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">{label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="max-w-6xl mx-auto border-t border-white/8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-zinc-600 text-xs">© 2025 AuthService. All rights reserved.</p>
          <p className="text-zinc-700 text-xs">Built by <a href="https://github.com/leonidfedorets" className="hover:text-zinc-500 transition-colors">Leonid Fedorets</a></p>
        </div>
      </footer>
    </div>
  );
}
