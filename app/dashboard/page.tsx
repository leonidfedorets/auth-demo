"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Shield, Key, Smartphone, Activity, LogOut, ChevronRight,
  Copy, CheckCircle, User, Layers, Globe, FileText, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import RiskBadge from "@/components/demo/RiskBadge";
import JWTInspector from "@/components/demo/JWTInspector";

const PLATFORM_LINKS = [
  { icon: Activity, title: "Risk Engine", desc: "Auth Risk + Engine Risk evaluation", href: "/platform/risk-engine", color: "text-yellow-400", badge: "Live" },
  { icon: Shield, title: "SCA / PSD2", desc: "Step-up auth and challenge management", href: "/platform/sca", color: "text-red-400", badge: "PSD2" },
  { icon: Key, title: "Passkeys", desc: "WebAuthn / FIDO2 credential management", href: "/platform/passkeys", color: "text-purple-400", badge: "FIDO2 L2" },
  { icon: Smartphone, title: "Device Attestation", desc: "Device trust signals and binding", href: "/platform/device-attestation", color: "text-green-400", badge: "TPM" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [claims, setClaims] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

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

  function copyUserId() {
    if (claims?.sub) {
      navigator.clipboard.writeText(claims.sub);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const acrLabel: Record<string, string> = { gold: "Gold (hardware key)", silver: "Silver (MFA)", bronze: "Bronze (password)" };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Nav */}
      <nav className="border-b border-white/8 px-6 py-4 flex items-center justify-between sticky top-0 bg-zinc-950/90 backdrop-blur-xl z-40">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            <span className="font-bold text-white">AuthService</span>
          </Link>
          <div className="hidden md:flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-white font-medium">Overview</Link>
            <Link href="/dashboard/sessions" className="text-zinc-400 hover:text-white transition-colors">Sessions</Link>
            <Link href="/dashboard/devices" className="text-zinc-400 hover:text-white transition-colors">Devices</Link>
            <Link href="/dashboard/audit" className="text-zinc-400 hover:text-white transition-colors">Audit log</Link>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            {user?.email}
          </div>
          <Button variant="ghost" size="sm" onClick={logout} className="text-zinc-400 hover:text-white">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <User className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">
                {user?.display_name ?? user?.email?.split("@")[0]}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-zinc-500 font-mono">{claims?.sub?.slice(0, 20)}…</span>
                <button onClick={copyUserId} className="cursor-pointer text-zinc-600 hover:text-zinc-400 transition-colors">
                  {copied ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
            {claims?.risk !== undefined && (
              <RiskBadge score={claims.risk} level={claims.risk_lvl} />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-green-500/30 text-green-400 text-xs">
              Active session
            </Badge>
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="bg-zinc-900 border border-white/8 mb-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="token">Token</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Session summary */}
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                {
                  label: "Auth Methods (AMR)",
                  value: <div className="flex gap-1 flex-wrap mt-1">{(claims?.amr ?? []).map((m: string) => (
                    <Badge key={m} variant="secondary" className="text-xs capitalize">{m}</Badge>
                  ))}</div>,
                },
                {
                  label: "Assurance Level (ACR)",
                  value: <div className="mt-1"><Badge variant="outline" className="border-indigo-500/30 text-indigo-400 text-xs">{acrLabel[claims?.acr ?? ""] ?? claims?.acr ?? "—"}</Badge></div>,
                },
                {
                  label: "SCA Status",
                  value: <div className="mt-1">
                    <Badge className={claims?.sca ? "bg-green-600 text-white border-0 text-xs" : "bg-zinc-700 text-zinc-300 border-0 text-xs"}>
                      {claims?.sca ? `Completed · ${claims.sca_method}` : "Not required"}
                    </Badge>
                  </div>,
                },
              ].map(item => (
                <Card key={item.label} className="bg-zinc-900 border-white/8">
                  <CardContent className="p-4">
                    <p className="text-zinc-500 text-xs">{item.label}</p>
                    {item.value}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Platform features */}
            <div>
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Platform</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {PLATFORM_LINKS.map(c => (
                  <Link key={c.title} href={c.href}>
                    <Card className="bg-zinc-900 border-white/8 hover:border-white/16 hover:bg-zinc-800/60 transition-all cursor-pointer h-full">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <c.icon className={`w-5 h-5 ${c.color}`} />
                          <Badge variant="outline" className="text-xs border-white/10 text-zinc-500">{c.badge}</Badge>
                        </div>
                        <h3 className="font-semibold text-white text-sm mb-1">{c.title}</h3>
                        <p className="text-xs text-zinc-500">{c.desc}</p>
                        <div className="mt-3 flex items-center gap-1 text-xs text-indigo-400">
                          Open <ChevronRight className="w-3 h-3" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>

            {/* Quick nav */}
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { icon: FileText, label: "Audit log", href: "/dashboard/audit", desc: "View all auth events" },
                { icon: Globe, label: "Sessions", href: "/dashboard/sessions", desc: "Manage active sessions" },
                { icon: Lock, label: "Devices", href: "/dashboard/devices", desc: "Trusted device list" },
              ].map(item => (
                <Link key={item.label} href={item.href}>
                  <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-zinc-900 hover:bg-zinc-800/60 hover:border-white/16 transition-all p-4 cursor-pointer">
                    <item.icon className="w-4 h-4 text-zinc-400 shrink-0" />
                    <div>
                      <div className="text-white text-sm font-medium">{item.label}</div>
                      <div className="text-zinc-500 text-xs">{item.desc}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-600 ml-auto" />
                  </div>
                </Link>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="token">
            <JWTInspector />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
