"use client";
import { useState } from "react";
import Link from "next/link";
import { Shield, ChevronLeft, Play, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DEVICE_TRUST_SIGNALS = [
  { key: "NEW_DEVICE", label: "New Device", weight: 30, desc: "Device fingerprint not seen before" },
  { key: "DEVICE_RESTRICTED", label: "Device Restricted", weight: 40, desc: "Device is in restricted state from previous attestation" },
  { key: "DEVICE_BLOCKED", label: "Device Blocked", weight: 100, desc: "Device is blocked — triggers override rule A" },
  { key: "NO_SCREEN_LOCK", label: "No Screen Lock", weight: 60, desc: "Device has no screen lock / PIN configured" },
  { key: "NO_HARDWARE_KEY", label: "No Hardware Key", weight: 60, desc: "No hardware security key bound to device" },
  { key: "MANY_TRUSTED_DEVICES", label: "Many Trusted Devices", weight: 20, desc: "User has >5 trusted devices — increased risk surface" },
  { key: "DEBUG_MODE", label: "Debug Mode", weight: 30, desc: "Device is in developer/debug mode" },
  { key: "EMULATOR", label: "Emulator", weight: 60, desc: "Request from emulator/virtual device" },
  { key: "OUTDATED_OS", label: "Outdated OS", weight: 10, desc: "OS version below minimum required" },
];

const NETWORK_GEO_SIGNALS = [
  { key: "NEW_IP", label: "New IP Address", weight: 20, desc: "IP not seen in last 30 days for this user" },
  { key: "NEW_COUNTRY", label: "New Country", weight: 40, desc: "Login from a country not previously seen" },
];

const OVERRIDE_RULES = [
  { id: "A", trigger: "DEVICE_BLOCKED", action: "BLOCK", desc: "Device is blocked → immediate BLOCK regardless of score" },
  { id: "B", trigger: "EMULATOR = true AND device not explicitly allowed", action: "DENY", desc: "Emulator access without allow-list → DENY" },
  { id: "C", trigger: "DEBUG_MODE AND score ≥ 30", action: "STEP_UP", desc: "Debug mode with non-zero risk → force step-up auth" },
  { id: "D", trigger: "NEW_COUNTRY AND DEVICE_BLOCKED", action: "BLOCK", desc: "New country + blocked device → BLOCK" },
  { id: "E", trigger: "score ≥ 70 AND NO_HARDWARE_KEY", action: "CHALLENGE", desc: "High score without hardware key → challenge" },
];

const PRESETS = {
  "Low risk (trusted device)": { signals: [], countries: ["DE", "DE"] },
  "New device, new IP": { signals: ["NEW_DEVICE", "NEW_IP"], countries: ["DE", "DE"] },
  "High risk (emulator)": { signals: ["EMULATOR", "NEW_IP", "NEW_COUNTRY"], countries: ["RU", "DE"] },
  "Blocked device": { signals: ["DEVICE_BLOCKED"], countries: ["DE", "DE"] },
  "No screen lock, new country": { signals: ["NO_SCREEN_LOCK", "NEW_COUNTRY", "MANY_TRUSTED_DEVICES"], countries: ["CN", "DE"] },
};

type Weights = Record<string, number>;

export default function AuthRiskPage() {
  const [activeSignals, setActiveSignals] = useState<string[]>(["NEW_DEVICE", "NEW_IP"]);
  const [weights, setWeights] = useState<Weights>(() => Object.fromEntries([...DEVICE_TRUST_SIGNALS, ...NETWORK_GEO_SIGNALS].map(s => [s.key, s.weight])));
  const [result, setResult] = useState<null | { authRiskScore: number; authRiskLevel: string; authRecommendedAction: string; scoreBreakdown: { deviceTrustScore: number; networkGeoScore: number }; overrideApplied?: { ruleId: string; action: string; reason: string } }>(null);
  const [loading, setLoading] = useState(false);

  const toggleSignal = (key: string) => setActiveSignals(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]);

  async function evaluate() {
    setLoading(true);
    try {
      const r = await fetch("/api/auth-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeSignals, weights }),
      });
      setResult(await r.json());
    } catch { /* ignore */ }
    setLoading(false);
  }

  const applyPreset = (name: keyof typeof PRESETS) => {
    setActiveSignals(PRESETS[name].signals);
    setResult(null);
  };

  const levelColor = (lvl: string) => ({ low: "text-green-400", medium: "text-yellow-400", high: "text-orange-400", critical: "text-red-400" })[lvl] ?? "text-zinc-400";
  const levelBg = (lvl: string) => ({ low: "bg-green-500", medium: "bg-yellow-500", high: "bg-orange-500", critical: "bg-red-500" })[lvl] ?? "bg-zinc-500";
  const actionColor = (a: string) => ({ ALLOW: "text-green-400", STEP_UP: "text-yellow-400", CHALLENGE: "text-orange-400", MFA_REQUIRED: "text-orange-400", BLOCK: "text-red-400", DENY: "text-red-400" })[a] ?? "text-zinc-400";

  const liveScore = Math.min(100,
    [...DEVICE_TRUST_SIGNALS, ...NETWORK_GEO_SIGNALS]
      .filter(s => activeSignals.includes(s.key))
      .reduce((acc, s) => acc + (weights[s.key] ?? s.weight), 0)
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <nav className="border-b border-zinc-800 px-6 py-4 flex items-center gap-4 sticky top-0 bg-zinc-950/90 backdrop-blur z-40">
        <Link href="/" className="flex items-center gap-2 font-bold text-white"><Shield className="h-5 w-5 text-indigo-400" />AuthService</Link>
        <span className="text-zinc-700">/</span>
        <Link href="/demo/auth-risk" className="text-zinc-400 text-sm">Auth Risk Engine</Link>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 bg-indigo-500/10 text-xs">Auth Risk Engine</Badge>
            <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs">Spec-compliant</Badge>
          </div>
          <h1 className="text-3xl font-black text-white">Auth Risk Engine Demo</h1>
          <p className="text-zinc-400 mt-1">Device Trust Layer (9 signals) + Network & Geo Layer (2 signals). Formula: <code className="text-indigo-300 text-xs bg-indigo-500/10 px-1 rounded">AuthRiskScore = min(100, DeviceTrustScore + NetworkGeoScore)</code></p>
        </div>

        {/* Live score bar */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 mb-6 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-zinc-400">Live score estimate</span>
              <span className={`font-bold ${liveScore >= 70 ? "text-red-400" : liveScore >= 40 ? "text-yellow-400" : "text-green-400"}`}>{liveScore}</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-300 ${liveScore >= 70 ? "bg-red-500" : liveScore >= 40 ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: `${liveScore}%` }} />
            </div>
          </div>
          <Button onClick={evaluate} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 h-9 shrink-0">
            <Play className="h-4 w-4 mr-1" /> {loading ? "..." : "Evaluate"}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls */}
          <div className="lg:col-span-2 space-y-4">
            <Tabs defaultValue="signals">
              <TabsList className="bg-zinc-900 border border-zinc-800">
                <TabsTrigger value="signals" className="text-xs">Active Signals</TabsTrigger>
                <TabsTrigger value="weights" className="text-xs">Signal Weights</TabsTrigger>
                <TabsTrigger value="overrides" className="text-xs">Override Rules</TabsTrigger>
              </TabsList>

              <TabsContent value="signals" className="space-y-3 mt-4">
                <div className="flex flex-wrap gap-2 mb-4">
                  {Object.keys(PRESETS).map(name => (
                    <button key={name} onClick={() => applyPreset(name as keyof typeof PRESETS)} className="px-3 py-1 rounded-full border border-zinc-700 text-xs text-zinc-400 hover:border-indigo-500 hover:text-indigo-400 transition-colors cursor-pointer">
                      {name}
                    </button>
                  ))}
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2 font-semibold">Device Trust Layer</p>
                  {DEVICE_TRUST_SIGNALS.map(s => (
                    <div key={s.key} className={`flex items-center gap-3 p-3 rounded-lg mb-2 border transition-all cursor-pointer ${activeSignals.includes(s.key) ? "border-indigo-500/40 bg-indigo-500/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"}`} onClick={() => toggleSignal(s.key)}>
                      <Switch checked={activeSignals.includes(s.key)} onCheckedChange={() => toggleSignal(s.key)} onClick={e => e.stopPropagation()} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{s.label}</span>
                          <Badge variant="outline" className="text-zinc-500 border-zinc-700 text-xs h-4">weight: {weights[s.key]}</Badge>
                        </div>
                        <p className="text-zinc-500 text-xs mt-0.5">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2 mt-4 font-semibold">Network & Geo Layer</p>
                  {NETWORK_GEO_SIGNALS.map(s => (
                    <div key={s.key} className={`flex items-center gap-3 p-3 rounded-lg mb-2 border transition-all cursor-pointer ${activeSignals.includes(s.key) ? "border-indigo-500/40 bg-indigo-500/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"}`} onClick={() => toggleSignal(s.key)}>
                      <Switch checked={activeSignals.includes(s.key)} onCheckedChange={() => toggleSignal(s.key)} onClick={e => e.stopPropagation()} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{s.label}</span>
                          <Badge variant="outline" className="text-zinc-500 border-zinc-700 text-xs h-4">weight: {weights[s.key]}</Badge>
                        </div>
                        <p className="text-zinc-500 text-xs mt-0.5">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="weights" className="space-y-4 mt-4">
                <p className="text-zinc-400 text-sm">Drag sliders to customize signal weights. Weights 0–100.</p>
                {[...DEVICE_TRUST_SIGNALS, ...NETWORK_GEO_SIGNALS].map(s => (
                  <div key={s.key} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <Label className="text-zinc-300 text-sm">{s.label}</Label>
                      <span className="text-indigo-400 text-sm font-mono w-8 text-right">{weights[s.key]}</span>
                    </div>
                    <Slider value={[weights[s.key]]} onValueChange={([v]) => setWeights(prev => ({ ...prev, [s.key]: v }))} min={0} max={100} step={5} className="w-full" />
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="overrides" className="mt-4">
                <p className="text-zinc-400 text-sm mb-4">Override rules are evaluated before score thresholds. If matched, they take precedence.</p>
                <div className="space-y-3">
                  {OVERRIDE_RULES.map(rule => (
                    <div key={rule.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-400 shrink-0">{rule.id}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <code className="text-xs text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded">{rule.trigger}</code>
                            <span className="text-zinc-500 text-xs">→</span>
                            <Badge className={`text-white border-0 text-xs ${rule.action === "BLOCK" || rule.action === "DENY" ? "bg-red-600" : rule.action === "CHALLENGE" ? "bg-orange-600" : "bg-yellow-600"}`}>{rule.action}</Badge>
                          </div>
                          <p className="text-zinc-400 text-xs">{rule.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Result panel */}
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <h3 className="text-white font-semibold mb-4">Evaluation Result</h3>
              {!result ? (
                <div className="text-zinc-600 text-sm text-center py-8">Click Evaluate to see results</div>
              ) : (
                <div className="space-y-4">
                  {/* Score arc */}
                  <div className="text-center">
                    <div className={`text-6xl font-black ${levelColor(result.authRiskLevel)}`}>{result.authRiskScore}</div>
                    <div className="text-zinc-400 text-xs mt-1">/ 100</div>
                    <div className={`text-sm font-semibold mt-1 ${levelColor(result.authRiskLevel)} uppercase tracking-wide`}>{result.authRiskLevel}</div>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${levelBg(result.authRiskLevel)}`} style={{ width: `${result.authRiskScore}%` }} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Recommended action</span>
                      <span className={`font-bold ${actionColor(result.authRecommendedAction)}`}>{result.authRecommendedAction}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Device Trust Score</span>
                      <span className="text-white font-mono">{result.scoreBreakdown?.deviceTrustScore ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Network & Geo Score</span>
                      <span className="text-white font-mono">{result.scoreBreakdown?.networkGeoScore ?? 0}</span>
                    </div>
                  </div>
                  {result.overrideApplied && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                      <div className="text-red-400 text-xs font-semibold mb-1">Override Rule {result.overrideApplied.ruleId} applied</div>
                      <div className="text-zinc-400 text-xs">{result.overrideApplied.reason}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Score bands */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <h4 className="text-zinc-400 text-xs font-semibold mb-3 uppercase tracking-wider">Score Bands</h4>
              <div className="space-y-2 text-sm">
                {[
                  { range: "0–29", level: "low", action: "ALLOW", color: "text-green-400" },
                  { range: "30–49", level: "medium", action: "STEP_UP", color: "text-yellow-400" },
                  { range: "50–69", level: "high", action: "MFA_REQUIRED", color: "text-orange-400" },
                  { range: "70–99", level: "high", action: "CHALLENGE", color: "text-orange-400" },
                  { range: "100", level: "critical", action: "BLOCK", color: "text-red-400" },
                ].map(b => (
                  <div key={b.range} className="flex justify-between items-center">
                    <span className="text-zinc-500 font-mono text-xs">{b.range}</span>
                    <span className={`text-xs ${b.color}`}>{b.action}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <h4 className="text-zinc-400 text-xs font-semibold mb-3 uppercase tracking-wider">Formula</h4>
              <code className="text-indigo-300 text-xs block">AuthRiskScore =<br/>  min(100,<br/>    DeviceTrustScore<br/>    + NetworkGeoScore<br/>  )</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
