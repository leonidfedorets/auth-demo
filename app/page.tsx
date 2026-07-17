import Link from "next/link";
import {
  Shield, Lock, Smartphone, Activity, Key, Globe, ArrowRight,
  CheckCircle2, ChevronRight, Server, Layers, BarChart3,
  Fingerprint, Cpu, FileCheck, Users, Building2, Zap,
  ShieldCheck, AlertTriangle, CreditCard, Banknote, MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LandingNav } from "@/components/landing-nav";

function UthLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = { sm: "text-lg", md: "text-2xl", lg: "text-4xl" }[size];
  return (
    <span className={`font-black tracking-tighter ${s}`}>
      <span className="text-indigo-400">U</span>
      <span className="text-indigo-300">T</span>
      <span className="text-indigo-200">H</span>
    </span>
  );
}

const USE_CASES = [
  {
    icon: Banknote,
    title: "Fintech & Banking",
    desc: "PSD2-compliant SCA for every payment over €30. Dynamic linking binds each challenge to the exact amount and IBAN. Adaptive risk engine reduces friction for trusted users and blocks anomalies in real time.",
    tags: ["SCA / PSD2", "Dynamic linking", "Risk engine"],
  },
  {
    icon: Building2,
    title: "Enterprise SaaS",
    desc: "Multi-tenant architecture with row-level isolation. Each customer organisation gets its own API key, audit log, session store, and risk policy. WebAuthn passkeys replace passwords for employees.",
    tags: ["Multi-tenancy", "WebAuthn", "Audit log"],
  },
  {
    icon: Smartphone,
    title: "Mobile Applications",
    desc: "Apple App Attest and Android Play Integrity attestation verify that your app is genuine and the device is not rooted. Device binding ties each JWT to a cryptographically attested hardware credential.",
    tags: ["App Attest", "Play Integrity", "Device binding"],
  },
  {
    icon: ShieldCheck,
    title: "High-security Portals",
    desc: "Government, healthcare, and legal portals that require FIDO2 Level 2 hardware keys. UTH enforces ACR=gold for designated operations and rejects any weaker authentication method automatically.",
    tags: ["FIDO2 L2", "ACR enforcement", "Hardware keys"],
  },
  {
    icon: CreditCard,
    title: "E-commerce & Marketplaces",
    desc: "Passwordless checkout with passkeys. Step-up auth automatically triggered for high-value orders. Tor/VPN detection and impossible-travel signals fire without any manual configuration.",
    tags: ["Passkeys", "Step-up", "Fraud signals"],
  },
  {
    icon: Users,
    title: "B2B Platforms",
    desc: "Delegate authentication to UTH and let your team focus on product. Role-based JWT claims, webhook events for every auth action, and a full SDK for Node, Go, Python, and Java.",
    tags: ["JWT claims", "Webhooks", "SDK"],
  },
];

const BENEFITS = [
  { title: "No auth team needed", desc: "UTH ships every component your security team would build — in one API call. Stop rebuilding auth from scratch." },
  { title: "Ships in hours, not months", desc: "One endpoint for registration and login. JWT middleware SDKs for Node, Go, Python, Java. Average integration time: 4 hours." },
  { title: "Risk-adaptive by default", desc: "Every login is scored automatically. High-risk requests get challenged. Low-risk trusted users get frictionless access." },
  { title: "Compliance out of the box", desc: "PCI DSS v4.0, GDPR, PSD2/SCA, and FIDO2 L2 — covered from day one. Compliance auditors get immutable audit logs." },
  { title: "Scales with you", desc: "From 100 to 10 million users without architecture changes. UTH handles the infrastructure; you handle the product." },
  { title: "Full observability", desc: "Every auth event, risk score, SCA challenge, and device attestation result is emitted as a structured webhook event and written to the audit log." },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Create your account",
    desc: "Sign up, create your organisation, and receive your API key in under 2 minutes. No credit card required for the 14-day trial.",
    icon: Building2,
  },
  {
    step: "02",
    title: "Add one endpoint",
    desc: "Point your register and login calls to the UTH API. Install our JWT verification middleware to protect your routes. SDK available for all major languages.",
    icon: Server,
  },
  {
    step: "03",
    title: "Risk scores on every login",
    desc: "The Auth Risk Engine and Engine Risk service evaluate every event in real time — device signals, network anomalies, session behaviour, and operation context.",
    icon: Activity,
  },
  {
    step: "04",
    title: "Step-up triggers automatically",
    desc: "When risk exceeds your configured threshold, UTH issues an SCA challenge. Your users only see friction when the risk warrants it.",
    icon: Cpu,
  },
  {
    step: "05",
    title: "Full audit trail from day one",
    desc: "Every auth event, device binding, and SCA result is written to an immutable, tamper-evident audit log. PCI DSS requirement 10 is handled automatically.",
    icon: FileCheck,
  },
];

const FEATURES = [
  { icon: Key, title: "JWT & Session Management", desc: "RS256/ES256 tokens with the full claim set your backend needs — tenant, device, AMR, ACR, risk score, and SCA state.", href: "/platform/sessions", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  { icon: Fingerprint, title: "WebAuthn / Passkeys", desc: "FIDO2 Level 2 passwordless auth. Platform and cross-platform authenticators. AAGUID tracking and MDS3 metadata validation.", href: "/platform/passkeys", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  { icon: Smartphone, title: "Device Attestation", desc: "Apple App Attest, Android Play Integrity, Windows TPM. 18 signal codes, 5 status states, cryptographic device binding.", href: "/platform/device-attestation", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
  { icon: BarChart3, title: "Auth Risk Engine", desc: "Device Trust + Network & Geo layers. 9 + 2 signals. Override rules A–E. Score 0–100 with configurable weights.", href: "/platform/risk-engine", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  { icon: Layers, title: "Engine Risk · 50/50 Model", desc: "4 engine-side layers — Account, Session, Operation, SCA Quality. Consolidated with Auth Risk via the 50/50 formula.", href: "/platform/engine-risk", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  { icon: Shield, title: "SCA / PSD2 Compliance", desc: "Dynamic-linked single-use challenges. WebAuthn, TOTP, push SCA. ALLOW/DENY result. PSD2 Article 97 compliant.", href: "/platform/sca", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
];

const COMPLIANCE_MARKS = ["PCI DSS v4.0", "GDPR (EU) 2016/679", "PSD2 / SCA", "FIDO2 / WebAuthn L2", "OIDC / OAuth 2.0", "RFC 8176 (AMR)", "RFC 6711 (ACR)"];
const STATS = [
  { value: "<2ms", label: "P99 auth latency" },
  { value: "99.99%", label: "Uptime SLA" },
  { value: "18", label: "Attestation signals" },
  { value: "0", label: "Auth team needed" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Navigation */}
      <LandingNav />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs text-indigo-300 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          PCI DSS v4.0 certified · Demo
        </div>
        <h1 className="text-6xl font-black tracking-tight mb-6 leading-[1.08]">
          Stop building auth.<br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-300 bg-clip-text text-transparent">Start shipping product.</span>
        </h1>
        <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          <strong className="text-white">UTH</strong> is the authentication infrastructure layer your team should not be building. JWT sessions, passkeys, device attestation, adaptive risk scoring, and PSD2 SCA — one API, any stack, live in hours.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/onboarding">
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 h-12 px-8 text-base">
              Start free — 14 days <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <Link href="/pricing">
            <Button size="lg" variant="outline" className="h-12 px-8 text-base border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white">
              From €10/month
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-zinc-600 text-sm">No credit card required · Cancel any time · GDPR-compliant from day one</p>
        <div className="mt-12 flex flex-wrap justify-center gap-2">
          {COMPLIANCE_MARKS.map(c => (
            <div key={c} className="flex items-center gap-1.5 rounded-full border border-white/8 bg-white/4 px-3 py-1 text-xs text-zinc-500">
              <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />{c}
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-white/8 bg-zinc-900/40">
        <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-black text-white">{s.value}</div>
              <div className="text-zinc-500 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* What is UTH */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs mb-4">What is UTH?</Badge>
            <h2 className="text-4xl font-black text-white mb-5">Authentication as a service — the right way.</h2>
            <p className="text-zinc-400 text-lg leading-relaxed mb-6">
              UTH (Unified Token Hub) is a complete authentication backend. It handles every aspect of your auth layer so your engineering team can focus on business logic.
            </p>
            <p className="text-zinc-400 leading-relaxed mb-6">
              Unlike generic auth providers, UTH was designed from the ground up for regulated industries — fintech, banking, healthcare, and enterprise SaaS — where compliance is not optional and security incidents are not acceptable.
            </p>
            <div className="space-y-3">
              {[
                "Full JWT lifecycle — issue, rotate, revoke, inspect",
                "Passwordless with WebAuthn / FIDO2 Level 2",
                "Hardware-grade device trust with App Attest & TPM",
                "Adaptive risk scoring with no configuration required",
                "PSD2 SCA with dynamic linking for every payment",
                "Immutable audit log for PCI DSS compliance",
              ].map(item => (
                <div key={item} className="flex items-center gap-2.5 text-sm text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />{item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-zinc-900 p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono mb-2">
              <div className="w-2 h-2 rounded-full bg-green-400" /> POST /v1/auth/login
            </div>
            <pre className="text-sm text-zinc-300 font-mono leading-relaxed overflow-auto">{`// One call. Everything handled.
const res = await fetch(
  "https://api.uth.example.com/v1/auth/login",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.UTH_API_KEY,
    },
    body: JSON.stringify({
      email,
      password,
      deviceFingerprint: fp,
    }),
  }
);

const {
  accessToken,   // RS256 JWT
  risk,          // { score: 8, level: "low" }
  scaRequired,   // false — risk too low
} = await res.json();

// JWT contains:
// amr, acr, risk, risk_lvl, sid, did, dfp
// sca, sca_method, tid, roles`}</pre>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-zinc-900/40 border-y border-white/8 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs mb-4">How it works</Badge>
            <h2 className="text-4xl font-black text-white mb-3">Live in under an hour.</h2>
            <p className="text-zinc-400 text-lg max-w-xl mx-auto">No custom auth logic. No security audits on your side. No on-call rotation for auth incidents.</p>
          </div>
          <div className="grid md:grid-cols-5 gap-4">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.step} className="relative">
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden md:block absolute top-6 left-full w-full h-px bg-gradient-to-r from-indigo-500/30 to-transparent z-10" />
                )}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 h-full">
                  <div className="text-3xl font-black text-white/5 mb-3 leading-none">{step.step}</div>
                  <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 inline-flex mb-3">
                    <step.icon className="w-4 h-4 text-indigo-400" />
                  </div>
                  <h3 className="font-bold text-white text-sm mb-1.5">{step.title}</h3>
                  <p className="text-zinc-500 text-xs leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs mb-4">Platform</Badge>
          <h2 className="text-4xl font-black text-white mb-3">Everything auth. Nothing else.</h2>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">Every component built to production spec — not a wrapper, not a prototype.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(f => (
            <Link key={f.title} href={f.href} className="group">
              <div className={`h-full rounded-2xl border ${f.border} ${f.bg} p-6 hover:border-opacity-60 transition-all hover:shadow-lg`}>
                <div className={`inline-flex p-2.5 rounded-xl ${f.bg} border ${f.border} mb-4`}>
                  <f.icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <h3 className="font-bold text-white text-base mb-2 group-hover:text-indigo-300 transition-colors">{f.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
                <div className={`mt-5 flex items-center gap-1 text-xs ${f.color} opacity-70 group-hover:opacity-100 transition-opacity`}>
                  Explore <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Use cases */}
      <section id="use-cases" className="bg-zinc-900/40 border-y border-white/8 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs mb-4">Use cases</Badge>
            <h2 className="text-4xl font-black text-white mb-3">When should you use UTH?</h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">Any time building auth from scratch would slow you down or put users at risk.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {USE_CASES.map(uc => (
              <div key={uc.title} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <div className="p-2.5 rounded-xl bg-zinc-800 inline-flex mb-4">
                  <uc.icon className="w-5 h-5 text-indigo-400" />
                </div>
                <h3 className="font-bold text-white text-base mb-2">{uc.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed mb-4">{uc.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {uc.tags.map(t => (
                    <span key={t} className="rounded-full border border-zinc-700 bg-zinc-800 text-zinc-400 text-xs px-2.5 py-0.5">{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 flex items-start gap-4">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-white mb-1">When NOT to use UTH</h4>
              <p className="text-zinc-400 text-sm">UTH is an authentication layer, not an authorisation framework. If you need fine-grained permissions, attribute-based access control, or a full IAM suite, you will want to pair UTH with a dedicated authorisation service. UTH issues JWT claims that your authorisation layer can read.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs mb-4">Benefits</Badge>
          <h2 className="text-4xl font-black text-white mb-3">Why teams choose UTH.</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {BENEFITS.map(b => (
            <div key={b.title} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
              <CheckCircle2 className="w-5 h-5 text-indigo-400 mb-3" />
              <h3 className="font-bold text-white mb-2">{b.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* JWT token showcase */}
      <section className="bg-zinc-900/40 border-y border-white/8 py-24">
        <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs mb-4">Token design</Badge>
            <h2 className="text-4xl font-black text-white mb-4">Every auth signal in one token.</h2>
            <p className="text-zinc-400 text-lg mb-6 leading-relaxed">
              UTH JWTs carry the full context of every authentication event — device binding, risk score, SCA status, AMR, and ACR — so your backend never needs to call a secondary service to make an access decision.
            </p>
            <div className="space-y-3">
              {[
                ["AMR / ACR", "RFC 8176 method references and assurance class"],
                ["Risk embedded", "Live score and level baked into every token"],
                ["SCA claim", "PSD2 SCA completion status and method"],
                ["Device binding", "Attested device ID and fingerprint hash"],
                ["Tenant isolation", "Tenant ID scoped to every token"],
              ].map(([label, desc]) => (
                <div key={label} className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                  <div><span className="text-white font-medium text-sm">{label}</span><span className="text-zinc-500 text-sm"> — {desc}</span></div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-zinc-900 p-6 overflow-auto">
            <div className="flex gap-1.5 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
              <span className="ml-2 text-zinc-600 text-xs font-mono">JWT payload · decoded</span>
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

      {/* Pricing CTA */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 bg-indigo-500/10 text-xs mb-6">Simple pricing</Badge>
        <h2 className="text-4xl font-black text-white mb-4">Start for €10/month. Scale without surprises.</h2>
        <p className="text-zinc-400 text-lg mb-8">Starter at €10/mo · Growth at €50/mo · Enterprise custom pricing. All plans include a 14-day free trial.</p>
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
        <p className="mt-6 text-zinc-600 text-xs tracking-wide">PCI DSS v4.0 · GDPR · PSD2/SCA · FIDO2 L2 · OIDC/OAuth 2.0</p>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8 bg-zinc-900/30">
        <div className="max-w-6xl mx-auto px-6 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <span className="font-black text-white text-xs">UTH</span>
              </div>
              <UthLogo size="sm" />
            </div>
            <p className="text-zinc-500 text-xs leading-relaxed mb-4">Authentication infrastructure for production teams.</p>
          </div>
          {[
            { heading: "Platform", links: [["Sessions & JWT", "/platform/sessions"], ["WebAuthn / Passkeys", "/platform/passkeys"], ["Device Attestation", "/platform/device-attestation"], ["Risk Engine", "/platform/risk-engine"], ["Engine Risk", "/platform/engine-risk"], ["SCA / PSD2", "/platform/sca"]] },
            { heading: "Product", links: [["Pricing", "/pricing"], ["Onboarding", "/onboarding"], ["Docs", "/docs"], ["Changelog", "/changelog"], ["Status", "/status"]] },
            { heading: "Legal", links: [["Privacy Policy", "/privacy"], ["Cookie Policy", "/cookies"], ["GDPR", "/gdpr"], ["Terms & Conditions", "/terms"], ["DPA", "/dpa"], ["Security", "/security"]] },
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
        <div className="border-t border-white/8 px-6 py-5 max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-zinc-700 text-xs">UTH — Authentication Infrastructure · Demo build</p>
        </div>
      </footer>
    </div>
  );
}
