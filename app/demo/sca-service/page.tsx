"use client";
import { useState } from "react";
import Link from "next/link";
import { Shield, Play, Key, CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SCA_METHODS = [
  { id: "webauthn", label: "WebAuthn / Passkey", desc: "Hardware key or biometric. ACR=gold. PSD2-compliant.", strength: 100, psd2: true },
  { id: "totp", label: "TOTP Authenticator", desc: "Time-based OTP from authenticator app. ACR=silver.", strength: 80, psd2: true },
  { id: "push", label: "Push Notification", desc: "Mobile push with dynamic linking. ACR=silver.", strength: 75, psd2: true },
  { id: "email_otp", label: "Email OTP", desc: "6-digit code via email. ACR=bronze. Not recommended for SCA.", strength: 40, psd2: false },
];

const LIFECYCLE_STEPS = [
  { id: 1, label: "Operation triggers SCA", desc: "Payment of €1,250.00 to IBAN DE89370400440532013000 triggers PSD2 SCA requirement.", icon: "1" },
  { id: 2, label: "Challenge issued", desc: "SCA challenge created with unique challenge_id, dynamic linking payload, and 10-minute TTL.", icon: "2" },
  { id: 3, label: "User authenticates", desc: "User completes chosen SCA method. Challenge is bound to the specific operation — signing a different amount fails.", icon: "3" },
  { id: 4, label: "Challenge verified", desc: "Server verifies signature, checks TTL, marks challenge as consumed (single-use).", icon: "4" },
  { id: 5, label: "SCA result: ALLOW / DENY", desc: "If verified: ALLOW + SCA JWT claim set. If failed or expired: DENY. No retry on same challenge.", icon: "5" },
];

function StepFlow() {
  const [active, setActive] = useState(0);
  return (
    <div className="space-y-3">
      {LIFECYCLE_STEPS.map((step, i) => (
        <div key={step.id} className={`rounded-xl border p-4 cursor-pointer transition-all ${active === i ? "border-indigo-500/40 bg-indigo-500/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"}`} onClick={() => setActive(i)}>
          <div className="flex items-start gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${active === i ? "bg-indigo-600 text-white" : i < active ? "bg-green-600 text-white" : "bg-zinc-800 text-zinc-400"}`}>{step.icon}</div>
            <div>
              <div className={`font-medium text-sm ${active === i ? "text-white" : "text-zinc-400"}`}>{step.label}</div>
              {active === i && <p className="text-zinc-400 text-xs mt-1">{step.desc}</p>}
            </div>
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setActive(Math.max(0, active - 1))} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800" disabled={active === 0}>← Back</Button>
        <Button size="sm" onClick={() => setActive(Math.min(LIFECYCLE_STEPS.length - 1, active + 1))} className="bg-indigo-600 hover:bg-indigo-700" disabled={active === LIFECYCLE_STEPS.length - 1}>Next →</Button>
      </div>
    </div>
  );
}

export default function SCAServicePage() {
  const [method, setMethod] = useState("webauthn");
  const [amount, setAmount] = useState("1250.00");
  const [iban, setIban] = useState("DE89370400440532013000");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [result, setResult] = useState<null | { result: "ALLOW" | "DENY"; scaMethod: string; challengeId: string; jwtClaims?: { sca: boolean; sca_method: string; acr: string } }>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<"init" | "challenge" | "done">("init");

  async function issueChallenge() {
    setLoading(true);
    try {
      const r = await fetch("/api/sca/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, amount, iban, currency: "EUR" }),
      });
      const data = await r.json();
      setChallengeId(data.challengeId ?? `sca_${Date.now().toString(36)}`);
      setStage("challenge");
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function verifyChallenge() {
    setLoading(true);
    try {
      const r = await fetch("/api/sca/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, method, otp, amount, iban }),
      });
      const data = await r.json();
      setResult(data);
      setStage("done");
    } catch { /* ignore */ }
    setLoading(false);
  }

  function reset() { setChallengeId(null); setResult(null); setOtp(""); setStage("init"); }

  const selectedMethod = SCA_METHODS.find(m => m.id === method);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <nav className="border-b border-zinc-800 px-6 py-4 flex items-center gap-4 sticky top-0 bg-zinc-950/90 backdrop-blur z-40">
        <Link href="/" className="flex items-center gap-2 font-bold text-white"><Shield className="h-5 w-5 text-indigo-400" />AuthService</Link>
        <span className="text-zinc-700">/</span>
        <span className="text-zinc-400 text-sm">SCA Service</span>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-6">
          <Badge variant="outline" className="border-green-500/40 text-green-300 bg-green-500/10 text-xs mb-2">SCA Service · PSD2</Badge>
          <h1 className="text-3xl font-black text-white">SCA Service Demo</h1>
          <p className="text-zinc-400 mt-1">Strong Customer Authentication. Single-use challenge with dynamic linking. Result: ALLOW or DENY only.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Tabs defaultValue="flow">
              <TabsList className="bg-zinc-900 border border-zinc-800">
                <TabsTrigger value="flow" className="text-xs">Live Flow</TabsTrigger>
                <TabsTrigger value="lifecycle" className="text-xs">Challenge Lifecycle</TabsTrigger>
                <TabsTrigger value="methods" className="text-xs">SCA Methods</TabsTrigger>
              </TabsList>

              <TabsContent value="flow" className="mt-4 space-y-4">
                {stage === "init" && (
                  <>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
                      <h3 className="text-white font-semibold">1. Configure payment operation</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-zinc-400 text-xs">Amount (EUR)</Label>
                          <Input value={amount} onChange={e => setAmount(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white font-mono" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-zinc-400 text-xs">Beneficiary IBAN</Label>
                          <Input value={iban} onChange={e => setIban(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white font-mono text-sm" />
                        </div>
                      </div>
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-300 text-xs">
                        PSD2 Article 97: SCA required for electronic payments. Dynamic linking binds the SCA challenge to this exact amount and IBAN.
                      </div>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
                      <h3 className="text-white font-semibold">2. Choose SCA method</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {SCA_METHODS.map(m => (
                          <button key={m.id} onClick={() => setMethod(m.id)} className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${method === m.id ? "border-indigo-500/40 bg-indigo-500/10" : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"}`}>
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-sm font-medium text-white">{m.label}</span>
                              {m.psd2 ? <Badge className="bg-green-600 text-white border-0 text-xs">PSD2</Badge> : <Badge className="bg-zinc-700 text-zinc-300 border-0 text-xs">Weak</Badge>}
                            </div>
                            <p className="text-zinc-500 text-xs">{m.desc}</p>
                            <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${m.strength}%` }} />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button onClick={issueChallenge} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 h-11">
                      <Key className="h-4 w-4 mr-2" />{loading ? "Issuing challenge..." : "Issue SCA Challenge"}
                    </Button>
                  </>
                )}

                {stage === "challenge" && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="h-4 w-4 text-indigo-400" />
                        <span className="text-indigo-300 font-semibold">Challenge issued</span>
                        <Badge className="bg-indigo-600 text-white border-0 text-xs">TTL: 10 min</Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-zinc-400">Challenge ID</span><code className="text-indigo-300 font-mono text-xs">{challengeId}</code></div>
                        <div className="flex justify-between"><span className="text-zinc-400">Amount</span><span className="text-white">€{amount}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-400">IBAN</span><code className="text-white font-mono text-xs">{iban}</code></div>
                        <div className="flex justify-between"><span className="text-zinc-400">Method</span><span className="text-white">{selectedMethod?.label}</span></div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
                      <h3 className="text-white font-semibold">3. Complete authentication</h3>
                      {(method === "totp" || method === "email_otp") ? (
                        <div className="space-y-2">
                          <Label className="text-zinc-400 text-xs">Enter 6-digit code (use 123456 for demo)</Label>
                          <Input value={otp} onChange={e => setOtp(e.target.value)} placeholder="123456" maxLength={6} className="bg-zinc-800 border-zinc-700 text-white font-mono text-xl tracking-widest text-center h-14" />
                        </div>
                      ) : (
                        <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4 text-center space-y-2">
                          <Shield className="h-8 w-8 text-indigo-400 mx-auto" />
                          <p className="text-zinc-300 text-sm">{method === "webauthn" ? "Tap your security key or use biometric" : "Check your mobile device for push notification"}</p>
                          <p className="text-zinc-600 text-xs">Click verify to simulate success in demo</p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button onClick={reset} variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"><RefreshCw className="h-4 w-4" /></Button>
                        <Button onClick={verifyChallenge} disabled={loading || (method === "totp" || method === "email_otp" ? otp.length < 6 : false)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 h-11">
                          {loading ? "Verifying..." : "Verify →"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {stage === "done" && result && (
                  <div className="space-y-4">
                    <div className={`rounded-xl border p-6 text-center ${result.result === "ALLOW" ? "border-green-500/30 bg-green-500/10" : "border-red-500/30 bg-red-500/10"}`}>
                      {result.result === "ALLOW" ? <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" /> : <XCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />}
                      <div className={`text-4xl font-black mb-1 ${result.result === "ALLOW" ? "text-green-400" : "text-red-400"}`}>{result.result}</div>
                      <p className="text-zinc-400 text-sm">{result.result === "ALLOW" ? "SCA completed. Payment authorized. Challenge consumed (single-use)." : "SCA failed or challenge expired. Payment denied. No retry on same challenge."}</p>
                    </div>
                    {result.result === "ALLOW" && result.jwtClaims && (
                      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                        <h4 className="text-zinc-400 text-xs font-semibold mb-3 uppercase tracking-wider">JWT Claims Added</h4>
                        <pre className="text-green-400 font-mono text-xs">{JSON.stringify(result.jwtClaims, null, 2)}</pre>
                      </div>
                    )}
                    <Button onClick={reset} className="w-full bg-zinc-800 hover:bg-zinc-700 h-11 text-white"><RefreshCw className="h-4 w-4 mr-2" />New SCA flow</Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="lifecycle" className="mt-4"><StepFlow /></TabsContent>

              <TabsContent value="methods" className="mt-4 space-y-4">
                {SCA_METHODS.map(m => (
                  <div key={m.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-white font-semibold">{m.label}</div>
                        <div className="text-zinc-400 text-sm mt-0.5">{m.desc}</div>
                      </div>
                      <div className="flex gap-2">
                        {m.psd2 && <Badge className="bg-green-600 text-white border-0 text-xs">PSD2</Badge>}
                        <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs">strength: {m.strength}</Badge>
                      </div>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mt-3">
                      <div className={`h-full rounded-full ${m.strength >= 80 ? "bg-green-500" : m.strength >= 60 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${m.strength}%` }} />
                    </div>
                  </div>
                ))}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                  <h4 className="text-zinc-400 text-xs font-semibold mb-2 uppercase tracking-wider">Single-use guarantee</h4>
                  <p className="text-zinc-400 text-sm">Each SCA challenge can only be verified once. Replay attacks are blocked. Expired challenges cannot be retried — a new challenge must be issued.</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <h3 className="text-white font-semibold mb-4">SCA Rules</h3>
              <div className="space-y-3 text-sm">
                {[
                  { label: "Result options", value: "ALLOW or DENY only" },
                  { label: "Challenge TTL", value: "10 minutes" },
                  { label: "Reuse", value: "Single-use only" },
                  { label: "Dynamic linking", value: "Amount + IBAN bound" },
                  { label: "Exemptions", value: "< €30, trusted payee, low-risk" },
                  { label: "PSD2 Article 97", value: "Mandatory ≥ €30" },
                ].map(r => (
                  <div key={r.label} className="flex justify-between">
                    <span className="text-zinc-400">{r.label}</span>
                    <span className="text-white text-xs font-mono">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <h4 className="text-zinc-400 text-xs font-semibold mb-3 uppercase tracking-wider">JWT SCA Claims</h4>
              <pre className="text-green-400 text-xs font-mono">{`{
  "sca": true,
  "sca_method": "webauthn",
  "acr": "gold",
  "amr": ["hwk"],
  "sca_ts": 1719187200
}`}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
