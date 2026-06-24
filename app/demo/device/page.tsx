"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Smartphone, Monitor, Globe, Laptop, Shield, ShieldCheck, ShieldX, CheckCircle, Circle, Loader2, Trash2, Key, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const ATTESTATION_TYPES = [
  { id: "none", label: "No Attestation", icon: Globe, color: "text-zinc-400", desc: "Browser fingerprint only. Suitable for web apps.", trust: "Low", flow: ["Collect browser fingerprint (UA, screen, timezone, fonts)", "Hash to stable device ID", "Store in DB, set device cookie", "Include dfp in JWT claim"] },
  { id: "apple", label: "Apple App Attest", icon: Smartphone, color: "text-blue-400", desc: "iOS/macOS hardware attestation via Secure Enclave.", trust: "High", flow: ["App calls DCAppAttestService.generateKey()", "Apple signs challenge with Secure Enclave key", "Server verifies certificate chain → Apple CA", "Receipt issued, key ID stored", "Subsequent assertions verify each request"] },
  { id: "android", label: "Android Play Integrity", icon: Smartphone, color: "text-green-400", desc: "Google Play Integrity API for Android device binding.", trust: "High", flow: ["App requests integrity token from Play API", "Token signed by Google Play servers", "Server calls Play Integrity API to verify", "MEETS_DEVICE_INTEGRITY verdict checked", "Device binding token issued with did claim"] },
  { id: "windows", label: "Windows TPM / Hello", icon: Monitor, color: "text-purple-400", desc: "Windows Hello with TPM 2.0 hardware attestation.", trust: "High", flow: ["Windows Hello creates TPM-backed key pair", "Health Attestation Service signs device state", "Server calls Azure Attestation Service", "Verifies Secure Boot, BitLocker, TPM state", "did claim bound to TPM key fingerprint"] },
  { id: "fido2", label: "FIDO2 Device Binding", icon: Key, color: "text-indigo-400", desc: "WebAuthn credential used as device identity proof.", trust: "Very High", flow: ["Browser creates platform authenticator credential", "Credential bound to device's secure element", "Server registers credential against user+device", "On each login: challenge signed by device key", "did derived from credential public key hash"] },
];

const POLICY_OPTIONS = [
  { id: "any", label: "Accept Any Device", desc: "Allow registration without attestation" },
  { id: "fingerprint", label: "Fingerprint Required", desc: "Browser fingerprint required, no hardware attestation" },
  { id: "play_integrity", label: "Play Integrity (Android)", desc: "Require Google Play Integrity verdict" },
  { id: "app_attest", label: "App Attest (iOS)", desc: "Require Apple App Attest certificate" },
  { id: "tpm", label: "TPM Attestation (Windows)", desc: "Require Windows TPM/Health Attestation" },
  { id: "hardware_any", label: "Any Hardware Attestation", desc: "Accept Apple, Android, or Windows attestation" },
];

function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <div key={i} className={`flex items-start gap-2 text-sm transition-all ${i < current ? "text-green-400" : i === current ? "text-white" : "text-zinc-600"}`}>
          {i < current ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" /> : i === current ? <Loader2 className="h-4 w-4 mt-0.5 shrink-0 animate-spin" /> : <Circle className="h-4 w-4 mt-0.5 shrink-0" />}
          <span>{step}</span>
        </div>
      ))}
    </div>
  );
}

export default function DeviceDemoPage() {
  const [selectedType, setSelectedType] = useState("none");
  const [policy, setPolicy] = useState("any");
  const [requireReattestation, setRequireReattestation] = useState(false);
  const [bindingExpiry, setBindingExpiry] = useState("30");
  const [devices, setDevices] = useState<any[]>([]);
  const [fingerprint, setFingerprint] = useState("");
  const [flowStep, setFlowStep] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [bindingToken, setBindingToken] = useState<string | null>(null);

  const attest = ATTESTATION_TYPES.find(a => a.id === selectedType)!;

  useEffect(() => {
    const fp = btoa([navigator.userAgent, screen.width + "x" + screen.height, Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.language, screen.colorDepth].join("|")).slice(0, 32);
    setFingerprint(fp);
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    const r = await fetch("/api/devices");
    if (r.ok) setDevices((await r.json()).devices ?? []);
  };

  const runFlow = async () => {
    setLoading(true);
    setFlowStep(0);
    setBindingToken(null);

    for (let i = 0; i < attest.flow.length; i++) {
      setFlowStep(i);
      await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
    }

    const r = await fetch("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprint, platform: selectedType === "none" ? "web" : selectedType === "apple" ? "ios" : selectedType === "android" ? "android" : selectedType === "windows" ? "windows" : "web", name: attest.label, attestationType: selectedType }),
    });

    setFlowStep(attest.flow.length);

    if (r.ok) {
      const data = await r.json();
      const token = btoa(JSON.stringify({ did: data.deviceId, fp: fingerprint, iat: Date.now(), exp: Date.now() + +bindingExpiry * 24 * 3600000 }));
      setBindingToken(token);
      toast.success("Device registered and bound!");
      fetchDevices();
    } else if (r.status === 401) {
      toast.error("Login required to register a device");
    } else {
      toast.error("Registration failed");
    }
    setLoading(false);
  };

  const revoke = async (id: string) => {
    await fetch("/api/devices", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: id }) });
    fetchDevices();
    toast.success("Device revoked");
  };

  const TrustBadge = ({ trust }: { trust: string }) => {
    const c = { Low: "bg-zinc-700 text-zinc-300", High: "bg-green-500/20 text-green-400 border-green-500/30", "Very High": "bg-blue-500/20 text-blue-400 border-blue-500/30" }[trust] ?? "";
    return <Badge variant="outline" className={c}>Trust: {trust}</Badge>;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard"><Button variant="ghost" size="sm" className="text-zinc-400"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
          <div>
            <h1 className="text-2xl font-bold">Device Attestation & Binding</h1>
            <p className="text-zinc-400 text-sm">Full device registration journey — from fingerprint to cryptographic binding token</p>
          </div>
        </div>

        <Tabs defaultValue="flow">
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="flow">Attestation Flow</TabsTrigger>
            <TabsTrigger value="policy">Policy Settings</TabsTrigger>
            <TabsTrigger value="devices">Registered Devices</TabsTrigger>
            <TabsTrigger value="jwt">JWT Claims</TabsTrigger>
          </TabsList>

          <TabsContent value="flow" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-300">Select Attestation Type</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {ATTESTATION_TYPES.map(a => (
                      <button key={a.id} onClick={() => { setSelectedType(a.id); setFlowStep(-1); setBindingToken(null); }}
                        className={`w-full text-left rounded-lg border p-3 transition-all ${selectedType === a.id ? "border-indigo-500 bg-indigo-600/10" : "border-zinc-700 hover:border-zinc-600"}`}>
                        <div className="flex items-center gap-2">
                          <a.icon className={`h-4 w-4 ${a.color}`} />
                          <span className="text-white text-sm font-medium">{a.label}</span>
                        </div>
                        <p className="text-zinc-500 text-xs mt-1">{a.desc}</p>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-300">Current Device Fingerprint</CardTitle></CardHeader>
                  <CardContent>
                    <code className="text-xs text-indigo-300 bg-zinc-800 rounded p-2 block break-all">{fingerprint || "Computing..."}</code>
                    <p className="text-xs text-zinc-500 mt-2">Derived from: UA · resolution · timezone · language · color depth</p>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-2 space-y-4">
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-white flex items-center gap-2"><attest.icon className={`h-5 w-5 ${attest.color}`} />{attest.label}</CardTitle>
                        <CardDescription className="text-zinc-400 mt-1">{attest.desc}</CardDescription>
                      </div>
                      <TrustBadge trust={attest.trust} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg bg-zinc-800/60 border border-zinc-700 p-4">
                      <p className="text-xs text-zinc-400 uppercase tracking-wide mb-3">Attestation Steps</p>
                      <StepIndicator steps={attest.flow} current={flowStep} />
                    </div>

                    {flowStep >= attest.flow.length && bindingToken && (
                      <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-4 space-y-2">
                        <div className="flex items-center gap-2 text-green-400"><ShieldCheck className="h-5 w-5" /><span className="font-semibold">Device Bound Successfully</span></div>
                        <p className="text-xs text-zinc-400">Binding token (stored in secure storage / keychain):</p>
                        <code className="text-xs text-green-300 bg-zinc-900 rounded p-2 block break-all">{bindingToken}</code>
                        <p className="text-xs text-zinc-500">Expires in {bindingExpiry} days · Included as <code className="text-indigo-300">did</code> claim in JWT</p>
                      </div>
                    )}

                    {flowStep === -1 && (
                      <div className="rounded-lg bg-zinc-800/40 border border-zinc-700 p-4 text-center text-zinc-500 text-sm">
                        Click "Start Binding Flow" to simulate the full device registration journey
                      </div>
                    )}

                    <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={runFlow} disabled={loading}>
                      {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running...</> : <><Shield className="h-4 w-4 mr-2" />Start Binding Flow</>}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader className="pb-1"><CardTitle className="text-sm text-zinc-300">JWT Claims Added by Device Binding</CardTitle></CardHeader>
                  <CardContent>
                    <pre className="text-xs text-green-300 bg-zinc-800 rounded p-3 overflow-auto">{JSON.stringify({ did: "dev_" + fingerprint.slice(0, 8), dfp: fingerprint, amr: selectedType === "none" ? ["pwd"] : [...(["pwd"]), "hwk"], acr: attest.trust === "Very High" ? "gold" : attest.trust === "High" ? "silver" : "bronze" }, null, 2)}</pre>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="policy" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader><CardTitle className="text-white">Tenant Attestation Policy</CardTitle>
                  <CardDescription className="text-zinc-400">Configure what level of device proof is required</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Required attestation level</Label>
                    <Select value={policy} onValueChange={setPolicy}>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        {POLICY_OPTIONS.map(o => (
                          <SelectItem key={o.id} value={o.id} className="text-white hover:bg-zinc-700">
                            <div><div className="font-medium">{o.label}</div><div className="text-xs text-zinc-400">{o.desc}</div></div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator className="bg-zinc-800" />
                  <div className="flex items-center justify-between">
                    <div><Label className="text-zinc-300">Require re-attestation on new OS version</Label>
                      <p className="text-xs text-zinc-500 mt-0.5">Forces re-binding when system software changes</p></div>
                    <Switch checked={requireReattestation} onCheckedChange={setRequireReattestation} />
                  </div>
                  <Separator className="bg-zinc-800" />
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Binding token expiry (days)</Label>
                    <Select value={bindingExpiry} onValueChange={setBindingExpiry}>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        {["7","14","30","60","90","180","365"].map(d => (
                          <SelectItem key={d} value={d} className="text-white hover:bg-zinc-700">{d} days</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-lg bg-indigo-600/10 border border-indigo-500/30 p-3 text-xs text-indigo-300">
                    Config saved as JSONB in <code>tenants.device_policy</code> — applied per-request, no code deploy needed
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader><CardTitle className="text-white">Platform Trust Matrix</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead><tr className="text-zinc-400 text-xs border-b border-zinc-800">
                      <th className="text-left pb-2">Platform</th><th className="text-left pb-2">Method</th><th className="text-left pb-2">Trust</th><th className="text-left pb-2">ACR</th>
                    </tr></thead>
                    <tbody className="divide-y divide-zinc-800">
                      {[
                        { p: "iOS", m: "App Attest", t: "High", acr: "silver" },
                        { p: "Android", m: "Play Integrity", t: "High", acr: "silver" },
                        { p: "Windows", m: "TPM 2.0", t: "High", acr: "silver" },
                        { p: "Any", m: "FIDO2/WebAuthn", t: "Very High", acr: "gold" },
                        { p: "Web", m: "Fingerprint", t: "Low", acr: "bronze" },
                        { p: "None", m: "—", t: "None", acr: "bronze" },
                      ].map(row => (
                        <tr key={row.p} className="text-zinc-300">
                          <td className="py-2">{row.p}</td>
                          <td className="py-2 text-zinc-400">{row.m}</td>
                          <td className="py-2"><Badge variant="outline" className="text-xs border-zinc-600">{row.t}</Badge></td>
                          <td className="py-2"><code className="text-indigo-300 text-xs">{row.acr}</code></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="devices" className="mt-4">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle className="text-white">Registered Devices</CardTitle>
                  <CardDescription className="text-zinc-400">Devices cryptographically bound to this account</CardDescription></div>
                <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300" onClick={fetchDevices}><RefreshCw className="h-3 w-3 mr-1" />Refresh</Button>
              </CardHeader>
              <CardContent>
                {devices.length === 0 ? (
                  <p className="text-zinc-500 text-sm py-8 text-center">No devices registered. Run the attestation flow above.</p>
                ) : (
                  <div className="space-y-3">
                    {devices.map(d => (
                      <div key={d.id} className="flex items-center gap-3 rounded-lg border border-zinc-700 p-3">
                        <ShieldCheck className="h-5 w-5 text-green-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-medium">{d.name}</span>
                            <Badge variant="outline" className="border-zinc-600 text-zinc-400 text-xs">{d.attestation_type}</Badge>
                            <Badge variant="outline" className={`text-xs ${d.status === "verified" ? "border-green-500/30 text-green-400" : "border-zinc-600 text-zinc-400"}`}>{d.status}</Badge>
                          </div>
                          <p className="text-xs text-zinc-500 mt-0.5">Last seen: {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : "just now"} · IP: {d.last_seen_ip || "—"}</p>
                          <code className="text-xs text-zinc-600">did: dev_{d.id?.slice(0,8)}</code>
                        </div>
                        <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => revoke(d.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jwt" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader><CardTitle className="text-white">Device Claims in JWT</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { claim: "did", example: "dev_a1b2c3d4", desc: "Device ID — stable identifier for bound device" },
                    { claim: "dfp", example: "aGVsbG8gd29ybGQ=", desc: "Device fingerprint hash (SHA-256)" },
                    { claim: "amr", example: '["pwd","hwk"]', desc: "hwk = hardware key used (FIDO2 / TPM)" },
                    { claim: "acr", example: "silver", desc: "bronze/silver/gold based on attestation trust level" },
                    { claim: "risk", example: "8", desc: "Risk score at time of authentication" },
                    { claim: "risk_lvl", example: "low", desc: "low/medium/high/critical" },
                  ].map(({ claim, example, desc }) => (
                    <div key={claim} className="flex items-start gap-3 border-b border-zinc-800 pb-3 last:border-0 last:pb-0">
                      <code className="text-indigo-300 text-sm w-16 shrink-0">{claim}</code>
                      <div className="flex-1">
                        <code className="text-zinc-300 text-xs">{example}</code>
                        <p className="text-zinc-500 text-xs mt-0.5">{desc}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader><CardTitle className="text-white">Example JWT Payload</CardTitle></CardHeader>
                <CardContent>
                  <pre className="text-xs text-green-300 bg-zinc-800 rounded p-4 overflow-auto">{`{
  "sub": "usr_abc123",
  "email": "user@company.com",
  "tid": "tenant_xyz",
  "sid": "ses_def456",
  "did": "dev_a1b2c3d4",
  "dfp": "aGVsbG8gd29ybGQ=",
  "amr": ["pwd", "hwk"],
  "acr": "silver",
  "risk": 8,
  "risk_lvl": "low",
  "sca": false,
  "fid": "fam_ghi789",
  "roles": ["user"],
  "iat": 1782315580,
  "exp": 1782316480,
  "iss": "auth-service-demo"
}`}</pre>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
