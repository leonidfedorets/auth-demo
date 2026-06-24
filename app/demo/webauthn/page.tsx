"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Key, Fingerprint, CheckCircle, Circle, Loader2, Trash2, RefreshCw, ShieldCheck, Smartphone, Monitor, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const REGISTER_STEPS = [
  "Browser checks for platform authenticator",
  "Server generates challenge (32 bytes random)",
  "authenticatorMakeCredential() called",
  "Platform authenticator prompts user (biometric/PIN)",
  "Key pair created in secure element / TPM",
  "Attestation object signed by authenticator",
  "Server verifies attestation & sign counter",
  "Credential stored — passkey registered ✓",
];

const AUTH_STEPS = [
  "Server generates fresh challenge for credential",
  "Browser calls navigator.credentials.get()",
  "Platform authenticator prompts user",
  "Private key signs challenge (never leaves device)",
  "Signature + sign counter sent to server",
  "Server verifies signature against stored public key",
  "Sign counter checked (replay detection)",
  "ACR=gold JWT issued ✓",
];

function StepFlow({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <div key={i} className={`flex items-start gap-2 text-sm transition-all ${i < current ? "text-green-400" : i === current ? "text-white" : "text-zinc-600"}`}>
          {i < current ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0 text-green-400" /> : i === current ? <Loader2 className="h-4 w-4 mt-0.5 shrink-0 animate-spin text-indigo-400" /> : <Circle className="h-4 w-4 mt-0.5 shrink-0" />}
          <span>{step}</span>
        </div>
      ))}
    </div>
  );
}

export default function WebAuthnDemoPage() {
  const [regStep, setRegStep] = useState(-1);
  const [authStep, setAuthStep] = useState(-1);
  const [loading, setLoading] = useState<"register"|"auth"|null>(null);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [lastResult, setLastResult] = useState<any>(null);
  const [residentKey, setResidentKey] = useState("preferred");
  const [userVerification, setUserVerification] = useState("preferred");
  const [attestation, setAttestation] = useState("none");

  const fetchCreds = async () => {
    const r = await fetch("/api/webauthn/credentials");
    if (r.ok) setCredentials((await r.json()).credentials ?? []);
  };

  useEffect(() => { fetchCreds(); }, []);

  async function registerPasskey() {
    if (!window.PublicKeyCredential) { toast.error("WebAuthn not supported in this browser"); return; }
    setLoading("register");
    setRegStep(0);
    setLastResult(null);
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");
      for (let i = 0; i < 2; i++) { setRegStep(i); await new Promise(r => setTimeout(r, 400)); }
      const beginRes = await fetch("/api/webauthn/register/begin", { method: "POST" });
      if (beginRes.status === 401) { toast.error("Please log in first"); return; }
      const options = await beginRes.json();
      if (options.error) { toast.error(options.error); return; }
      setRegStep(2);
      const registration = await startRegistration({ optionsJSON: options });
      for (let i = 3; i < 7; i++) { setRegStep(i); await new Promise(r => setTimeout(r, 350)); }
      const finishRes = await fetch("/api/webauthn/register/finish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(registration) });
      const data = await finishRes.json();
      if (!finishRes.ok) { toast.error(data.error ?? "Registration failed"); return; }
      setRegStep(8);
      setLastResult({ type: "register", success: true });
      toast.success("Passkey registered! You can now sign in without a password.");
      fetchCreds();
    } catch (err: any) {
      if (err.name === "NotAllowedError") toast.error("Cancelled by user");
      else toast.error(err.message ?? "Registration failed");
    } finally {
      setLoading(null);
    }
  }

  async function authenticatePasskey() {
    if (!window.PublicKeyCredential) { toast.error("WebAuthn not supported in this browser"); return; }
    setLoading("auth");
    setAuthStep(0);
    setLastResult(null);
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      setAuthStep(0);
      const beginRes = await fetch("/api/webauthn/auth/begin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const options = await beginRes.json();
      if (options.error) { toast.error(options.error === "no_credentials_registered" ? "Register a passkey first" : options.error); return; }
      setAuthStep(1);
      const assertion = await startAuthentication({ optionsJSON: options });
      for (let i = 2; i < 7; i++) { setAuthStep(i); await new Promise(r => setTimeout(r, 350)); }
      const finishRes = await fetch("/api/webauthn/auth/finish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(assertion) });
      const data = await finishRes.json();
      if (!finishRes.ok) { toast.error(data.error ?? "Auth failed"); return; }
      setAuthStep(8);
      setLastResult({ type: "auth", success: true, acr: data.acr, amr: data.amr, user: data.user });
      toast.success("Authenticated with passkey! ACR = gold — highest assurance.");
    } catch (err: any) {
      if (err.name === "NotAllowedError") toast.error("Cancelled by user");
      else toast.error(err.message ?? "Auth failed");
    } finally {
      setLoading(null);
    }
  }

  const deleteCredential = async (id: string) => {
    await fetch("/api/webauthn/credentials", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credentialId: id }) });
    fetchCreds();
    toast.success("Passkey removed");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard"><Button variant="ghost" size="sm" className="text-zinc-400"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
          <div>
            <h1 className="text-2xl font-bold">WebAuthn / FIDO2 Passkeys</h1>
            <p className="text-zinc-400 text-sm">End-to-end passkey registration and passwordless authentication — FIDO2 Level 2</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">FIDO2 L2</Badge>
            <Badge className="bg-green-500/20 text-green-300 border-green-500/30">WebAuthn</Badge>
            <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">ACR=gold</Badge>
          </div>
        </div>

        <Tabs defaultValue="register">
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="register">Register Passkey</TabsTrigger>
            <TabsTrigger value="authenticate">Authenticate</TabsTrigger>
            <TabsTrigger value="credentials">My Passkeys ({credentials.length})</TabsTrigger>
            <TabsTrigger value="options">Options</TabsTrigger>
            <TabsTrigger value="fido2">FIDO2 Spec</TabsTrigger>
          </TabsList>

          <TabsContent value="register" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader><CardTitle className="text-white">Registration Flow</CardTitle>
                  <CardDescription className="text-zinc-400">Step-by-step FIDO2 credential creation</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg bg-zinc-800/60 border border-zinc-700 p-4">
                    <StepFlow steps={REGISTER_STEPS} current={regStep} />
                  </div>
                  {lastResult?.type === "register" && lastResult.success && (
                    <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3 flex items-center gap-2 text-green-400">
                      <ShieldCheck className="h-5 w-5" /><span className="font-semibold">Passkey registered successfully</span>
                    </div>
                  )}
                  <Button className="w-full bg-indigo-600 hover:bg-indigo-700 h-11" onClick={registerPasskey} disabled={loading !== null}>
                    {loading === "register" ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Registering...</> : <><Key className="h-4 w-4 mr-2" />Register Passkey</>}
                  </Button>
                  <p className="text-xs text-zinc-500 text-center">Your device will prompt for biometric / PIN · Private key never leaves this device</p>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-300">What gets stored server-side</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-2">
                    {[
                      { field: "credential_id", value: "base64url-encoded opaque ID" },
                      { field: "public_key", value: "COSE-encoded public key (ES256/RS256)" },
                      { field: "counter", value: "Sign counter (replay detection)" },
                      { field: "aaguid", value: "Authenticator model identifier" },
                      { field: "transports", value: "internal, hybrid, usb, nfc, ble" },
                    ].map(({ field, value }) => (
                      <div key={field} className="flex gap-3">
                        <code className="text-indigo-300 w-32 shrink-0 text-xs">{field}</code>
                        <span className="text-zinc-400 text-xs">{value}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-300">Security Properties</CardTitle></CardHeader>
                  <CardContent className="text-xs text-zinc-400 space-y-1.5">
                    <p>✅ Private key never leaves the authenticator</p>
                    <p>✅ Each credential bound to specific RP ID (origin)</p>
                    <p>✅ Sign counter prevents credential cloning</p>
                    <p>✅ Challenge prevents replay attacks</p>
                    <p>✅ User presence / verification enforced by device</p>
                    <p>✅ Phishing-resistant — no shared secrets</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="authenticate" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader><CardTitle className="text-white">Authentication Flow</CardTitle>
                  <CardDescription className="text-zinc-400">Passwordless sign-in with registered passkey</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg bg-zinc-800/60 border border-zinc-700 p-4">
                    <StepFlow steps={AUTH_STEPS} current={authStep} />
                  </div>
                  {lastResult?.type === "auth" && lastResult.success && (
                    <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-green-400"><ShieldCheck className="h-5 w-5" /><span className="font-semibold">Authenticated</span></div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-zinc-400">User:</span> <span className="text-white">{lastResult.user?.email}</span></div>
                        <div><span className="text-zinc-400">ACR:</span> <code className="text-indigo-300">{lastResult.acr}</code></div>
                        <div><span className="text-zinc-400">AMR:</span> <code className="text-indigo-300">{JSON.stringify(lastResult.amr)}</code></div>
                        <div><span className="text-zinc-400">SCA:</span> <code className="text-green-300">true</code></div>
                      </div>
                    </div>
                  )}
                  <Button className="w-full bg-green-600 hover:bg-green-700 h-11" onClick={authenticatePasskey} disabled={loading !== null}>
                    {loading === "auth" ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Authenticating...</> : <><Fingerprint className="h-4 w-4 mr-2" />Sign in with Passkey</>}
                  </Button>
                  <p className="text-xs text-zinc-500 text-center">Requires a registered passkey · Issues JWT with ACR=gold</p>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader><CardTitle className="text-white">Token Upgrade: password → passkey</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-lg border border-zinc-700 p-3">
                    <div className="text-zinc-400 text-xs mb-2">Password login (ACR=bronze)</div>
                    <pre className="text-xs text-yellow-300">{`{ amr: ["pwd"], acr: "bronze",
  risk: 12, sca: false }`}</pre>
                  </div>
                  <div className="text-center text-zinc-500 text-xs">↓ User taps "Sign in with passkey" ↓</div>
                  <div className="rounded-lg border border-green-500/30 p-3 bg-green-500/5">
                    <div className="text-green-400 text-xs mb-2">Passkey login (ACR=gold)</div>
                    <pre className="text-xs text-green-300">{`{ amr: ["hwk"], acr: "gold",
  risk: 0, sca: true,
  sca_method: "webauthn" }`}</pre>
                  </div>
                  <p className="text-xs text-zinc-500">ACR=gold unlocks: high-value transfers, admin actions, PSD2 SCA compliance</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="credentials" className="mt-4">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle className="text-white">Registered Passkeys</CardTitle>
                  <CardDescription className="text-zinc-400">FIDO2 credentials bound to your account</CardDescription></div>
                <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300" onClick={fetchCreds}><RefreshCw className="h-3 w-3 mr-1" />Refresh</Button>
              </CardHeader>
              <CardContent>
                {credentials.length === 0 ? (
                  <p className="text-zinc-500 py-8 text-center">No passkeys registered yet. Go to the Register tab.</p>
                ) : (
                  <div className="space-y-3">
                    {credentials.map(c => (
                      <div key={c.id} className="flex items-center gap-3 rounded-lg border border-zinc-700 p-3">
                        <Key className="h-5 w-5 text-indigo-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-medium">{c.name ?? "Passkey"}</span>
                            <Badge variant="outline" className="border-zinc-600 text-zinc-400 text-xs">counter: {c.counter}</Badge>
                          </div>
                          <p className="text-xs text-zinc-500">Registered: {new Date(c.created_at).toLocaleDateString()} · Last used: {c.last_used_at ? new Date(c.last_used_at).toLocaleDateString() : "never"}</p>
                          <code className="text-xs text-zinc-600 break-all">{c.credential_id?.slice(0, 24)}…</code>
                        </div>
                        <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => deleteCredential(c.credential_id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="options" className="mt-4">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader><CardTitle className="text-white">Authenticator Options</CardTitle>
                <CardDescription className="text-zinc-400">Per-tenant WebAuthn configuration (applied on next registration)</CardDescription></CardHeader>
              <CardContent className="space-y-6 max-w-xl">
                <div className="space-y-2">
                  <Label className="text-zinc-300">Resident Key (Discoverable Credential)</Label>
                  <Select value={residentKey} onValueChange={setResidentKey}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      <SelectItem value="discouraged" className="text-white">discouraged — server-side credential lookup</SelectItem>
                      <SelectItem value="preferred" className="text-white">preferred — passkey if supported (recommended)</SelectItem>
                      <SelectItem value="required" className="text-white">required — always discoverable / passwordless</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-zinc-500">Controls whether the credential is stored on the authenticator for passwordless flows</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300">User Verification</Label>
                  <Select value={userVerification} onValueChange={setUserVerification}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      <SelectItem value="discouraged" className="text-white">discouraged — presence only (no biometric/PIN)</SelectItem>
                      <SelectItem value="preferred" className="text-white">preferred — biometric if available (recommended)</SelectItem>
                      <SelectItem value="required" className="text-white">required — always require biometric/PIN (PSD2 SCA)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300">Attestation Type</Label>
                  <Select value={attestation} onValueChange={setAttestation}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      <SelectItem value="none" className="text-white">none — no attestation (best UX, privacy-friendly)</SelectItem>
                      <SelectItem value="indirect" className="text-white">indirect — anonymized attestation</SelectItem>
                      <SelectItem value="direct" className="text-white">direct — full attestation chain</SelectItem>
                      <SelectItem value="enterprise" className="text-white">enterprise — AAGUID visible (managed devices)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-lg bg-indigo-600/10 border border-indigo-500/30 p-3 text-xs text-indigo-300">
                  Config stored as JSONB in <code>tenants.webauthn_config</code> — applied per-request per-tenant
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fido2" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader><CardTitle className="text-white">FIDO2 Compliance</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {[
                    { spec: "WebAuthn L2", status: "✅", note: "navigator.credentials API, RP ID binding" },
                    { spec: "CTAP2", status: "✅", note: "Cross-device authenticators (USB, BLE, NFC)" },
                    { spec: "FIDO MDS3", status: "⚠️", note: "Metadata service for AAGUID lookup (production)" },
                    { spec: "Sign Counter", status: "✅", note: "Replay/clone detection enforced" },
                    { spec: "UV Required (PSD2)", status: "✅", note: "User verification = required configurable" },
                    { spec: "Resident Keys", status: "✅", note: "Discoverable credentials / passkeys" },
                    { spec: "Large Blob", status: "🔜", note: "Planned for key export/sync" },
                  ].map(({ spec, status, note }) => (
                    <div key={spec} className="flex gap-3 items-start border-b border-zinc-800 pb-2 last:border-0 last:pb-0">
                      <span className="text-lg w-6">{status}</span>
                      <div><div className="text-white font-medium">{spec}</div><div className="text-zinc-500 text-xs">{note}</div></div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader><CardTitle className="text-white">ACR Levels by Auth Method</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead><tr className="text-zinc-400 text-xs border-b border-zinc-800"><th className="text-left pb-2">Method</th><th className="text-left pb-2">ACR</th><th className="text-left pb-2">SCA</th><th className="text-left pb-2">Unlocks</th></tr></thead>
                    <tbody className="divide-y divide-zinc-800">
                      {[
                        { m: "Password only", acr: "bronze", sca: "No", u: "Basic read" },
                        { m: "Password + TOTP", acr: "silver", sca: "Yes", u: "Payments < €30" },
                        { m: "Password + Push", acr: "silver", sca: "Yes", u: "Account changes" },
                        { m: "Passkey (hwk)", acr: "gold", sca: "Yes", u: "All — admin, transfers" },
                      ].map(row => (
                        <tr key={row.m} className="text-zinc-300">
                          <td className="py-2 text-xs">{row.m}</td>
                          <td className="py-2"><code className={`text-xs ${row.acr === "gold" ? "text-yellow-400" : row.acr === "silver" ? "text-zinc-300" : "text-zinc-500"}`}>{row.acr}</code></td>
                          <td className="py-2 text-xs">{row.sca}</td>
                          <td className="py-2 text-xs text-zinc-400">{row.u}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
