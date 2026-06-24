"use client";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Activity, ArrowLeft, Loader2, Shield, AlertTriangle, XCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RiskBadge from "@/components/demo/RiskBadge";

const presets = [
  { label: "Legitimate User", ip: "192.168.1.1", ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", isNewDevice: false, country: "DE", previousCountry: "DE" },
  { label: "New Device", ip: "203.0.113.50", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", isNewDevice: true, country: "DE", previousCountry: "DE" },
  { label: "Tor Exit Node", ip: "185.220.101.10", ua: "Mozilla/5.0 (Windows NT 10.0)", isNewDevice: false, country: "DE", previousCountry: "DE" },
  { label: "VPN + New Country", ip: "104.153.10.5", ua: "Mozilla/5.0 (Linux; Android 14)", isNewDevice: true, country: "US", previousCountry: "DE" },
  { label: "Headless Scraper", ip: "141.98.10.20", ua: "HeadlessChrome/120.0.0.0", isNewDevice: true, country: "RU", previousCountry: "DE" },
  { label: "Credential Stuffing", ip: "185.220.200.5", ua: "python-requests/2.31.0", isNewDevice: true, country: "CN", previousCountry: "DE" },
];

const signalColors: Record<string, string> = {
  velocity: "bg-orange-500",
  tor_exit_node: "bg-red-500",
  vpn_proxy: "bg-yellow-500",
  new_device: "bg-blue-500",
  geo_anomaly: "bg-purple-500",
  suspicious_ua: "bg-pink-500",
  headless_browser: "bg-red-600",
};

export default function RiskDemoPage() {
  const [params, setParams] = useState(presets[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function evaluate() {
    setLoading(true);
    try {
      const res = await fetch("/api/risk/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params) });
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  function loadPreset(label: string) {
    const p = presets.find(p => p.label === label);
    if (p) setParams(p);
  }

  const scoreColor = result ? (result.score >= 80 ? "text-red-400" : result.score >= 60 ? "text-orange-400" : result.score >= 30 ? "text-yellow-400" : "text-green-400") : "";
  const progressColor = result ? (result.score >= 80 ? "bg-red-500" : result.score >= 60 ? "bg-orange-500" : result.score >= 30 ? "bg-yellow-500" : "bg-green-500") : "";

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-white/10 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard"><Button variant="ghost" size="sm" className="gap-2 text-gray-400"><ArrowLeft className="w-4 h-4" />Dashboard</Button></Link>
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-yellow-400" />
          <span className="font-semibold">Risk Engine Demo</span>
        </div>
        <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-400">Adaptive Scoring</Badge>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Adaptive Risk Evaluation</h1>
          <p className="text-gray-400">The risk engine evaluates every authentication request using multiple signals. Configure the inputs below or pick a preset to see scoring in real time.</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="space-y-4">
            <Card className="bg-gray-900 border-white/10">
              <CardHeader>
                <CardTitle className="text-sm text-gray-300">Presets</CardTitle>
                <CardDescription className="text-gray-500">Load a scenario to see how the risk engine reacts</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {presets.map(p => (
                  <Button key={p.label} variant="outline" size="sm" className="border-white/10 text-gray-300 hover:text-white text-xs justify-start" onClick={() => { loadPreset(p.label); setResult(null); }}>
                    {p.label}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-white/10">
              <CardHeader><CardTitle className="text-sm text-gray-300">Request Parameters</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">IP Address</Label>
                  <Input value={params.ip} onChange={e => setParams(p => ({ ...p, ip: e.target.value }))} className="bg-gray-800 border-white/10 text-white font-mono text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">User Agent</Label>
                  <Input value={params.ua} onChange={e => setParams(p => ({ ...p, ua: e.target.value }))} className="bg-gray-800 border-white/10 text-white text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">Country (current)</Label>
                    <Input value={params.country} onChange={e => setParams(p => ({ ...p, country: e.target.value }))} className="bg-gray-800 border-white/10 text-white" maxLength={2} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">Previous Country</Label>
                    <Input value={params.previousCountry} onChange={e => setParams(p => ({ ...p, previousCountry: e.target.value }))} className="bg-gray-800 border-white/10 text-white" maxLength={2} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="newDevice" checked={params.isNewDevice} onChange={e => setParams(p => ({ ...p, isNewDevice: e.target.checked }))} className="rounded" />
                  <Label htmlFor="newDevice" className="text-xs text-gray-400">New / unknown device</Label>
                </div>
                <Button onClick={evaluate} disabled={loading} className="w-full gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                  Evaluate Risk
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Result Panel */}
          <div className="space-y-4">
            {result ? (
              <>
                <Card className="bg-gray-900 border-white/10">
                  <CardContent className="pt-6">
                    <div className="text-center mb-6">
                      <div className={`text-6xl font-bold mb-2 ${scoreColor}`}>{result.score}</div>
                      <p className="text-gray-400 text-sm mb-3">Risk Score (0–100)</p>
                      <RiskBadge score={result.score} level={result.level} />
                    </div>
                    <div className="mb-6">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>0 — Safe</span>
                        <span>100 — Block</span>
                      </div>
                      <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${progressColor}`} style={{ width: `${result.score}%` }} />
                      </div>
                    </div>
                    <div className="rounded-lg border p-3 text-center" style={{ borderColor: result.decision === "deny" ? "#ef4444" : result.decision === "challenge" ? "#f59e0b" : "#22c55e" }}>
                      <p className="text-xs text-gray-400 mb-1">Decision</p>
                      <div className={`text-lg font-bold uppercase tracking-wider ${result.decision === "deny" ? "text-red-400" : result.decision === "challenge" ? "text-yellow-400" : "text-green-400"}`}>
                        {result.decision === "deny" ? "🚫 Deny" : result.decision === "challenge" ? "⚠️ Challenge (SCA)" : "✅ Allow"}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {result.signals?.length > 0 && (
                  <Card className="bg-gray-900 border-white/10">
                    <CardHeader><CardTitle className="text-sm text-gray-300">Triggered Signals</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {result.signals.map((s: any) => (
                        <div key={s.name} className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${signalColors[s.name] ?? "bg-gray-400"}`} />
                          <div className="flex-1">
                            <p className="text-sm text-gray-300">{s.description}</p>
                            {s.data && <p className="text-xs text-gray-500">{JSON.stringify(s.data)}</p>}
                          </div>
                          <Badge variant="outline" className="text-xs border-white/10 text-gray-400">+{s.score}</Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="bg-gray-900 border-white/10 h-64 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Select a preset and click Evaluate Risk</p>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Signal Weights */}
        <Card className="bg-gray-900 border-white/10 mt-6">
          <CardHeader><CardTitle className="text-sm text-gray-300">Signal Weights (configurable per-tenant)</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {[
              { name: "Failed Login Velocity", weight: 30, cls: "bg-orange-500" },
              { name: "Tor Exit Node", weight: 25, cls: "bg-red-500" },
              { name: "Geo Anomaly", weight: 20, cls: "bg-purple-500" },
              { name: "IP Reputation", weight: 20, cls: "bg-blue-500" },
              { name: "Impossible Travel", weight: 30, cls: "bg-pink-500" },
              { name: "New Device", weight: 15, cls: "bg-cyan-500" },
              { name: "VPN / Proxy", weight: 10, cls: "bg-yellow-500" },
              { name: "Suspicious UA", weight: 15, cls: "bg-gray-400" },
            ].map(s => (
              <div key={s.name} className="space-y-1">
                <div className="flex justify-between text-gray-400">
                  <span>{s.name}</span>
                  <span className="text-white">+{s.weight}</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full"><div className={`h-full rounded-full ${s.cls}`} style={{ width: `${(s.weight / 30) * 100}%` }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
