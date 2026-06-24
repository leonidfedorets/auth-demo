"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Play, RotateCcw, AlertTriangle, ShieldCheck, Shield, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const PRESETS = [
  { label: "Normal Login", ip: "91.108.4.5", ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0", country: "US", previousCountry: "US", isNewDevice: false, failedLogins: 0 },
  { label: "Tor Exit Node", ip: "185.220.101.1", ua: "Mozilla/5.0 Chrome/120.0", country: "RU", previousCountry: "US", isNewDevice: true, failedLogins: 0 },
  { label: "Impossible Travel", ip: "1.2.3.4", ua: "Mozilla/5.0 Chrome/120.0", country: "JP", previousCountry: "US", isNewDevice: false, failedLogins: 0 },
  { label: "Brute Force", ip: "5.6.7.8", ua: "python-requests/2.28.0", country: "CN", previousCountry: "US", isNewDevice: true, failedLogins: 8 },
  { label: "Known VPN", ip: "104.16.0.1", ua: "Mozilla/5.0 Chrome/120.0", country: "NL", previousCountry: "US", isNewDevice: false, failedLogins: 0 },
  { label: "New Device US", ip: "192.168.1.1", ua: "Mozilla/5.0 Chrome/120.0", country: "US", previousCountry: "US", isNewDevice: true, failedLogins: 0 },
];

const DEFAULT_WEIGHTS = {
  tor_exit_node: 60,
  vpn_detected: 25,
  impossible_travel: 50,
  new_device: 20,
  geo_anomaly: 30,
  failed_logins_3: 25,
  failed_logins_5: 40,
  failed_logins_10: 70,
  suspicious_ua: 8,
  headless_browser: 45,
};

const DEFAULT_THRESHOLDS = { low: 30, medium: 60, high: 85, block: 100 };

export default function RiskDemoPage() {
  const [params, setParams] = useState(PRESETS[0]);
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [customRules, setCustomRules] = useState([
    { id: 1, name: "Sensitive action from new device", enabled: true, condition: "isNewDevice && action == 'payment'", score: 35 },
    { id: 2, name: "High-frequency API calls", enabled: false, condition: "requestsPerMin > 100", score: 40 },
  ]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const evaluate = async () => {
    setLoading(true);
    const r = await fetch("/api/risk/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, weights, thresholds }),
    });
    setResult(await r.json());
    setLoading(false);
  };

  const levelColor = (l: string) => ({ low: "text-green-400", medium: "text-yellow-400", high: "text-orange-400", critical: "text-red-400" }[l] ?? "text-zinc-400");
  const levelBg = (l: string) => ({ low: "bg-green-500/10 border-green-500/30", medium: "bg-yellow-500/10 border-yellow-500/30", high: "bg-orange-500/10 border-orange-500/30", critical: "bg-red-500/10 border-red-500/30" }[l] ?? "bg-zinc-800");
  const LevelIcon = ({ l }: { l: string }) => l === "low" ? <ShieldCheck className="h-5 w-5 text-green-400" /> : l === "medium" ? <Shield className="h-5 w-5 text-yellow-400" /> : <ShieldX className="h-5 w-5 text-red-400" />;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard"><Button variant="ghost" size="sm" className="text-zinc-400"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
          <div>
            <h1 className="text-2xl font-bold">Adaptive Risk Engine</h1>
            <p className="text-zinc-400 text-sm">Fully configurable signal weights, thresholds and custom CEL rules — live evaluation</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT — CONFIG */}
          <div className="lg:col-span-2 space-y-4">
            <Tabs defaultValue="scenario">
              <TabsList className="bg-zinc-900 border border-zinc-800">
                <TabsTrigger value="scenario">Scenario</TabsTrigger>
                <TabsTrigger value="weights">Signal Weights</TabsTrigger>
                <TabsTrigger value="thresholds">Thresholds</TabsTrigger>
                <TabsTrigger value="rules">Custom Rules</TabsTrigger>
              </TabsList>

              <TabsContent value="scenario" className="space-y-4 mt-4">
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-300">Quick Presets</CardTitle></CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {PRESETS.map(p => (
                      <Button key={p.label} size="sm" variant={params.label === p.label ? "default" : "outline"}
                        className={params.label === p.label ? "bg-indigo-600 border-0" : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"}
                        onClick={() => setParams(p)}>{p.label}</Button>
                    ))}
                  </CardContent>
                </Card>

                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-300">Request Parameters</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><Label className="text-zinc-400 text-xs">IP Address</Label>
                      <Input value={params.ip} onChange={e => setParams(p => ({ ...p, ip: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white h-8 text-sm" /></div>
                    <div className="space-y-1"><Label className="text-zinc-400 text-xs">Country</Label>
                      <Input value={params.country} onChange={e => setParams(p => ({ ...p, country: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white h-8 text-sm" /></div>
                    <div className="space-y-1"><Label className="text-zinc-400 text-xs">Previous Country</Label>
                      <Input value={params.previousCountry} onChange={e => setParams(p => ({ ...p, previousCountry: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white h-8 text-sm" /></div>
                    <div className="space-y-1"><Label className="text-zinc-400 text-xs">Failed Logins (last hour)</Label>
                      <Input type="number" value={params.failedLogins} onChange={e => setParams(p => ({ ...p, failedLogins: +e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white h-8 text-sm" /></div>
                    <div className="col-span-2 space-y-1"><Label className="text-zinc-400 text-xs">User-Agent</Label>
                      <Input value={params.ua} onChange={e => setParams(p => ({ ...p, ua: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white h-8 text-sm font-mono" /></div>
                    <div className="flex items-center gap-2">
                      <Switch checked={params.isNewDevice} onCheckedChange={v => setParams(p => ({ ...p, isNewDevice: v }))} />
                      <Label className="text-zinc-300 text-sm">New Device</Label>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="weights" className="mt-4">
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader><CardTitle className="text-sm text-zinc-300">Signal Score Weights (0–100)</CardTitle>
                    <CardDescription className="text-zinc-500 text-xs">Adjust how much each signal contributes to the total risk score</CardDescription></CardHeader>
                  <CardContent className="space-y-5">
                    {Object.entries(weights).map(([key, val]) => (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between">
                          <Label className="text-zinc-300 text-xs font-mono">{key}</Label>
                          <span className="text-white text-xs font-bold">{val}</span>
                        </div>
                        <Slider value={[val]} min={0} max={100} step={5}
                          onValueChange={([v]) => setWeights(w => ({ ...w, [key]: v }))}
                          className="[&_[role=slider]]:bg-indigo-500" />
                      </div>
                    ))}
                    <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400" onClick={() => setWeights(DEFAULT_WEIGHTS)}>
                      <RotateCcw className="h-3 w-3 mr-1" />Reset defaults
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="thresholds" className="mt-4">
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader><CardTitle className="text-sm text-zinc-300">Decision Thresholds</CardTitle>
                    <CardDescription className="text-zinc-500 text-xs">Score ranges that map to risk levels and authentication decisions</CardDescription></CardHeader>
                  <CardContent className="space-y-6">
                    {[
                      { key: "low", label: "Low → Medium boundary", color: "text-green-400", desc: "Below: allow. Above: step-up SCA." },
                      { key: "medium", label: "Medium → High boundary", color: "text-yellow-400", desc: "Above: require strong MFA." },
                      { key: "high", label: "High → Critical boundary", color: "text-orange-400", desc: "Above: challenge + notify." },
                      { key: "block", label: "Block threshold", color: "text-red-400", desc: "At or above: block request entirely." },
                    ].map(({ key, label, color, desc }) => (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between items-center">
                          <div><Label className={`text-sm ${color}`}>{label}</Label><p className="text-zinc-500 text-xs">{desc}</p></div>
                          <span className="text-white font-bold text-lg">{thresholds[key as keyof typeof thresholds]}</span>
                        </div>
                        <Slider value={[thresholds[key as keyof typeof thresholds]]} min={0} max={100} step={5}
                          onValueChange={([v]) => setThresholds(t => ({ ...t, [key]: v }))} />
                      </div>
                    ))}
                    <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400" onClick={() => setThresholds(DEFAULT_THRESHOLDS)}>
                      <RotateCcw className="h-3 w-3 mr-1" />Reset defaults
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="rules" className="mt-4">
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader><CardTitle className="text-sm text-zinc-300">Custom CEL Rules</CardTitle>
                    <CardDescription className="text-zinc-500 text-xs">Per-tenant business logic evaluated on top of base signals</CardDescription></CardHeader>
                  <CardContent className="space-y-4">
                    {customRules.map(rule => (
                      <div key={rule.id} className="rounded-lg border border-zinc-700 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-white text-sm font-medium">{rule.name}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="border-zinc-600 text-zinc-400 text-xs">+{rule.score} pts</Badge>
                            <Switch checked={rule.enabled} onCheckedChange={v => setCustomRules(r => r.map(x => x.id === rule.id ? { ...x, enabled: v } : x))} />
                          </div>
                        </div>
                        <code className="text-xs text-indigo-300 bg-zinc-800 rounded px-2 py-1 block">{rule.condition}</code>
                      </div>
                    ))}
                    <div className="rounded-lg border border-dashed border-zinc-700 p-3 text-center text-zinc-500 text-sm">
                      + Add custom rule (available in production Go service)
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <Button className="w-full bg-indigo-600 hover:bg-indigo-700 h-11 text-base" onClick={evaluate} disabled={loading}>
              {loading ? "Evaluating..." : <><Play className="h-4 w-4 mr-2" />Run Risk Evaluation</>}
            </Button>
          </div>

          {/* RIGHT — RESULT */}
          <div className="space-y-4">
            {result ? (
              <>
                <Card className={`border ${levelBg(result.level)}`}>
                  <CardContent className="pt-6 text-center space-y-2">
                    <LevelIcon l={result.level} />
                    <div className="text-6xl font-black text-white">{result.score}</div>
                    <Badge variant="outline" className={`${levelBg(result.level)} ${levelColor(result.level)} text-base px-4 py-1`}>{result.level?.toUpperCase()}</Badge>
                    <div className="text-sm text-zinc-300">Decision: <span className="font-bold text-white">{result.decision?.toUpperCase()}</span></div>
                  </CardContent>
                </Card>

                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader className="pb-2"><CardTitle className="text-xs text-zinc-400 uppercase tracking-wide">Active Signals</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {result.signals?.length === 0 && <p className="text-zinc-500 text-sm">No risk signals detected</p>}
                    {result.signals?.map((s: any, i: number) => (
                      <div key={i} className="flex justify-between items-start py-1.5 border-b border-zinc-800 last:border-0">
                        <div>
                          <div className="text-sm text-white">{s.name}</div>
                          <div className="text-xs text-zinc-500">{s.description}</div>
                        </div>
                        <span className="text-orange-400 font-mono font-bold text-sm ml-2">+{s.score}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader className="pb-2"><CardTitle className="text-xs text-zinc-400 uppercase tracking-wide">Auth Decision</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {[
                      { d: "allow", label: "✅ Allow — low friction login", desc: `Score < ${thresholds.low}` },
                      { d: "step_up", label: "⚠️ Step-up SCA required", desc: `Score ${thresholds.low}–${thresholds.medium}` },
                      { d: "mfa_required", label: "🔐 Strong MFA required", desc: `Score ${thresholds.medium}–${thresholds.high}` },
                      { d: "challenge", label: "🚨 Challenge + notify user", desc: `Score ${thresholds.high}–${thresholds.block}` },
                      { d: "block", label: "🛑 Blocked", desc: `Score ≥ ${thresholds.block}` },
                    ].map(({ d, label, desc }) => (
                      <div key={d} className={`rounded px-3 py-2 flex justify-between ${result.decision === d ? "bg-indigo-600/20 border border-indigo-500/40" : "opacity-40"}`}>
                        <span className="text-white">{label}</span>
                        <span className="text-zinc-400 text-xs">{desc}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="py-12 text-center text-zinc-500">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-3 opacity-40" />
                  <p>Configure a scenario and run evaluation</p>
                </CardContent>
              </Card>
            )}

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2"><CardTitle className="text-xs text-zinc-400 uppercase tracking-wide">How it works</CardTitle></CardHeader>
              <CardContent className="text-xs text-zinc-500 space-y-1">
                <p>• Signals evaluated in parallel goroutines</p>
                <p>• Each signal adds weighted score</p>
                <p>• Total compared to tenant thresholds</p>
                <p>• Decision returned in JWT claim <code className="text-indigo-300">risk_lvl</code></p>
                <p>• Per-tenant config overrides via JSONB</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
