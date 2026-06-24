"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, X, Zap, Shield, Building2, ChevronRight, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    icon: Zap,
    price: { monthly: 299, annual: 249 },
    mau: "10,000 MAU",
    rps: "100 req/s",
    description: "For startups and early-stage products that need solid auth without complexity.",
    color: "from-blue-500/20 to-blue-600/5",
    border: "border-blue-500/30",
    badge: null,
    cta: "Start free trial",
    features: [
      { label: "JWT / Session management", included: true },
      { label: "Password + TOTP login", included: true },
      { label: "Basic risk engine (IP/geo)", included: true },
      { label: "Audit log (30 days)", included: true },
      { label: "Single tenant", included: true },
      { label: "GDPR data export", included: true },
      { label: "WebAuthn / Passkeys", included: false },
      { label: "Device attestation", included: false },
      { label: "Full risk engine (all layers)", included: false },
      { label: "SCA / PSD2 compliance", included: false },
      { label: "Multi-tenancy", included: false },
      { label: "SLA / Uptime guarantee", included: false },
    ],
  },
  {
    id: "growth",
    name: "Growth",
    icon: Shield,
    price: { monthly: 999, annual: 829 },
    mau: "100,000 MAU",
    rps: "500 req/s",
    description: "Full security stack for scaling products with compliance requirements.",
    color: "from-indigo-500/20 to-indigo-600/5",
    border: "border-indigo-500/50",
    badge: "Most popular",
    cta: "Start free trial",
    features: [
      { label: "JWT / Session management", included: true },
      { label: "Password + TOTP login", included: true },
      { label: "Basic risk engine (IP/geo)", included: true },
      { label: "Audit log (90 days)", included: true },
      { label: "Up to 5 tenants", included: true },
      { label: "GDPR data export", included: true },
      { label: "WebAuthn / Passkeys", included: true },
      { label: "Device attestation (iOS/Android/Web)", included: true },
      { label: "Full risk engine (all 5 layers)", included: true },
      { label: "SCA / PSD2 compliance", included: true },
      { label: "Multi-tenancy", included: true },
      { label: "99.9% SLA", included: true },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    icon: Building2,
    price: { monthly: null, annual: null },
    mau: "Unlimited MAU",
    rps: "Unlimited",
    description: "Custom deployment with dedicated support, on-prem option, and full compliance audit.",
    color: "from-amber-500/20 to-amber-600/5",
    border: "border-amber-500/30",
    badge: null,
    cta: "Contact sales",
    features: [
      { label: "Everything in Growth", included: true },
      { label: "Unlimited tenants", included: true },
      { label: "Audit log (unlimited)", included: true },
      { label: "On-premise deployment", included: true },
      { label: "Custom risk rules (CEL)", included: true },
      { label: "Engine Risk integration", included: true },
      { label: "Kafka event streaming", included: true },
      { label: "FIDO2 metadata (MDS3)", included: true },
      { label: "PCI DSS Level 1 report", included: true },
      { label: "Dedicated support engineer", included: true },
      { label: "Custom SLA (99.99%)", included: true },
      { label: "Security architecture review", included: true },
    ],
  },
];

const COMPARE_ROWS = [
  { section: "Authentication", rows: [
    { label: "Password login", s: true, g: true, e: true },
    { label: "TOTP / Authenticator app", s: true, g: true, e: true },
    { label: "WebAuthn / Passkeys (FIDO2 L2)", s: false, g: true, e: true },
    { label: "Push notification MFA", s: false, g: true, e: true },
    { label: "Email OTP", s: true, g: true, e: true },
    { label: "Recovery codes", s: true, g: true, e: true },
  ]},
  { section: "Risk Engine", rows: [
    { label: "IP / Geo anomaly (Auth Risk)", s: true, g: true, e: true },
    { label: "Device Trust Layer", s: false, g: true, e: true },
    { label: "Network & Geo Layer", s: true, g: true, e: true },
    { label: "Account Integrity Layer", s: false, g: true, e: true },
    { label: "Session / Behavior Layer", s: false, g: true, e: true },
    { label: "Operation Risk Layer", s: false, g: true, e: true },
    { label: "SCA Quality Layer", s: false, g: true, e: true },
    { label: "50/50 Auth+Engine consolidation", s: false, g: false, e: true },
    { label: "Custom CEL rules", s: false, g: false, e: true },
  ]},
  { section: "Device Attestation", rows: [
    { label: "Browser fingerprint", s: true, g: true, e: true },
    { label: "Apple App Attest", s: false, g: true, e: true },
    { label: "Android Play Integrity", s: false, g: true, e: true },
    { label: "Windows TPM / Health Attest", s: false, g: true, e: true },
    { label: "Attestation status model (5 states)", s: false, g: true, e: true },
  ]},
  { section: "SCA / PSD2", rows: [
    { label: "TOTP step-up", s: false, g: true, e: true },
    { label: "WebAuthn SCA challenge", s: false, g: true, e: true },
    { label: "Dynamic linking", s: false, g: true, e: true },
    { label: "SCA challenge lifecycle (Kafka)", s: false, g: false, e: true },
    { label: "PSD2 compliance report", s: false, g: false, e: true },
  ]},
  { section: "Compliance", rows: [
    { label: "GDPR right to erasure", s: true, g: true, e: true },
    { label: "GDPR data portability", s: true, g: true, e: true },
    { label: "Immutable audit log (PCI DSS)", s: true, g: true, e: true },
    { label: "PCI DSS v4.0 Level 1 report", s: false, g: false, e: true },
    { label: "SOC 2 Type II", s: false, g: false, e: true },
  ]},
];

const FAQ = [
  { q: "How does MAU billing work?", a: "Monthly Active Users are counted per calendar month. A user is counted once regardless of how many times they authenticate. Overages are charged at a flat per-user rate." },
  { q: "Can I switch plans mid-month?", a: "Yes. Upgrades take effect immediately and are pro-rated. Downgrades take effect at the next billing cycle." },
  { q: "Is the free trial credit-card free?", a: "Yes. The 14-day trial requires no credit card. You get full access to the tier features you choose." },
  { q: "Do you offer on-premise deployment?", a: "Yes, for Enterprise customers. We support Docker, Kubernetes, and bare-metal deployment with Go binary releases." },
  { q: "How do I integrate with my existing user database?", a: "The Auth Service supports BYOD (Bring Your Own Database) — you can federate your existing PostgreSQL users via our migration endpoint or use our webhook to sync." },
  { q: "What is the 50/50 risk model?", a: "FinalRiskScore = (AuthRiskScore × 0.5) + (EngineRiskScore × 0.5). Auth Risk evaluates device and network signals; Engine Risk evaluates account, session, operation, and SCA quality signals." },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-zinc-950/90 backdrop-blur z-40">
        <Link href="/" className="flex items-center gap-2 font-bold text-white"><Shield className="h-5 w-5 text-indigo-400" />AuthService</Link>
        <div className="flex items-center gap-4">
          <Link href="/platform/risk-engine" className="text-zinc-400 hover:text-white text-sm transition-colors">Platform</Link>
          <Link href="/onboarding"><Button className="bg-indigo-600 hover:bg-indigo-700 h-8 text-sm">Get started</Button></Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-16 space-y-20">
        {/* Header */}
        <div className="text-center space-y-4">
          <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 bg-indigo-500/10 text-xs px-3 py-1">Transparent pricing</Badge>
          <h1 className="text-5xl font-black text-white tracking-tight">Simple, predictable pricing</h1>
          <p className="text-zinc-400 text-xl max-w-2xl mx-auto">Start with a 14-day free trial. No credit card required. Cancel any time.</p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Label className="text-zinc-400 text-sm">Monthly</Label>
            <Switch checked={annual} onCheckedChange={setAnnual} />
            <Label className="text-zinc-300 text-sm">Annual <span className="text-green-400 font-semibold">save 17%</span></Label>
          </div>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map(plan => (
            <div key={plan.id} className={`relative rounded-2xl border ${plan.border} bg-gradient-to-b ${plan.color} backdrop-blur p-6 flex flex-col`}>
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-indigo-600 text-white border-0 px-4 py-0.5 text-xs">{plan.badge}</Badge>
                </div>
              )}
              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg bg-zinc-800`}><plan.icon className="h-5 w-5 text-indigo-400" /></div>
                  <div>
                    <h2 className="text-white font-bold text-lg">{plan.name}</h2>
                    <p className="text-zinc-400 text-xs">{plan.mau} · {plan.rps}</p>
                  </div>
                </div>
                <div>
                  {plan.price.monthly ? (
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-black text-white">€{annual ? plan.price.annual : plan.price.monthly}</span>
                      <span className="text-zinc-400 text-sm mb-1">/mo</span>
                    </div>
                  ) : (
                    <div className="text-3xl font-black text-white">Custom</div>
                  )}
                </div>
                <p className="text-zinc-400 text-sm">{plan.description}</p>
                <ul className="space-y-2">
                  {plan.features.map(f => (
                    <li key={f.label} className="flex items-start gap-2 text-sm">
                      {f.included ? <Check className="h-4 w-4 text-green-400 mt-0.5 shrink-0" /> : <X className="h-4 w-4 text-zinc-600 mt-0.5 shrink-0" />}
                      <span className={f.included ? "text-zinc-300" : "text-zinc-600"}>{f.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-6">
                <Link href={plan.id === "enterprise" ? "mailto:sales@auth-service.io" : "/onboarding"}>
                  <Button className={`w-full h-11 ${plan.id === "growth" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-zinc-800 hover:bg-zinc-700 text-white"}`}>
                    {plan.cta} <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Feature comparison */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-8 text-center">Full feature comparison</h2>
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900">
                  <th className="text-left px-6 py-4 text-zinc-400 font-medium">Feature</th>
                  {PLANS.map(p => <th key={p.id} className="text-center px-4 py-4 text-white font-semibold">{p.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map(section => (
                  <>
                    <tr key={section.section} className="bg-zinc-900/60 border-t border-zinc-800">
                      <td colSpan={4} className="px-6 py-2 text-xs text-zinc-500 uppercase tracking-widest font-semibold">{section.section}</td>
                    </tr>
                    {section.rows.map(row => (
                      <tr key={row.label} className="border-t border-zinc-800/50 hover:bg-zinc-900/30 transition-colors">
                        <td className="px-6 py-3 text-zinc-300">{row.label}</td>
                        {[row.s, row.g, row.e].map((v, i) => (
                          <td key={i} className="text-center px-4 py-3">
                            {v ? <Check className="h-4 w-4 text-green-400 mx-auto" /> : <X className="h-4 w-4 text-zinc-700 mx-auto" />}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">Frequently asked questions</h2>
          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <div key={i} className="rounded-xl border border-zinc-800 overflow-hidden">
                <button className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-zinc-900/50 transition-colors cursor-pointer" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span className="text-white font-medium">{item.q}</span>
                  <ChevronRight className={`h-4 w-4 text-zinc-400 transition-transform ${openFaq === i ? "rotate-90" : ""}`} />
                </button>
                {openFaq === i && <div className="px-6 pb-4 text-zinc-400 text-sm leading-relaxed border-t border-zinc-800 pt-3">{item.a}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center rounded-2xl border border-indigo-500/30 bg-indigo-600/10 p-12 space-y-4">
          <h2 className="text-3xl font-black text-white">Ready to secure your product?</h2>
          <p className="text-zinc-400">Start your 14-day free trial today. No credit card, no contracts.</p>
          <Link href="/onboarding">
            <Button className="bg-indigo-600 hover:bg-indigo-700 h-12 px-8 text-base mt-2">
              Start free trial <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
          <p className="text-zinc-600 text-xs">PCI DSS v4.0 · GDPR · PSD2/SCA · FIDO2 L2 · OIDC/OAuth 2.0</p>
        </div>
      </div>
    </div>
  );
}
