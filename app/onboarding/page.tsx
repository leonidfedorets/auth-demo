"use client";
import { useState } from "react";
import Link from "next/link";
import { Shield, Check, Copy, ChevronRight, ArrowRight, Zap, Code2, Key, TestTube, Globe, Building2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const PLANS = [
  { id: "starter", name: "Starter", price: "€299/mo", mau: "10k MAU", features: ["JWT + Sessions", "Password + TOTP", "Basic risk engine", "Audit log 30d"] },
  { id: "growth", name: "Growth", price: "€999/mo", mau: "100k MAU", features: ["Everything in Starter", "WebAuthn / Passkeys", "Device attestation", "Full risk engine + SCA", "Multi-tenancy", "99.9% SLA"], recommended: true },
  { id: "enterprise", name: "Enterprise", price: "Custom", mau: "Unlimited", features: ["Everything in Growth", "On-premise option", "PCI DSS Level 1", "Custom risk rules", "Dedicated engineer"] },
];

const CODE_EXAMPLES = {
  register: `curl -X POST https://api.uth.io/v1/auth/register \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "tenantId": "YOUR_TENANT_ID"
  }'`,
  login: `curl -X POST https://api.uth.io/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "deviceFingerprint": "auto"
  }'`,
  risk: `curl -X POST https://api.uth.io/v1/risk/evaluate \\
  -H "Authorization: Bearer JWT_TOKEN" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{
    "userId": "user_id",
    "action": "login",
    "deviceFingerprint": "fp_xxx"
  }'`,
};

const STEPS = [
  { id: 1, title: "Create your account", icon: Building2, desc: "Set up your organization" },
  { id: 2, title: "Choose your plan", icon: Zap, desc: "Pick the right tier" },
  { id: 3, title: "Get API keys", icon: Key, desc: "Your credentials are ready" },
  { id: 4, title: "Install SDK", icon: Code2, desc: "Add to your project" },
  { id: 5, title: "First API call", icon: TestTube, desc: "Test the integration" },
  { id: 6, title: "Go live", icon: Globe, desc: "You're ready!" },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <button onClick={copy} className="absolute top-3 right-3 text-zinc-500 hover:text-white transition-colors cursor-pointer">
      {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [plan, setPlan] = useState("growth");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [activeCode, setActiveCode] = useState<keyof typeof CODE_EXAMPLES>("register");
  const [testResult, setTestResult] = useState<null | { ok: boolean; data: unknown }>(null);
  const [testing, setTesting] = useState(false);

  const apiKey = "as_live_k9x2mP7qN3rT8vY1wZ4uL6sE0bJ5fH";
  const tenantId = "ten_d8f3a2b1c6e9";

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: `trial+${Date.now()}@uth.io`, password: "Trial123456!" }),
      });
      const data = await r.json();
      setTestResult({ ok: r.ok, data });
    } catch (e) {
      setTestResult({ ok: false, data: { error: "Network error" } });
    }
    setTesting(false);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <nav className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-zinc-950/90 backdrop-blur z-40">
        <Link href="/" className="flex items-center gap-2 font-bold text-white"><Shield className="h-5 w-5 text-indigo-400" />UTH</Link>
        <div className="flex items-center gap-4 text-sm text-zinc-400">
          <span>Step {step} of {STEPS.length}</span>
          <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Progress */}
        <div className="mb-10">
          <div className="flex items-center gap-0">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center flex-1">
                <button
                  onClick={() => step > s.id && setStep(s.id)}
                  className={`flex flex-col items-center gap-1 cursor-pointer ${step > s.id ? "cursor-pointer" : "cursor-default"}`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                    step > s.id ? "bg-green-500 border-green-500" :
                    step === s.id ? "bg-indigo-600 border-indigo-600" :
                    "bg-zinc-900 border-zinc-700"
                  }`}>
                    {step > s.id ? <Check className="h-4 w-4 text-white" /> : <span className="text-xs font-bold text-white">{s.id}</span>}
                  </div>
                  <span className={`text-xs hidden sm:block font-medium ${step === s.id ? "text-indigo-400" : step > s.id ? "text-green-400" : "text-zinc-600"}`}>{s.title}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 transition-colors ${step > s.id ? "bg-green-500" : "bg-zinc-800"}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Create account */}
        {step === 1 && (
          <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
            <div>
              <h1 className="text-3xl font-black text-white">Create your organization</h1>
              <p className="text-zinc-400 mt-1">Takes 30 seconds. No credit card required.</p>
            </div>
            <div className="space-y-4 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="space-y-2">
                <Label className="text-zinc-300">Organization name</Label>
                <Input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Acme Corp" className="bg-zinc-800 border-zinc-700 text-white h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Work email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className="bg-zinc-800 border-zinc-700 text-white h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Password</Label>
                <Input type="password" placeholder="At least 12 characters" className="bg-zinc-800 border-zinc-700 text-white h-11" />
              </div>
              <Button onClick={() => setStep(2)} disabled={!orgName || !email} className="w-full bg-indigo-600 hover:bg-indigo-700 h-11 mt-2">
                Create account <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <p className="text-zinc-600 text-xs text-center">By signing up, you agree to our Terms & Privacy Policy</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Check className="h-4 w-4 text-green-400" /> No credit card required
              <Check className="h-4 w-4 text-green-400 ml-2" /> 14-day free trial
              <Check className="h-4 w-4 text-green-400 ml-2" /> Cancel anytime
            </div>
          </div>
        )}

        {/* Step 2: Choose plan */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h1 className="text-3xl font-black text-white">Choose your plan</h1>
              <p className="text-zinc-400 mt-1">All plans start with a 14-day free trial. Upgrade or downgrade anytime.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PLANS.map(p => (
                <button key={p.id} onClick={() => setPlan(p.id)} className={`text-left rounded-xl border p-5 transition-all cursor-pointer ${plan === p.id ? "border-indigo-500 bg-indigo-500/10" : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-600"}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{p.name}</span>
                        {p.recommended && <Badge className="bg-indigo-600 text-white border-0 text-xs">Recommended</Badge>}
                      </div>
                      <div className="text-2xl font-black text-white mt-1">{p.price}</div>
                      <div className="text-zinc-500 text-xs">{p.mau}</div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-1 ${plan === p.id ? "border-indigo-500 bg-indigo-500" : "border-zinc-600"}`}>
                      {plan === p.id && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                  </div>
                  <ul className="space-y-1.5">
                    {p.features.map(f => (
                      <li key={f} className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <Check className="h-3 w-3 text-green-400 shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setStep(1)} variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">Back</Button>
              <Button onClick={() => setStep(3)} className="bg-indigo-600 hover:bg-indigo-700">
                Continue with {PLANS.find(p2 => p2.id === plan)?.name} <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: API keys */}
        {step === 3 && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
            <div>
              <h1 className="text-3xl font-black text-white">Your API keys are ready</h1>
              <p className="text-zinc-400 mt-1">Keep these safe — you won't be able to see your secret key again.</p>
            </div>
            <div className="space-y-4">
              {[
                { label: "API Key (live)", value: apiKey, note: "Use this in all API requests" },
                { label: "Tenant ID", value: tenantId, note: "Your organization's unique identifier" },
                { label: "Webhook Secret", value: "whsec_7xK2mP9qN4rT1vY8wZ5uL3sE6bJ2fH", note: "For verifying webhook payloads" },
              ].map(item => (
                <div key={item.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                  <div className="flex items-start justify-between mb-1">
                    <Label className="text-zinc-400 text-xs">{item.label}</Label>
                    <span className="text-zinc-600 text-xs">{item.note}</span>
                  </div>
                  <div className="relative">
                    <code className="text-green-400 text-sm font-mono">{item.value}</code>
                    <CopyButton text={item.value} />
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-300 text-sm">
              Store these in environment variables, never in your code. Use <code className="bg-amber-500/20 px-1 rounded text-xs">.env.local</code> for local development.
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setStep(2)} variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">Back</Button>
              <Button onClick={() => setStep(4)} className="bg-indigo-600 hover:bg-indigo-700">
                Continue to install <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Install SDK */}
        {step === 4 && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
            <div>
              <h1 className="text-3xl font-black text-white">Install the SDK</h1>
              <p className="text-zinc-400 mt-1">Choose your language or use the REST API directly.</p>
            </div>
            <div className="space-y-4">
              {[
                { lang: "Node.js / TypeScript", cmd: "npm install @uth/sdk", pkg: "npm" },
                { lang: "Python", cmd: "pip install uth", pkg: "pip" },
                { lang: "Go", cmd: "go get github.com/uth/go-sdk", pkg: "go" },
              ].map(item => (
                <div key={item.lang} className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-900/80">
                    <span className="text-zinc-400 text-xs font-medium">{item.lang}</span>
                    <Badge variant="outline" className="text-zinc-600 border-zinc-700 text-xs h-4">{item.pkg}</Badge>
                  </div>
                  <div className="relative p-4">
                    <code className="text-green-400 font-mono text-sm">{item.cmd}</code>
                    <CopyButton text={item.cmd} />
                  </div>
                </div>
              ))}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-900/80">
                  <span className="text-zinc-400 text-xs font-medium">Environment variables</span>
                </div>
                <div className="relative p-4">
                  <pre className="text-green-400 font-mono text-sm">{`AUTH_SERVICE_API_KEY=${apiKey}
AUTH_SERVICE_TENANT_ID=${tenantId}
AUTH_SERVICE_BASE_URL=https://api.uth.io/v1`}</pre>
                  <CopyButton text={`AUTH_SERVICE_API_KEY=${apiKey}\nAUTH_SERVICE_TENANT_ID=${tenantId}\nAUTH_SERVICE_BASE_URL=https://api.uth.io/v1`} />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setStep(3)} variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">Back</Button>
              <Button onClick={() => setStep(5)} className="bg-indigo-600 hover:bg-indigo-700">
                Test your first call <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: First API call */}
        {step === 5 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h1 className="text-3xl font-black text-white">Make your first API call</h1>
              <p className="text-zinc-400 mt-1">Try registering a test user — this calls the live API.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex gap-2">
                  {(Object.keys(CODE_EXAMPLES) as (keyof typeof CODE_EXAMPLES)[]).map(k => (
                    <button key={k} onClick={() => setActiveCode(k)} className={`px-3 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${activeCode === k ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                      {k}
                    </button>
                  ))}
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                  <div className="px-4 py-2 border-b border-zinc-800 text-xs text-zinc-500 font-medium">cURL</div>
                  <div className="relative p-4">
                    <pre className="text-green-400 font-mono text-xs whitespace-pre-wrap">{CODE_EXAMPLES[activeCode]}</pre>
                    <CopyButton text={CODE_EXAMPLES[activeCode]} />
                  </div>
                </div>
                <Button onClick={runTest} disabled={testing} className="w-full bg-indigo-600 hover:bg-indigo-700 h-11">
                  {testing ? "Running..." : "Run live test →"}
                </Button>
              </div>
              <div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 h-full min-h-48 p-4">
                  <div className="text-xs text-zinc-500 font-medium mb-3">Response</div>
                  {!testResult && !testing && (
                    <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">Hit "Run live test" to see the response</div>
                  )}
                  {testing && (
                    <div className="flex items-center justify-center h-32">
                      <div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
                    </div>
                  )}
                  {testResult && (
                    <div className="space-y-2">
                      <Badge className={testResult.ok ? "bg-green-600 text-white border-0" : "bg-red-600 text-white border-0"}>
                        {testResult.ok ? "200 OK" : "Error"}
                      </Badge>
                      <pre className="text-green-400 font-mono text-xs whitespace-pre-wrap overflow-auto">{JSON.stringify(testResult.data, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setStep(4)} variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">Back</Button>
              <Button onClick={() => setStep(6)} className="bg-indigo-600 hover:bg-indigo-700">
                {testResult?.ok ? "It works! Go live →" : "Skip to finish →"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 6: Go live */}
        {step === 6 && (
          <div className="max-w-2xl mx-auto space-y-8 animate-fade-in text-center">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-400" />
              </div>
            </div>
            <div>
              <h1 className="text-4xl font-black text-white">You're all set!</h1>
              <p className="text-zinc-400 mt-2 text-lg">Your {PLANS.find(p => p.id === plan)?.name} account is active. Start building.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              {[
                { title: "Explore the platform", desc: "See every auth flow in action", href: "/platform/risk-engine", label: "Risk Engine" },
                { title: "Read the docs", desc: "Full API reference with examples", href: "#", label: "Documentation" },
                { title: "View dashboard", desc: "Monitor sessions and users", href: "/dashboard", label: "Dashboard" },
              ].map(item => (
                <Link key={item.title} href={item.href} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-indigo-500/40 hover:bg-zinc-900/80 transition-all group">
                  <div className="text-white font-semibold text-sm group-hover:text-indigo-400 transition-colors">{item.title}</div>
                  <div className="text-zinc-500 text-xs mt-1">{item.desc}</div>
                  <div className="text-indigo-400 text-xs mt-3 flex items-center gap-1">{item.label} <ChevronRight className="h-3 w-3" /></div>
                </Link>
              ))}
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-left">
              <h3 className="text-white font-semibold mb-3">Quick integration checklist</h3>
              <ul className="space-y-2">
                {[
                  "Set AUTH_SERVICE_API_KEY in your environment",
                  "Register your first real user via POST /auth/register",
                  "Implement login flow with POST /auth/login",
                  "Add risk evaluation to sensitive actions",
                  "Configure webhook endpoint for auth events",
                  "Enable MFA for admin users",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-zinc-400">
                    <div className="w-5 h-5 rounded border border-zinc-700 flex items-center justify-center shrink-0"><Check className="h-3 w-3 text-zinc-600" /></div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-center gap-4">
              <Link href="/pricing"><Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">View plans</Button></Link>
              <Link href="/platform/risk-engine"><Button className="bg-indigo-600 hover:bg-indigo-700">Explore platform <ArrowRight className="h-4 w-4 ml-2" /></Button></Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
