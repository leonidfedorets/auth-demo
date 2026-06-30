"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity, Shield, Key, Smartphone, Users, Monitor,
  ChevronRight, FileText, Globe, Lock, BarChart2, Zap,
  AlertTriangle, Cpu, Building2, Workflow, X, CheckCircle2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DashNav } from "@/components/dash-nav";

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
  const [user, setUser] = useState<any>(null);
  const [claims, setClaims] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [kybCount, setKybCount] = useState<number | null>(null);
  const [onboardingStepCount, setOnboardingStepCount] = useState<number | null>(null);
  const [onboardingFlowCount, setOnboardingFlowCount] = useState<number | null>(null);

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
    fetch("/api/audit?limit=20").then(async r => {
      if (!r.ok) return;
      const data = await r.json();
      const notable = (data.logs ?? []).filter((l: any) =>
        l.outcome === "failure" || l.outcome === "failed" || (l.risk_score ?? 0) >= 60
      ).slice(0, 3);
      setAlerts(notable);
    });
    // Read localStorage counts (client-side only)
    try {
      const kybRaw = localStorage.getItem("kyb_data_v4");
      if (kybRaw) setKybCount((JSON.parse(kybRaw).clients ?? []).length);
      const stepsRaw = localStorage.getItem("onboarding_steps_v2");
      if (stepsRaw) setOnboardingStepCount((JSON.parse(stepsRaw) ?? []).length);
      const flowsRaw = localStorage.getItem("onboarding_flows_v3");
      if (flowsRaw) setOnboardingFlowCount((JSON.parse(flowsRaw) ?? []).length);
    } catch {}
  }, [router]);

  if (!user && loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const planBadgeClass = "bg-indigo-500/15 text-indigo-300 border-indigo-500/30";
  const tenantName = user?.displayName ?? user?.email?.split("@")[0] ?? "Tenant";
  const tenantId = stats?.tid ?? claims?.tid ?? "—";
  const tenantIdDisplay = (!tenantId || tenantId === "default") ? (claims?.sub ?? "—") : tenantId;
  const isBlank = !loading && (stats?.totalTransactions ?? 0) === 0 && (stats?.totalUsers ?? 0) === 0;
  const visibleAlerts = alerts.filter(a => !dismissedAlerts.has(a.id));

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <DashNav user={user} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Alert banner */}
        {visibleAlerts.length > 0 && (
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-3 space-y-1.5">
            <p className="text-orange-400 text-[10px] uppercase tracking-wide font-semibold mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" /> Notable events requiring attention
            </p>
            {visibleAlerts.map((a: any) => (
              <div key={a.id} className="flex items-start justify-between gap-3 text-xs">
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${a.outcome === "failure" || a.outcome === "failed" ? "bg-red-400" : "bg-orange-400"}`} />
                  <div>
                    <span className="text-zinc-300">{a.action?.replace(/\./g, " ")}</span>
                    {a.client_email && <span className="text-zinc-500 ml-1.5">· {a.client_email}</span>}
                    {a.risk_score != null && <span className="text-orange-400 ml-1.5 font-mono">risk {a.risk_score}</span>}
                  </div>
                </div>
                <button onClick={() => setDismissedAlerts(s => new Set([...s, a.id]))} className="text-zinc-600 hover:text-zinc-400 shrink-0 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <Link href="/dashboard/audit" className="text-orange-400/70 hover:text-orange-400 text-[10px] mt-1 block">
              View all in Audit Log →
            </Link>
          </div>
        )}

        {/* Tenant identity card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <span className="text-indigo-300 font-black text-lg uppercase">{tenantName[0]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-base font-bold text-white capitalize">{tenantName}</h1>
              <Badge className={`text-[10px] border ${planBadgeClass}`}>Starter Plan</Badge>
              <Link href="/pricing" className="text-[10px] text-indigo-400 hover:text-indigo-300">Upgrade →</Link>
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

        {/* Getting-started checklist (only when account is empty) */}
        {isBlank && (
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5">
            <h2 className="text-sm font-bold text-white mb-1">Get started with UTH</h2>
            <p className="text-zinc-500 text-xs mb-4">Follow these steps to send your first auth event.</p>
            <div className="space-y-3">
              {[
                { n: "01", label: "Create an application", desc: "Go to Settings → Applications and create your first app to get an API key.", href: "/dashboard/settings", done: false },
                { n: "02", label: "Copy your API key", desc: "Use the key in your backend to authenticate requests to UTH.", href: "/dashboard/settings", done: false },
                { n: "03", label: "Register your first client", desc: "Call POST /api/auth/register with your API key to create a user.", href: "/docs", done: false },
                { n: "04", label: "Run a risk evaluation", desc: "Hit the Platform Playground to see a live risk score.", href: "/platform/risk-engine", done: false },
              ].map(s => (
                <Link key={s.n} href={s.href} className="flex items-start gap-3 group">
                  <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 group-hover:border-indigo-500/50 transition-colors">
                    <span className="text-zinc-500 text-[9px] font-bold">{s.n}</span>
                  </div>
                  <div>
                    <p className="text-zinc-300 text-xs font-medium group-hover:text-white transition-colors">{s.label}</p>
                    <p className="text-zinc-600 text-[10px]">{s.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* KPI grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total Transactions", value: stats?.totalTransactions?.toLocaleString() ?? "—", sparkline: stats?.txLast7Days, sub: "auth events" },
            { label: "Total Users", value: stats?.totalUsers?.toLocaleString() ?? "—", sparkline: null, sub: "unique identities" },
            { label: "Bound Devices", value: stats?.boundDevices?.toLocaleString() ?? "—", sparkline: null, sub: "across all users" },
            { label: "Active Sessions", value: stats?.activeSessions?.toLocaleString() ?? "—", sparkline: null, sub: "right now" },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-zinc-500 text-[10px] uppercase tracking-wide">{kpi.label}</p>
              <p className="text-2xl font-black text-white mt-1">{kpi.value}</p>
              {kpi.sparkline ? <Sparkline data={kpi.sparkline} /> : <p className="text-zinc-600 text-[10px] mt-2">{kpi.sub}</p>}
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
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-2">
            {[
              { icon: BarChart2, label: "Transactions", count: stats?.totalTransactions != null ? stats.totalTransactions.toLocaleString() : "—", href: "/dashboard/transactions" },
              { icon: Users, label: "Clients", count: stats?.totalUsers != null ? `${stats.totalUsers} users` : "—", href: "/dashboard/clients" },
              { icon: Monitor, label: "Devices", count: stats?.boundDevices != null ? `${stats.boundDevices} bound` : "—", href: "/dashboard/devices" },
              { icon: Globe, label: "Sessions", count: stats?.activeSessions != null ? `${stats.activeSessions} active` : "—", href: "/dashboard/sessions" },
              { icon: FileText, label: "Audit Log", count: stats ? `${stats.auditToday ?? 0} today` : "—", href: "/dashboard/audit" },
              { icon: Building2, label: "KYB", count: kybCount != null ? `${kybCount} clients` : "—", href: "/dashboard/kyb" },
              { icon: Workflow, label: "Onboarding", count: onboardingStepCount != null ? `${onboardingStepCount} steps` : "—", href: "/dashboard/onboarding" },
              { icon: AlertTriangle, label: "Risk Rules", count: "Configure", href: "/dashboard/risk-rules" },
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
