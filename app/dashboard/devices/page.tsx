"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Monitor, Smartphone, Globe, Trash2, Shield, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface Device {
  id: string;
  platform: string;
  name: string;
  status: string;
  attestation_type: string;
  attestation_verified: boolean;
  last_seen_at: string;
  last_seen_ip: string;
  created_at: string;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDevices = async () => {
    const r = await fetch("/api/devices");
    if (r.ok) setDevices((await r.json()).devices);
    setLoading(false);
  };

  useEffect(() => { fetchDevices(); }, []);

  const revoke = async (deviceId: string) => {
    const r = await fetch("/api/devices", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId }) });
    if (r.ok) { toast.success("Device revoked"); fetchDevices(); }
    else toast.error("Failed to revoke");
  };

  const platformIcon = (platform: string) => {
    if (platform === "ios" || platform === "android") return <Smartphone className="h-5 w-5" />;
    if (platform === "windows" || platform === "macos") return <Monitor className="h-5 w-5" />;
    return <Globe className="h-5 w-5" />;
  };

  const attestationColor = (type: string) => {
    if (type === "apple") return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    if (type === "android") return "bg-green-500/10 text-green-400 border-green-500/30";
    if (type === "windows") return "bg-purple-500/10 text-purple-400 border-purple-500/30";
    return "bg-zinc-500/10 text-zinc-400 border-zinc-500/30";
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Registered Devices</h1>
        <p className="text-zinc-400 mt-1">Devices linked to your account with attestation status</p>
      </div>

      {loading ? (
        <div className="text-zinc-400">Loading...</div>
      ) : devices.length === 0 ? (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="py-12 text-center text-zinc-500">
            No devices registered. Visit <a href="/platform/device-attestation" className="text-indigo-400 underline">Device Attestation</a> to register one.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {devices.map(device => (
            <Card key={device.id} className="bg-zinc-900 border-zinc-800">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="text-zinc-400">{platformIcon(device.platform)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{device.name}</span>
                    <Badge variant="outline" className={attestationColor(device.attestation_type)}>
                      {device.attestation_type}
                    </Badge>
                    {device.attestation_verified
                      ? <ShieldCheck className="h-4 w-4 text-green-400" />
                      : <Shield className="h-4 w-4 text-zinc-500" />}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    Last seen {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : "never"} · {device.last_seen_ip || "unknown IP"}
                  </div>
                </div>
                <Badge variant="outline" className="border-zinc-700 text-zinc-400">{device.status}</Badge>
                <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => revoke(device.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
