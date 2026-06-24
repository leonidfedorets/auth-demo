"use client";
import { useState } from "react";
import Link from "next/link";
import { Shield, Play, Smartphone, Monitor, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STATUS_COLORS: Record<string, string> = {
  healthy: "bg-green-600 text-white",
  degraded: "bg-yellow-600 text-white",
  restricted: "bg-orange-600 text-white",
  blocked: "bg-red-600 text-white",
  unknown: "bg-zinc-600 text-white",
};

const STATUS_DESCRIPTIONS: Record<string, string> = {
  healthy: "All attestation checks passed. Device is trusted. Full access allowed.",
  degraded: "Some signals indicate reduced integrity but device is not blocked. Step-up auth may be required.",
  restricted: "Device has failed critical checks. Limited operations only. No SCA.",
  blocked: "Device is permanently blocked. All operations denied.",
  unknown: "Attestation payload missing or unrecognizable. Treated as untrusted.",
};

const SIGNALS: Record<string, { label: string; code: string; group: "ios" | "android" | "windows" | "browser" }> = {
  ios_jailbroken: { label: "Jailbroken (iOS)", code: "IOS_JAILBROKEN", group: "ios" },
  ios_debug_build: { label: "Debug build (iOS)", code: "IOS_DEBUG_BUILD", group: "ios" },
  ios_integrity_pass: { label: "App integrity pass (iOS)", code: "IOS_INTEGRITY_PASS", group: "ios" },
  ios_app_attest_valid: { label: "App Attest valid", code: "IOS_APP_ATTEST_VALID", group: "ios" },
  android_rooted: { label: "Rooted device", code: "ANDROID_ROOTED", group: "android" },
  android_debug_apk: { label: "Debug APK", code: "ANDROID_DEBUG_APK", group: "android" },
  android_play_integrity_pass: { label: "Play Integrity pass", code: "ANDROID_PLAY_INTEGRITY_PASS", group: "android" },
  android_tampered_app: { label: "Tampered APK", code: "ANDROID_TAMPERED_APP", group: "android" },
  android_emulator: { label: "Emulator detected", code: "ANDROID_EMULATOR", group: "android" },
  win_tpm_present: { label: "TPM 2.0 present", code: "WIN_TPM_PRESENT", group: "windows" },
  win_secure_boot: { label: "Secure Boot enabled", code: "WIN_SECURE_BOOT", group: "windows" },
  win_health_attest_pass: { label: "Health Attest pass", code: "WIN_HEALTH_ATTEST_PASS", group: "windows" },
  win_defender_enabled: { label: "Defender enabled", code: "WIN_DEFENDER_ENABLED", group: "windows" },
  win_bitlocker_on: { label: "BitLocker active", code: "WIN_BITLOCKER_ON", group: "windows" },
  browser_webauthn_l2: { label: "WebAuthn L2 capable", code: "BROWSER_WEBAUTHN_L2", group: "browser" },
  browser_no_automation: { label: "No automation detected", code: "BROWSER_NO_AUTOMATION", group: "browser" },
  browser_canvas_consistent: { label: "Canvas fingerprint consistent", code: "BROWSER_CANVAS_CONSISTENT", group: "browser" },
  browser_screen_lock: { label: "Screen lock configured", code: "BROWSER_SCREEN_LOCK", group: "browser" },
};

const PRESETS: Record<string, { label: string; active: string[]; platform: string }> = {
  "Healthy iOS": { label: "Healthy iOS (App Attest)", platform: "ios", active: ["ios_integrity_pass", "ios_app_attest_valid"] },
  "Jailbroken iOS": { label: "Jailbroken iOS", platform: "ios", active: ["ios_jailbroken", "ios_debug_build"] },
  "Healthy Android": { label: "Healthy Android", platform: "android", active: ["android_play_integrity_pass"] },
  "Rooted Android": { label: "Rooted Android (emulator)", platform: "android", active: ["android_rooted", "android_emulator", "android_tampered_app"] },
  "Healthy Windows": { label: "Healthy Windows (TPM)", platform: "windows", active: ["win_tpm_present", "win_secure_boot", "win_health_attest_pass", "win_defender_enabled", "win_bitlocker_on"] },
  "Browser (WebAuthn L2)": { label: "Browser (WebAuthn L2)", platform: "browser", active: ["browser_webauthn_l2", "browser_no_automation", "browser_canvas_consistent", "browser_screen_lock"] },
};

const DBA_TABLE = [
  { binding: "First bind", attestation: "healthy", status: "ACTIVE_TRUSTED", action: "Allow" },
  { binding: "First bind", attestation: "degraded", status: "ACTIVE_MONITORED", action: "Allow + step-up" },
  { binding: "First bind", attestation: "restricted", status: "RESTRICTED", action: "Deny SCA" },
  { binding: "First bind", attestation: "blocked", status: "BLOCKED", action: "Deny all" },
  { binding: "First bind", attestation: "unknown", status: "PENDING_ATTEST", action: "Require attestation" },
  { binding: "Known device", attestation: "healthy", status: "ACTIVE_TRUSTED", action: "Allow" },
  { binding: "Known device", attestation: "degraded", status: "ACTIVE_MONITORED", action: "Allow + audit" },
  { binding: "Known device", attestation: "restricted", status: "RESTRICTED", action: "Deny SCA" },
  { binding: "Known device", attestation: "blocked", status: "BLOCKED", action: "Deny all + revoke" },
  { binding: "Additional device", attestation: "healthy", status: "ACTIVE_TRUSTED", action: "Allow (up to limit)" },
  { binding: "Additional device", attestation: "degraded", status: "ACTIVE_MONITORED", action: "Allow + audit" },
  { binding: "Additional device", attestation: "restricted", status: "RESTRICTED", action: "Deny bind" },
  { binding: "Operator revoke-all", attestation: "*", status: "REVOKED", action: "Deny all" },
];

export default function AttestationPage() {
  const [activeSignals, setActiveSignals] = useState<string[]>(["ios_integrity_pass", "ios_app_attest_valid"]);
  const [result, setResult] = useState<null | { attestationStatus: string; signalCodes: string[]; allowsTrustedContinuationByAttestation: boolean }>(null);
  const [loading, setLoading] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "windows" | "browser">("ios");

  const toggle = (key: string) => setActiveSignals(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]);

  async function evaluate() {
    setLoading(true);
    const payload: Record<string, boolean> = {};
    Object.entries(SIGNALS).forEach(([key, s]) => { payload[s.code] = activeSignals.includes(key); });
    try {
      const r = await fetch("/api/device-attestation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attestationPayload: payload, platform }),
      });
      setResult(await r.json());
    } catch { /* ignore */ }
    setLoading(false);
  }

  const platformSignals = Object.entries(SIGNALS).filter(([, s]) => s.group === platform);
  const platformIcons = { ios: Smartphone, android: Smartphone, windows: Monitor, browser: Globe };
  const PlatformIcon = platformIcons[platform];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <nav className="border-b border-zinc-800 px-6 py-4 flex items-center gap-4 sticky top-0 bg-zinc-950/90 backdrop-blur z-40">
        <Link href="/" className="flex items-center gap-2 font-bold text-white"><Shield className="h-5 w-5 text-indigo-400" />AuthService</Link>
        <span className="text-zinc-700">/</span>
        <span className="text-zinc-400 text-sm">Device Attestation</span>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-6">
          <Badge variant="outline" className="border-orange-500/40 text-orange-300 bg-orange-500/10 text-xs mb-2">Device Attestation</Badge>
          <h1 className="text-3xl font-black text-white">Device Attestation Demo</h1>
          <p className="text-zinc-400 mt-1">18 signal codes across iOS/Android/Windows/Browser. Status model: healthy → degraded → restricted → blocked → unknown</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Tabs defaultValue="signals">
              <TabsList className="bg-zinc-900 border border-zinc-800">
                <TabsTrigger value="signals" className="text-xs">Signal Configuration</TabsTrigger>
                <TabsTrigger value="dba" className="text-xs">DBA Composition Table</TabsTrigger>
                <TabsTrigger value="status" className="text-xs">Status Model</TabsTrigger>
              </TabsList>

              <TabsContent value="signals" className="mt-4 space-y-4">
                {/* Platform tabs */}
                <div className="flex gap-2">
                  {(["ios", "android", "windows", "browser"] as const).map(p => (
                    <button key={p} onClick={() => setPlatform(p)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer capitalize ${platform === p ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>{p}</button>
                  ))}
                </div>

                {/* Presets */}
                <div className="flex flex-wrap gap-2">
                  {Object.entries(PRESETS).filter(([, p]) => p.platform === platform).map(([name, preset]) => (
                    <button key={name} onClick={() => { setActiveSignals(preset.active); setResult(null); }} className="px-3 py-1 rounded-full border border-zinc-700 text-xs text-zinc-400 hover:border-orange-500 hover:text-orange-400 transition-colors cursor-pointer">
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {platformSignals.map(([key, s]) => (
                    <div key={key} className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${activeSignals.includes(key) ? "border-indigo-500/40 bg-indigo-500/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"}`} onClick={() => toggle(key)}>
                      <Switch checked={activeSignals.includes(key)} onCheckedChange={() => toggle(key)} onClick={e => e.stopPropagation()} />
                      <div className="flex-1 flex justify-between items-center">
                        <span className="text-sm text-white">{s.label}</span>
                        <code className="text-zinc-500 text-xs font-mono">{s.code}</code>
                      </div>
                    </div>
                  ))}
                </div>

                <Button onClick={evaluate} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 h-11">
                  <Play className="h-4 w-4 mr-2" />{loading ? "Evaluating..." : "Evaluate Attestation"}
                </Button>
              </TabsContent>

              <TabsContent value="dba" className="mt-4">
                <p className="text-zinc-400 text-sm mb-4">Device Binding × Attestation composition determines the device binding status and allowed actions.</p>
                <div className="rounded-xl border border-zinc-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-zinc-900 border-b border-zinc-800">
                      <th className="text-left px-4 py-3 text-zinc-400 font-medium">Binding event</th>
                      <th className="text-left px-4 py-3 text-zinc-400 font-medium">Attestation</th>
                      <th className="text-left px-4 py-3 text-zinc-400 font-medium">DBA status</th>
                      <th className="text-left px-4 py-3 text-zinc-400 font-medium">Allowed</th>
                    </tr></thead>
                    <tbody>
                      {DBA_TABLE.map((row, i) => (
                        <tr key={i} className="border-t border-zinc-800/50 hover:bg-zinc-900/30">
                          <td className="px-4 py-2 text-zinc-300 text-xs">{row.binding}</td>
                          <td className="px-4 py-2"><Badge className={`text-xs ${STATUS_COLORS[row.attestation] ?? "bg-zinc-600 text-white"}`}>{row.attestation}</Badge></td>
                          <td className="px-4 py-2 font-mono text-xs text-indigo-300">{row.status}</td>
                          <td className="px-4 py-2 text-zinc-400 text-xs">{row.action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="status" className="mt-4 space-y-3">
                <p className="text-zinc-400 text-sm mb-4">Status is evaluated in strict order: blocked &gt; restricted &gt; degraded &gt; healthy &gt; unknown. First matching rule wins.</p>
                {(["blocked", "restricted", "degraded", "healthy", "unknown"] as const).map((s, i) => (
                  <div key={s} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 flex items-start gap-4">
                    <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-400 shrink-0">{i + 1}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`${STATUS_COLORS[s]} border-0 text-xs uppercase`}>{s}</Badge>
                      </div>
                      <p className="text-zinc-400 text-sm">{STATUS_DESCRIPTIONS[s]}</p>
                    </div>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </div>

          {/* Result */}
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <h3 className="text-white font-semibold mb-4">Attestation Result</h3>
              {!result ? (
                <div className="text-zinc-600 text-sm text-center py-8">Configure signals and click Evaluate</div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center">
                    <Badge className={`${STATUS_COLORS[result.attestationStatus] ?? "bg-zinc-600 text-white"} text-base px-6 py-2 uppercase`}>{result.attestationStatus}</Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Trusted continuation</span>
                      <span className={result.allowsTrustedContinuationByAttestation ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                        {result.allowsTrustedContinuationByAttestation ? "ALLOWED" : "DENIED"}
                      </span>
                    </div>
                  </div>
                  {result.signalCodes?.length > 0 && (
                    <div>
                      <p className="text-zinc-400 text-xs mb-2">Active signal codes:</p>
                      <div className="flex flex-wrap gap-1">
                        {result.signalCodes.map(c => (
                          <code key={c} className="text-xs bg-zinc-800 text-indigo-300 px-2 py-0.5 rounded font-mono">{c}</code>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="text-zinc-400 text-xs border-t border-zinc-800 pt-3">
                    {STATUS_DESCRIPTIONS[result.attestationStatus]}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <h4 className="text-zinc-400 text-xs font-semibold mb-3 uppercase tracking-wider">Evaluation Order</h4>
              <div className="space-y-1 text-xs">
                {["blocked (any signal)", "restricted (any)", "degraded (any)", "healthy (all pass)", "unknown (no signals)"].map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-zinc-500">
                    <span className="text-zinc-700">{i + 1}.</span> {s}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
