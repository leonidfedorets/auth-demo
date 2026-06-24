"use client";
import { useState } from "react";
import Link from "next/link";
import { Shield, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const LAYERS = {
  account_integrity: {
    label: "Account Integrity",
    color: "blue",
    signals: [
      { key: "ACCOUNT_AGE_LESS_7D", label: "Account age < 7 days", weight: 20 },
      { key: "EMAIL_NOT_VERIFIED", label: "Email not verified", weight: 30 },
      { key: "PASSWORD_REUSED", label: "Password reused from breach", weight: 50 },
      { key: "ACCOUNT_LOCKED_RECENTLY", label: "Account locked recently", weight: 40 },
      { key: "MFA_DISABLED", label: "MFA disabled", weight: 25 },
    ],
  },
  session_behavior: {
    label: "Session / Behavior",
    color: "purple",
    signals: [
      { key: "SESSION_TOO_LONG", label: "Session > 24h", weight: 15 },
      { key: "RAPID_API_CALLS", label: "Rapid consecutive API calls", weight: 30 },
      { key: "CONCURRENT_SESSIONS", label: "Concurrent sessions detected", weight: 25 },
      { key: "UNUSUAL_HOUR", label: "Login at unusual hour", weight: 10 },
      { key: "DIFFERENT_DEVICE_TYPE", label: "Different device type than usual", weight: 20 },
    ],
  },
  operation_risk: {
    label: "Operation Risk",
    color: "orange",
    signals: [
      { key: "HIGH_VALUE_TRANSFER", label: "High-value transfer (>€10k)", weight: 40 },
      { key: "FIRST_TIME_PAYEE", label: "First-time payee", weight: 20 },
      { key: "BULK_OPERATION", label: "Bulk operation", weight: 25 },
      { key: "ADMIN_ACTION", label: "Admin-level action", weight: 35 },
      { key: "DATA_EXPORT", label: "Bulk data export", weight: 30 },
    ],
  },
  sca_quality: {
    label: "SCA Quality",
    color: "green",
    signals: [
      { key: "SCA_DOWNGRADED", label: "SCA method downgraded", weight: 40 },
      { key: "SCA_CHALLENGE_FAILED", label: "SCA challenge failed", weight: 50 },
      { key: "SCA_NOT_COMPLETED", label: "SCA not completed for PSD2 op", weight: 60 },
      { key: "WEAK_SCA_METHOD", label: "Weak SCA method used (email OTP)", weight: 20 },
    ],
  },
};

const LAYER_COLOR_MAP: Record<string, string> = {
  blue: "border-blue-500/40 bg-blue-500/10 text-blue-400",
  purple: "border-purple-500/40 bg-purple-500/10 text-purple-400",
  orange: "border-orange-500/40 bg-orange-500/10 text-orange-400",
  green: "border-green-500/40 bg-green-500/10 text-green-400",
};

const OVERRIDE_RULES = [
  { id: "A", condition: "SCA_NOT_COMPLETED AND operation is PSD2-regulated", action: "DENY", desc: "PSD2 operation without SCA → DENY" },
  { id: "B", condition: "HIGH_VALUE_TRANSFER AND SCA_CHALLENGE_FAILED", action: "BLOCK", desc: "Failed SCA on high-value transfer → BLOCK" },
  { id: "C", condition: "engineRiskScore ≥ 80", action: "BLOCK", desc: "Engine risk critically high → BLOCK" },
  { id: "D", condition: "finalRiskScore ≥ 90", action: "BLOCK", desc: "Final consolidated score ≥ 90 → BLOCK" },
  { id: "E", condition: "finalRiskScore ≥ 70 AND NO_HARDWARE_KEY", action: "CHALLENGE", desc: "High final score without hardware key → CHALLENGE" },
  { id: "F", condition: "ACCOUNT_LOCKED_RECENTLY AND HIGH_VALUE_TRANSFER", action: "BLOCK", desc: "Recently locked account attempting high-value transfer → BLOCK" },
  { id: "G", condition: "RAPID_API_CALLS AND PASSWORD_REUSED", action: "BLOCK", desc: "Bot-like pattern with compromised password → BLOCK" },
  { id: "H", condition: "engineRiskScore < 30 AND authRiskScore < 30", action: "ALLOW", desc: "Both scores low → ALLOW without step-up" },
];

type Weights = Record<string, number>;

export default function EngineRiskPage() {
  const allSignals = Object.values(LAYERS).flatMap(l => l.signals);
  const [activeSignals, setActiveSignals] = useState<string[]>(["HIGH_VALUE_TRANSFER", "FIRST_TIME_PAYEE", "CONCURRENT_SESSIONS"]);
  const [weights, setWeights] = useState<Weights>(() => Object.fromEntries(allSignals.map(s => [s.key, s.weight])));
  const [authRiskScore, setAuthRiskScore] = useState(25);
  const [result, setResult] = useState<null | { engineRiskScore: number; finalRiskScore: number; finalRiskLevel: string; finalAction: string; layerScores: Record<string, number>; overrideApplied?: { ruleId: string; action: string } }>(null);
  const [loading, setLoading] = useState(false);

  const toggleSignal = (key: string) => setActiveSignals(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]);

  async function evaluate() {
    setLoading(true);
    try {
      const r = await fetch("/api/engine-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeSignals, weights, authRiskScore }),
      });
      setResult(await r.json());
    } catch { /* ignore */ }
    setLoading(false);
  }

  const liveEngineScore = Math.min(100, allSignals.filter(s => activeSignals.includes(s.key)).reduce((acc, s) => acc + (weights[s.key] ?? 0), 0));
  const liveFinalScore = Math.round((authRiskScore * 0.5) + (liveEngineScore * 0.5));

  const scoreColor = (s: number) => s >= 70 ? "text-red-400" : s >= 40 ? "text-yellow-400" : "text-green-400";
  const scoreBg = (s: number) => s >= 70 ? "bg-red-500" : s >= 40 ? "bg-yellow-500" : "bg-green-500";

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <nav className="border-b border-zinc-800 px-6 py-4 flex items-center gap-4 sticky top-0 bg-zinc-950/90 backdrop-blur z-40">
        <Link href="/" className="flex items-center gap-2 font-bold text-white"><Shield className="h-5 w-5 text-indigo-400" />AuthService</Link>
        <span className="text-zinc-700">/</span>
        <span className="text-zinc-400 text-sm">Engine Risk</span>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline" className="border-purple-500/40 text-purple-300 bg-purple-500/10 text-xs">Engine Risk Service</Badge>
            <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs">50/50 consolidation</Badge>
          </div>
          <h1 className="text-3xl font-black text-white">Engine Risk Demo</h1>
          <p className="text-zinc-400 mt-1">4 engine-side layers consolidated with Auth Risk. Formula: <code className="text-indigo-300 text-xs bg-indigo-500/10 px-1 rounded">FinalRiskScore = round((AuthRisk × 0.5) + (EngineRisk × 0.5))</code></p>
        </div>

        {/* Live meters */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Auth Risk Score", score: authRiskScore, suffix: "(input)" },
            { label: "Engine Risk Score", score: liveEngineScore, suffix: "(live)" },
            { label: "Final Risk Score", score: liveFinalScore, suffix: "(50/50)" },
          ].map(m => (
            <div key={m.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="text-zinc-400 text-xs mb-2">{m.label} <span className="text-zinc-600">{m.suffix}</span></div>
              <div className={`text-3xl font-black ${scoreColor(m.score)}`}>{m.score}</div>
              <div className="h-1.5 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${scoreBg(m.score)}`} style={{ width: `${m.score}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Tabs defaultValue="signals">
              <TabsList className="bg-zinc-900 border border-zinc-800">
                <TabsTrigger value="signals" className="text-xs">Layer Signals</TabsTrigger>
                <TabsTrigger value="weights" className="text-xs">Weights</TabsTrigger>
                <TabsTrigger value="overrides" className="text-xs">Override Rules</TabsTrigger>
              </TabsList>

              <TabsContent value="signals" className="mt-4 space-y-6">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-zinc-300">Auth Risk Score (from Auth Risk Engine)</Label>
                    <span className={`font-mono font-bold ${scoreColor(authRiskScore)}`}>{authRiskScore}</span>
                  </div>
                  <Slider value={[authRiskScore]} onValueChange={([v]) => setAuthRiskScore(v)} min={0} max={100} step={5} className="w-full" />
                </div>
                {Object.entries(LAYERS).map(([layerKey, layer]) => (
                  <div key={layerKey}>
                    <p className={`text-xs uppercase tracking-widest mb-2 font-semibold px-2 py-1 rounded inline-block border ${LAYER_COLOR_MAP[layer.color]}`}>{layer.label}</p>
                    <div className="space-y-2">
                      {layer.signals.map(s => (
                        <div key={s.key} className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${activeSignals.includes(s.key) ? "border-indigo-500/40 bg-indigo-500/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"}`} onClick={() => toggleSignal(s.key)}>
                          <Switch checked={activeSignals.includes(s.key)} onCheckedChange={() => toggleSignal(s.key)} onClick={e => e.stopPropagation()} />
                          <div className="flex-1 flex justify-between items-center">
                            <span className="text-sm text-white">{s.label}</span>
                            <Badge variant="outline" className="text-zinc-500 border-zinc-700 text-xs h-4">+{weights[s.key]}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="weights" className="mt-4 space-y-4">
                {Object.entries(LAYERS).map(([layerKey, layer]) => (
                  <div key={layerKey}>
                    <p className={`text-xs uppercase tracking-widest mb-2 font-semibold ${LAYER_COLOR_MAP[layer.color].split(" ")[2]}`}>{layer.label}</p>
                    {layer.signals.map(s => (
                      <div key={s.key} className="flex items-center gap-4 mb-3">
                        <Label className="text-zinc-400 text-sm w-52 shrink-0">{s.label}</Label>
                        <Slider value={[weights[s.key]]} onValueChange={([v]) => setWeights(p => ({ ...p, [s.key]: v }))} min={0} max={100} step={5} className="flex-1" />
                        <span className="text-indigo-400 font-mono text-sm w-6">{weights[s.key]}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="overrides" className="mt-4 space-y-3">
                {OVERRIDE_RULES.map(r => (
                  <div key={r.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-400 shrink-0">{r.id}</div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <code className="text-xs text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded">{r.condition}</code>
                          <Badge className={`text-white border-0 text-xs ${r.action === "BLOCK" || r.action === "DENY" ? "bg-red-600" : r.action === "CHALLENGE" ? "bg-orange-600" : "bg-green-600"}`}>{r.action}</Badge>
                        </div>
                        <p className="text-zinc-400 text-xs">{r.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </div>

          {/* Result */}
          <div className="space-y-4">
            <Button onClick={evaluate} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 h-11">
              <Play className="h-4 w-4 mr-2" /> {loading ? "Evaluating..." : "Evaluate"}
            </Button>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <h3 className="text-white font-semibold mb-4">Final Result</h3>
              {!result ? (
                <div className="text-zinc-600 text-sm text-center py-8">Click Evaluate to see result</div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className={`text-6xl font-black ${scoreColor(result.finalRiskScore)}`}>{result.finalRiskScore}</div>
                    <div className="text-zinc-400 text-xs mt-1">Final Risk Score</div>
                    <div className={`text-sm font-semibold mt-1 uppercase tracking-wide ${scoreColor(result.finalRiskScore)}`}>{result.finalRiskLevel}</div>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${scoreBg(result.finalRiskScore)}`} style={{ width: `${result.finalRiskScore}%` }} />
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-zinc-400">Action</span><span className={`font-bold ${scoreColor(result.finalRiskScore)}`}>{result.finalAction}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">Auth Risk</span><span className="text-white font-mono">{authRiskScore}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">Engine Risk</span><span className="text-white font-mono">{result.engineRiskScore}</span></div>
                    {Object.entries(result.layerScores ?? {}).map(([layer, score]) => (
                      <div key={layer} className="flex justify-between">
                        <span className="text-zinc-500 text-xs">{layer.replace(/_/g, " ")}</span>
                        <span className="text-zinc-400 font-mono text-xs">{score as number}</span>
                      </div>
                    ))}
                  </div>
                  {result.overrideApplied && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                      <div className="text-red-400 text-xs font-semibold">Override Rule {result.overrideApplied.ruleId}: {result.overrideApplied.action}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <h4 className="text-zinc-400 text-xs font-semibold mb-2 uppercase tracking-wider">50/50 Formula</h4>
              <code className="text-indigo-300 text-xs block">FinalRiskScore =<br/>  round(<br/>    (AuthRisk × 0.5)<br/>    + (EngineRisk × 0.5)<br/>  )</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
