"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Key, Fingerprint, Plus, Trash2, CheckCircle2, XCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function UthNav() {
  return (
    <nav className="border-b border-zinc-800 px-6 py-3 flex items-center gap-4 bg-zinc-950">
      <Link href="/" className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center"><span className="font-black text-white text-[10px]">UTH</span></div>
        <span className="font-black text-sm tracking-tighter"><span className="text-indigo-400">U</span><span className="text-indigo-300">T</span><span className="text-indigo-200">H</span></span>
      </Link>
      <span className="text-zinc-600">/</span>
      <span className="text-zinc-400 text-sm">Passkeys / WebAuthn</span>
      <div className="ml-auto flex gap-3">
        <Link href="/platform/sca" className="text-zinc-500 hover:text-white text-xs">SCA</Link>
        <Link href="/dashboard" className="text-zinc-500 hover:text-white text-xs">Dashboard</Link>
      </div>
    </nav>
  );
}

// ── Simulation steps ──────────────────────────────────────────────────────────
const SIM_STEPS_REGISTER = [
  { label: "Client requests registration options", detail: "POST /api/webauthn/register/begin · {email}", color: "text-blue-400" },
  { label: "Server returns PublicKeyCredentialCreationOptions", detail: "challenge, rp, user, pubKeyCredParams, authenticatorSelection", color: "text-zinc-300" },
  { label: "Browser calls navigator.credentials.create()", detail: "Platform authenticator prompts for biometric / PIN", color: "text-indigo-400" },
  { label: "Authenticator generates key pair", detail: "Private key stored in Secure Enclave / TPM — never leaves device", color: "text-green-400" },
  { label: "Client sends attestation response", detail: "POST /api/webauthn/register/finish · {attestationObject, clientDataJSON}", color: "text-blue-400" },
  { label: "Server verifies attestation & stores public key", detail: "verified: true · credentialId stored · acr: gold, amr: [hwk]", color: "text-green-400" },
];

const SIM_STEPS_AUTH = [
  { label: "Client requests authentication options", detail: "POST /api/webauthn/auth/begin · {email}", color: "text-blue-400" },
  { label: "Server returns PublicKeyCredentialRequestOptions", detail: "challenge, allowCredentials, timeout, userVerification: required", color: "text-zinc-300" },
  { label: "Browser calls navigator.credentials.get()", detail: "Platform authenticator matches credential → prompts biometric", color: "text-indigo-400" },
  { label: "Authenticator signs the challenge", detail: "Private key signs clientDataHash — phishing-resistant by origin binding", color: "text-green-400" },
  { label: "Client sends authentication response", detail: "POST /api/webauthn/auth/finish · {authenticatorData, signature}", color: "text-blue-400" },
  { label: "Server verifies signature & issues JWT", detail: "verified: true · sca: true · acr: gold · amr: [hwk]", color: "text-green-400" },
];

function SimFlow({ steps }: { steps: typeof SIM_STEPS_REGISTER }) {
  const [activeStep, setActiveStep] = useState(-1);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    setActiveStep(-1);
    for (let i = 0; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, 700));
      setActiveStep(i);
    }
    setRunning(false);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`rounded-lg border p-3 transition-all duration-300 ${i <= activeStep ? "border-indigo-500/40 bg-indigo-500/5" : "border-zinc-800 bg-zinc-900/50"}`}
          >
            <div className="flex items-start gap-2">
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold transition-all ${i <= activeStep ? "border-indigo-500 bg-indigo-600 text-white" : "border-zinc-700 text-zinc-600"}`}>{i + 1}</div>
              <div>
                <p className={`text-xs font-medium ${i <= activeStep ? "text-white" : "text-zinc-500"}`}>{step.label}</p>
                {i <= activeStep && <p className={`text-[10px] font-mono mt-0.5 ${step.color}`}>{step.detail}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <Button onClick={run} disabled={running} className="w-full bg-indigo-600 hover:bg-indigo-700 h-9 text-xs">
        {running ? "Simulating…" : "Run Simulation"}
      </Button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PasskeysPage() {
  const [credentials, setCredentials] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastOp, setLastOp] = useState<any>(null);
  const [userEmail, setUserEmail] = useState<string>("user@example.com");
  const [tab, setTab] = useState<"live" | "simulation">("live");

  useEffect(() => {
    fetch("/api/auth/me").then(async r => {
      if (r.ok) {
        const data = await r.json();
        if (data.user?.email) setUserEmail(data.user.email);
      }
    });
  }, []);

  async function registerPasskey() {
    setLoading(true);
    try {
      const beginRes = await fetch("/api/webauthn/register/begin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      });
      if (!beginRes.ok) { const e = await beginRes.json(); toast.error(e.message || "Begin failed"); return; }
      const { options } = await beginRes.json();
      const { startRegistration } = await import("@simplewebauthn/browser");
      const attResp = await startRegistration({ optionsJSON: options });
      const finishRes = await fetch("/api/webauthn/register/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, response: attResp }),
      });
      const data = await finishRes.json();
      if (data.verified) {
        toast.success("Passkey registered!");
        setCredentials(c => [...c, { id: data.credentialId || "cred-" + Date.now(), type: "platform", created: new Date().toISOString(), name: "This device" }]);
        setLastOp({ op: "register", status: "success", ...data });
      }
    } catch (e: any) {
      toast.error(e.message || "WebAuthn error");
    } finally {
      setLoading(false);
    }
  }

  async function authenticatePasskey() {
    setLoading(true);
    try {
      const beginRes = await fetch("/api/webauthn/auth/begin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      });
      if (!beginRes.ok) { const e = await beginRes.json(); toast.error(e.message || "Begin failed"); return; }
      const { options } = await beginRes.json();
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const authResp = await startAuthentication({ optionsJSON: options });
      const finishRes = await fetch("/api/webauthn/auth/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, response: authResp }),
      });
      const data = await finishRes.json();
      if (data.verified) {
        toast.success("Authenticated with passkey!");
        setLastOp({ op: "authenticate", status: "success", ...data });
      }
    } catch (e: any) {
      toast.error(e.message || "WebAuthn error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <UthNav />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-purple-500/15"><Key className="w-5 h-5 text-purple-400" /></div>
          <div>
            <h1 className="text-2xl font-black text-white">WebAuthn / Passkeys</h1>
            <p className="text-zinc-400 text-sm">FIDO2 Level 2 — register and authenticate with platform authenticators</p>
          </div>
          <Badge className="ml-auto bg-purple-500/20 text-purple-300 border-purple-500/30">FIDO2 L2</Badge>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-zinc-900 border border-zinc-800 rounded-lg p-1 w-fit">
          <button onClick={() => setTab("live")} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${tab === "live" ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-white"}`}>Live WebAuthn</button>
          <button onClick={() => setTab("simulation")} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${tab === "simulation" ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-white"}`}>Flow Simulation</button>
        </div>

        {tab === "live" && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              {/* Device notice */}
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex gap-3">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-blue-200 text-xs leading-relaxed">
                  <strong>WebAuthn requires a real device with a platform authenticator.</strong> If your device supports Face ID, Touch ID, or Windows Hello, click Register Passkey below. On unsupported devices, use the <button onClick={() => setTab("simulation")} className="underline cursor-pointer">Flow Simulation</button> tab to explore the full flow.
                </p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
                <div>
                  <h3 className="text-white font-semibold text-sm mb-1">Registered as</h3>
                  <p className="text-zinc-400 text-xs font-mono">{userEmail}</p>
                </div>
                <Button onClick={registerPasskey} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 h-11 flex items-center gap-2 text-sm">
                  <Plus className="w-4 h-4" /> Register Passkey (this device)
                </Button>
                <Button onClick={authenticatePasskey} disabled={loading} variant="outline" className="w-full border-zinc-700 text-zinc-300 hover:text-white h-11 flex items-center gap-2 text-sm">
                  <Fingerprint className="w-4 h-4" /> Authenticate with Passkey
                </Button>
              </div>

              {credentials.length > 0 && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                  <h3 className="text-white font-semibold text-sm mb-3">Registered credentials</h3>
                  <div className="space-y-2">
                    {credentials.map(c => (
                      <div key={c.id} className="flex items-center justify-between bg-zinc-800 rounded-lg p-3">
                        <div>
                          <p className="text-white text-sm">{c.name}</p>
                          <p className="text-zinc-500 text-xs font-mono">{c.id.slice(0, 16)}…</p>
                        </div>
                        <button onClick={() => setCredentials(cs => cs.filter(x => x.id !== c.id))} className="text-zinc-600 hover:text-red-400 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {lastOp && (
                <div className={`rounded-xl border p-4 ${lastOp.status === "success" ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {lastOp.status === "success" ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                    <span className="text-sm font-medium text-white capitalize">{lastOp.op} — {lastOp.status}</span>
                  </div>
                  <pre className="text-xs text-zinc-400 overflow-auto max-h-32 font-mono">{JSON.stringify(lastOp, null, 2)}</pre>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                <h3 className="text-white font-semibold text-sm mb-3">How WebAuthn works</h3>
                <div className="space-y-3">
                  {[
                    ["Registration", "Device generates a key pair. Public key stored by UTH. Private key never leaves device."],
                    ["Authentication", "UTH sends a challenge. Device signs with private key. UTH verifies signature."],
                    ["JWT claims", "verified:true, aaguid, credentialId → sca:true, acr:gold, amr:[hwk]"],
                    ["FIDO2 L2", "Platform authenticator bound to device + user — phishing-resistant by design"],
                  ].map(([t, d]) => (
                    <div key={String(t)} className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-white text-xs font-medium">{String(t)}</p>
                        <p className="text-zinc-500 text-xs">{String(d)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <h3 className="text-white text-xs font-semibold mb-2 uppercase tracking-wide">API Endpoints</h3>
                <div className="space-y-1 text-xs font-mono">
                  {[
                    ["POST", "/api/webauthn/register/begin", "text-blue-400"],
                    ["POST", "/api/webauthn/register/finish", "text-blue-400"],
                    ["POST", "/api/webauthn/auth/begin", "text-green-400"],
                    ["POST", "/api/webauthn/auth/finish", "text-green-400"],
                    ["GET", "/api/webauthn/credentials", "text-zinc-400"],
                  ].map(([m, p, c]) => (
                    <div key={String(p)} className="flex gap-2">
                      <span className={String(c)}>{String(m)}</span>
                      <span className="text-zinc-400">{String(p)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "simulation" && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <h2 className="text-sm font-bold text-white mb-1">Registration Flow</h2>
              <p className="text-zinc-500 text-xs mb-4">Simulate the full FIDO2 registration ceremony step by step</p>
              <SimFlow steps={SIM_STEPS_REGISTER} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white mb-1">Authentication Flow</h2>
              <p className="text-zinc-500 text-xs mb-4">Simulate the full FIDO2 assertion ceremony step by step</p>
              <SimFlow steps={SIM_STEPS_AUTH} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
