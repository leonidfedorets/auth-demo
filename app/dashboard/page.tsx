"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Activity, Shield, Key, Smartphone, Users, Monitor,
  ChevronRight, FileText, Globe, Lock, BarChart2, Zap,
  AlertTriangle, Cpu, Building2, Workflow
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

function DashNav({ user, currentPath }: { user: any; currentPath: string }) {
  const [showMenu, setShowMenu] = useState(false);
  const NAV_ITEMS = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/transactions", label: "Transactions" },
    { href: "/dashboard/clients", label: "Clients" },
    { href: "/dashboard/devices", label: "Devices" },
    { href: "/dashboard/sessions", label: "Sessions" },
    { href: "/dashboard/audit", label: "Audit Log" },
    { href: "/dashboard/kyb", label: "KYB" },
    { href: "/dashboard/onboarding", label: "Onboarding" },
    { href: "/dashboard/risk-rules", label: "Risk Rules" },
    { href: "/dashboard/settings", label: "Settings" },
  ];
  return (
    <nav className="border-b border-zinc-800 px-4 py-0 flex items-center bg-zinc-950 sticky top-0 z-40 h-11">
      <Link href="/" className="flex items-center gap-1.5 mr-5 shrink-0">
        <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center"><span className="font-black text-white text-[9px]">UTH</span></div>
        <span className="font-black text-sm tracking-tighter hidden sm:block"><span className="text-indigo-400">U</span><span className="text-indigo-300">T</span><span className="text-indigo-200">H</span></span>
      </Link>
      <div className="flex items-center gap-0.5 overflow-x-auto flex-1">
        {NAV_ITEMS.map(item => (
          <Link key={item.href} href={item.href} className={`px-3 py-2.5 text-xs whitespace-nowrap transition-colors border-b-2 -mb-px ${currentPath === item.href ? "border-indigo-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
            {item.label}
          </Link>
        ))}
      </div>
      <div className="relative ml-3 shrink-0">
        <button onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white cursor-pointer">
          <div className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center text-white font-bold text-xs">
            {user?.email?.[0]?.toUpperCase() || "?"}
          </div>
          <span className="hidden sm:block max-w-[120px] truncate">{user?.email}</span>
        </button>
        {showMenu && (
          <div className="absolute right-0 top-9 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl w-48 z-50 py-1">
            <div className="px-3 py-2 border-b border-zinc-800"><p className="text-white text-xs font-semibold truncate">{user?.email}</p><p className="text-zinc-500 text-[10px] font-mono truncate">{user?.id}</p></div>
            <Link href="/dashboard" onClick={() => setShowMenu(false)} className="block px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs">Dashboard</Link>
            <Link href="/dashboard/settings" onClick={() => setShowMenu(false)} className="block px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs">Settings</Link>
            <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }} className="w-full text-left px-3 py-2 text-red-400 hover:text-red-300 hover:bg-zinc-800 text-xs border-t border-zinc-800 cursor-pointer">Sign out</button>
          </div>
        )}
      </div>
    </nav>
  );
}

const SPARKBAR_HEIGHTS = [35, 22, 50, 42, 58, 47, 56];

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data);
  return (
    <div className="flex items-end gap-0.5 h-8 mt-2">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-indigo-500/60"
          style={{ height: `${Math.round((v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

const PLATFORM_FEATURES = [
  { icon: Activity, title: "Risk Engine", desc: "Real-time auth risk scoring and policy evaluation for every login event.", href: "/platform/risk-engine", color: "text-yellow-400", badge: "Live" },
  { icon: Shield, title: "SCA / PSD2", desc: "Strong Customer Authentication and step-up challenge management.", href: "/platform/sca", color: "text-red-400", badge: "PSD2" },
  { icon: Key, title: "WebAuthn / Passkeys", desc: "FIDO2 Level 2 passkey registration and passwordless authentication.", href: "/platform/passkeys", color: "text-purple-400", badge: "FIDO2 L2" },
  { icon: Smartphone, title: "Device Attestation", desc: "Cryptographic device trust signals via Apple/Android/TPM attestation.", href: "/platform/device-attestation", color: "text-green-400", badge: "TPM" },
  { icon: Lock, title: "Device Binding", desc: "Bind user identities to verified devices for step-up enforcement.", href: "/platform/device-binding", color: "text-cyan-400", badge: "Binding" },
  { icon: Cpu, title: "Engine Risk", desc: "Behavioral risk signals — velocity, geo anomaly, device reputation.", href: "/platform/engine-risk", color: "text-orange-400", badge: "ML" },
];

// Quick links counts are populated from stats

export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [claims, setClaims] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me").then(async r => {
      if (r.status === 401) { router.push("/login"); return; }
      const data = await r.json();
      setUser(data.user);
      setClaims(data.claims);
    });
    fetch("/api/admin/stats").then(async r => {
      if (r.ok) setStats(await r.json());
      setLoading(false);
    });
  }, [router]);

  if (!user && loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const planBadgeClass = "bg-indigo-500/15 text-indigo-300 border-indigo-500/30";
  const tenantName = user?.displayName ?? user?.email?.split("@")[0] ?? "Tenant";
  // tid from stats (most accurate — server-normalized) or from JWT claims
  const tenantId = stats?.tid ?? claims?.tid ?? "—";
  const tenantIdDisplay = (!tenantId || tenantId === "default") ? (claims?.sub ?? "—") : tenantId;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <DashNav user={user} currentPath={pathname} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Tenant identity card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <span className="text-indigo-300 font-black text-lg uppercase">{tenantName[0]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-base font-bold text-white capitalize">{tenantName}</h1>
              <Badge className={`text-[10px] border ${planBadgeClass}`}>Starter Plan</Badge>
              <Badge className="text-[10px] bg-green-500/10 text-green-400 border-green-500/30">Active</Badge>
            </div>
            <p className="text-zinc-500 text-xs font-mono truncate">Tenant ID: {tenantIdDisplay}</p>
            <p className="text-zinc-500 text-xs mt-0.5">{user?.email}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-zinc-600 text-[10px] uppercase tracking-wide">API Environment</p>
            <p className="text-green-400 text-xs font-mono mt-0.5">production</p>
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total Transactions", value: stats?.totalTransactions?.toLocaleString() ?? "—", sparkline: stats?.txLast7Days, sub: "+12% vs last week" },
            { label: "Total Users", value: stats?.totalUsers?.toLocaleString() ?? "—", sparkline: null, sub: "unique identities" },
            { label: "Bound Devices", value: stats?.boundDevices?.toLocaleString() ?? "—", sparkline: null, sub: "across all users" },
            { label: "Active Sessions", value: stats?.activeSessions?.toLocaleString() ?? "—", sparkline: null, sub: "right now" },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-zinc-500 text-[10px] uppercase tracking-wide">{kpi.label}</p>
              <p className="text-2xl font-black text-white mt-1">{kpi.value}</p>
              {kpi.sparkline ? (
                <Sparkline data={kpi.sparkline} />
              ) : (
                <p className="text-zinc-600 text-[10px] mt-2">{kpi.sub}</p>
              )}
              {kpi.sparkline && <p className="text-zinc-600 text-[10px] mt-1">{kpi.sub}</p>}
            </div>
          ))}
        </div>

        {/* Platform Playground */}
        <div>
          <div className="mb-4">
            <h2 className="text-sm font-bold text-white">Platform Playground</h2>
            <p className="text-zinc-500 text-xs mt-0.5">Test each feature flow — production requests appear in Transactions</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PLATFORM_FEATURES.map(f => (
              <Link key={f.title} href={f.href} className="rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800/60 transition-all cursor-pointer p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <f.icon className={`w-5 h-5 ${f.color}`} />
                  <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">{f.badge}</Badge>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{f.title}</h3>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-indigo-400 mt-auto">
                  Open Playground <ChevronRight className="w-3 h-3" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div>
          <h2 className="text-sm font-bold text-white mb-3">Quick Links</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {[
              { icon: BarChart2, label: "Transactions", count: stats?.totalTransactions != null ? stats.totalTransactions.toLocaleString() : "—", href: "/dashboard/transactions" },
              { icon: Users, label: "Clients", count: stats?.totalUsers != null ? stats.totalUsers.toLocaleString() : "—", href: "/dashboard/clients" },
              { icon: Monitor, label: "Devices", count: stats?.boundDevices != null ? stats.boundDevices.toLocaleString() : "—", href: "/dashboard/devices" },
              { icon: Globe, label: "Sessions", count: stats?.activeSessions != null ? stats.activeSessions.toLocaleString() : "—", href: "/dashboard/sessions" },
              { icon: FileText, label: "Audit Log", count: stats ? `${stats.auditToday ?? 0} today` : "—", href: "/dashboard/audit" },
              { icon: Building2, label: "KYB", count: "6 clients", href: "/dashboard/kyb" },
              { icon: Workflow, label: "Onboarding", count: "18 steps", href: "/dashboard/onboarding" },
              { icon: AlertTriangle, label: "Risk Rules", count: "12 active", href: "/dashboard/risk-rules" },
              { icon: Zap, label: "Settings", count: "Configure", href: "/dashboard/settings" },
            ].map(q => (
              <Link key={q.label} href={q.href} className="rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800/60 transition-all cursor-pointer p-3 flex flex-col items-center text-center gap-1.5">
                <q.icon className="w-4 h-4 text-indigo-400" />
                <p className="text-white text-xs font-medium">{q.label}</p>
                <p className="text-zinc-500 text-[10px]">{q.count}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
