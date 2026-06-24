"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Shield, Key, Smartphone, Activity, LogOut, ChevronRight, Copy, CheckCircle, User, Clock, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import RiskBadge from "@/components/demo/RiskBadge";
import JWTInspector from "@/components/demo/JWTInspector";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [claims, setClaims] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me").then(async r => {
      if (r.status === 401) { router.push("/login"); return; }
      const data = await r.json();
      setUser(data.user);
      setClaims(data.claims);
      setLoading(false);
    });
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Signed out");
    router.push("/login");
  }

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /></div>;

  const demoCards = [
    { icon: Activity, title: "Risk Engine", desc: "Live adaptive risk scoring", href: "/demo/risk", color: "text-yellow-400", badge: "Live" },
    { icon: Shield, title: "SCA / MFA", desc: "TOTP enrollment + PSD2 challenges", href: "/demo/sca", color: "text-red-400", badge: "PSD2" },
    { icon: Key, title: "WebAuthn", desc: "Register and use passkeys", href: "/demo/webauthn", color: "text-purple-400", badge: "FIDO2" },
    { icon: Smartphone, title: "Device Binding", desc: "Attest and bind devices to JWTs", href: "/demo/device", color: "text-green-400", badge: "TPM" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-400" />
          <span className="font-semibold">Auth Service</span>
          <Badge variant="secondary" className="text-xs">Demo</Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            {user?.email}
          </div>
          <Button variant="ghost" size="sm" onClick={logout} className="gap-1 text-gray-400 hover:text-white">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-blue-500/10">
              <User className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Welcome, {user?.display_name ?? user?.email}</h1>
              <p className="text-sm text-gray-400">Authenticated · {claims?.acr === "silver" ? "SCA completed" : "Password auth"}</p>
            </div>
            {claims?.risk !== undefined && <RiskBadge score={claims.risk} level={claims.risk_lvl} />}
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="bg-gray-900 border border-white/10 mb-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="token">JWT Inspector</TabsTrigger>
            <TabsTrigger value="sessions" onClick={() => router.push("/dashboard/sessions")}>Sessions</TabsTrigger>
            <TabsTrigger value="devices" onClick={() => router.push("/dashboard/devices")}>Devices</TabsTrigger>
            <TabsTrigger value="audit" onClick={() => router.push("/dashboard/audit")}>Audit Log</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Demo features grid */}
            <div>
              <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Live Feature Demos</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {demoCards.map(c => (
                  <Link key={c.title} href={c.href}>
                    <Card className="bg-gray-900 border-white/10 hover:border-white/20 hover:bg-gray-800 transition-all cursor-pointer h-full">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <c.icon className={`w-6 h-6 ${c.color}`} />
                          <Badge variant="outline" className="text-xs border-white/10 text-gray-400">{c.badge}</Badge>
                        </div>
                        <h3 className="font-medium text-white mb-1">{c.title}</h3>
                        <p className="text-xs text-gray-400">{c.desc}</p>
                        <div className="mt-3 flex items-center gap-1 text-xs text-blue-400">
                          Open demo <ChevronRight className="w-3 h-3" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>

            {/* Current session info */}
            <Card className="bg-gray-900 border-white/10">
              <CardHeader><CardTitle className="text-sm text-gray-300">Current Session</CardTitle></CardHeader>
              <CardContent className="grid sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs mb-1">Session ID</p>
                  <p className="text-gray-300 font-mono text-xs truncate">{claims?.sid ?? "—"}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Auth Methods (AMR)</p>
                  <div className="flex gap-1 flex-wrap">{(claims?.amr ?? []).map((m: string) => <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>)}</div>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">ACR Level</p>
                  <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">{claims?.acr ?? "—"}</Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="token">
            <JWTInspector />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
