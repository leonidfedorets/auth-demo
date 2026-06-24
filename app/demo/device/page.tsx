"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Smartphone, ArrowLeft, ShieldCheck, ShieldX, Loader2, Trash2, MonitorCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

async function getFingerprint(): Promise<string> {
  const parts = [navigator.userAgent, navigator.language, screen.width, screen.height, new Date().getTimezoneOffset(), navigator.hardwareConcurrency];
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parts.join("|")));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

function getPlatform(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Mac/.test(ua)) return "macos";
  if (/Win/.test(ua)) return "windows";
  return "web";
}

export default function DeviceDemoPage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fingerprint, setFingerprint] = useState("");

  useEffect(() => {
    loadDevices();
    getFingerprint().then(setFingerprint);
  }, []);

  async function loadDevices() {
    const res = await fetch("/api/devices");
    if (res.ok) { const { devices: d } = await res.json(); setDevices(d); }
  }

  async function registerDevice(attestationType: string) {
    setLoading(true);
    try {
      const fp = await getFingerprint();
      const platform = getPlatform();
      const res = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint: fp, platform, name: `${platform} (${attestationType})`, attestationType }),
      });
      if (res.status === 401) { toast.error("Please log in first"); return; }
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(`Device ${data.status === "known" ? "recognized" : "registered"}${attestationType !== "none" ? ` with ${attestationType} attestation` : ""}`);
      loadDevices();
    } finally {
      setLoading(false);
    }
  }

  async function revokeDevice(id: string) {
    await fetch("/api/devices", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: id }) });
    toast.success("Device revoked");
    loadDevices();
  }

  const attestationMethods = [
    { id: "none", label: "No Attestation", desc: "Browser fingerprint only", badge: "Low Trust", badgeColor: "text-gray-400 border-gray-400/20" },
    { id: "apple", label: "Apple App Attest", desc: "Simulates iOS device attestation flow", badge: "High Trust", badgeColor: "text-green-400 border-green-500/20" },
    { id: "android", label: "Android Play Integrity", desc: "Simulates Google Play Integrity token", badge: "High Trust", badgeColor: "text-green-400 border-green-500/20" },
    { id: "windows", label: "Windows TPM/Hello", desc: "Simulates Windows Health Attestation", badge: "High Trust", badgeColor: "text-green-400 border-green-500/20" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-white/10 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard"><Button variant="ghost" size="sm" className="gap-2 text-gray-400"><ArrowLeft className="w-4 h-4" />Dashboard</Button></Link>
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-green-400" />
          <span className="font-semibold">Device Attestation</span>
        </div>
        <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">Device Binding</Badge>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Device Registration & Attestation</h1>
          <p className="text-gray-400">Register your current device with different attestation types. The device ID is embedded in JWTs as the <code className="text-green-400">did</code> claim, cryptographically binding tokens to this device.</p>
        </div>

        {fingerprint && (
          <Card className="bg-gray-900 border-white/10 mb-6">
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500 mb-1">Your Device Fingerprint</p>
              <code className="text-sm text-green-400 font-mono">{fingerprint}</code>
              <p className="text-xs text-gray-500 mt-1">SHA-256 of UA + language + screen + timezone + hardware concurrency</p>
            </CardContent>
          </Card>
        )}

        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {attestationMethods.map(m => (
            <Card key={m.id} className="bg-gray-900 border-white/10">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm text-white">{m.label}</CardTitle>
                  <Badge variant="outline" className={`text-xs ${m.badgeColor}`}>{m.badge}</Badge>
                </div>
                <CardDescription className="text-gray-500 text-xs">{m.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => registerDevice(m.id)} disabled={loading} size="sm" variant={m.id === "none" ? "outline" : "default"} className={`w-full ${m.id === "none" ? "border-white/10 text-gray-300" : ""}`}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MonitorCheck className="w-4 h-4 mr-2" />}
                  Register with {m.label.split(" ").pop()}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {devices.length > 0 && (
          <Card className="bg-gray-900 border-white/10">
            <CardHeader><CardTitle className="text-sm text-gray-300">Registered Devices ({devices.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {devices.map(d => (
                <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 border border-white/5">
                  {d.attestation_verified ? <ShieldCheck className="w-5 h-5 text-green-400 shrink-0" /> : <ShieldX className="w-5 h-5 text-gray-500 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{d.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs border-white/10 text-gray-400">{d.platform}</Badge>
                      <Badge variant="outline" className={`text-xs ${d.attestation_verified ? "border-green-500/20 text-green-400" : "border-gray-500/20 text-gray-500"}`}>
                        {d.attestation_type}
                      </Badge>
                      <span className="text-xs text-gray-500 font-mono">{d.id.slice(0, 8)}...</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-gray-500 hover:text-red-400 shrink-0" onClick={() => revokeDevice(d.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="bg-gray-900 border-white/10 mt-6">
          <CardHeader><CardTitle className="text-sm text-gray-300">JWT Device Binding Claims</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-xs text-gray-400 font-mono">{JSON.stringify({ did: "device-uuid", dfp: fingerprint || "a3f9c2b1...", attestation_type: "apple", attestation_verified: true }, null, 2)}</pre>
            <p className="text-xs text-gray-600 mt-2">These claims are embedded in the access token and verified on every API call by downstream services.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
