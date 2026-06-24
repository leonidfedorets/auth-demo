"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ── Mock data ──────────────────────────────────────────────────────────────────
type EventType =
  | "login" | "logout" | "settings_changed" | "risk_rule_updated"
  | "device_bound" | "device_revoked" | "sca_completed" | "session_expired"
  | "token_rotated" | "failed_login";

type Outcome = "success" | "failure";

interface AuditEvent {
  id: string;
  time: string;
  event: EventType;
  user: string;
  ip: string;
  details: string;
  outcome: Outcome;
}

const n = Date.now();
const t = (minAgo: number) => new Date(n - minAgo * 60000).toISOString();

const MOCK_AUDIT: AuditEvent[] = [
  { id: "evt-001", time: t(3), event: "login", user: "carol@acmecorp.io", ip: "195.43.97.222", details: "WebAuthn / Face ID · iPhone 15", outcome: "success" },
  { id: "evt-002", time: t(8), event: "sca_completed", user: "alice@acmecorp.io", ip: "82.77.42.11", details: "SCA method: TOTP · triggered by payment", outcome: "success" },
  { id: "evt-003", time: t(15), event: "failed_login", user: "bob@acmecorp.io", ip: "45.33.110.55", details: "Invalid password · attempt 2/5", outcome: "failure" },
  { id: "evt-004", time: t(22), event: "device_bound", user: "alice@acmecorp.io", ip: "82.77.42.11", details: "Galaxy S23 · android · fp_1a6d8c4f", outcome: "success" },
  { id: "evt-005", time: t(35), event: "login", user: "bob@acmecorp.io", ip: "31.14.128.5", details: "WebAuthn · Pixel 7 · acr:gold", outcome: "success" },
  { id: "evt-006", time: t(50), event: "risk_rule_updated", user: "alice@acmecorp.io", ip: "82.77.42.11", details: "Rule 'geo_velocity' threshold: 1000km → 500km/h", outcome: "success" },
  { id: "evt-007", time: t(65), event: "token_rotated", user: "carol@acmecorp.io", ip: "195.43.97.222", details: "Refresh token rotation · ses-ce1", outcome: "success" },
  { id: "evt-008", time: t(80), event: "session_expired", user: "bob@acmecorp.io", ip: "31.14.128.5", details: "Session ses-bd1 expired after 8h inactivity", outcome: "success" },
  { id: "evt-009", time: t(100), event: "failed_login", user: "unknown@external.io", ip: "104.21.88.31", details: "User not found · credential stuffing detected", outcome: "failure" },
  { id: "evt-010", time: t(140), event: "settings_changed", user: "alice@acmecorp.io", ip: "82.77.42.11", details: "MFA policy: required_for_admin → required_for_all", outcome: "success" },
  { id: "evt-011", time: t(200), event: "login", user: "alice@acmecorp.io", ip: "82.77.42.11", details: "Password + TOTP · MacBook Pro · acr:silver", outcome: "success" },
  { id: "evt-012", time: t(320), event: "device_revoked", user: "carol@acmecorp.io", ip: "195.43.97.222", details: "Firefox/Linux device revoked by tenant admin", outcome: "success" },
  { id: "evt-013", time: t(600), event: "sca_completed", user: "bob@acmecorp.io", ip: "31.14.128.5", details: "SCA method: WebAuthn · triggered by wire transfer", outcome: "success" },
  { id: "evt-014", time: t(900), event: "logout", user: "alice@acmecorp.io", ip: "82.77.42.11", details: "Manual logout · session ses-ab1 invalidated", outcome: "success" },
  { id: "evt-015", time: t(1200), event: "risk_rule_updated", user: "alice@acmecorp.io", ip: "82.77.42.11", details: "New rule 'new_device_step_up' added · action: require_sca", outcome: "success" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const EVENT_COLORS: Record<EventType, string> = {
  login: "text-green-400",
  logout: "text-zinc-400",
  settings_changed: "text-blue-400",
  risk_rule_updated: "text-indigo-400",
  device_bound: "text-cyan-400",
  device_revoked: "text-red-400",
  sca_completed: "text-green-300",
  session_expired: "text-zinc-500",
  token_rotated: "text-purple-400",
  failed_login: "text-red-400",
};

const EVENT_BADGES: Record<EventType, string> = {
  login: "bg-green-500/10 text-green-400 border-green-500/30",
  logout: "bg-zinc-500/10 text-zinc-400 border-zinc-700",
  settings_changed: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  risk_rule_updated: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
  device_bound: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  device_revoked: "bg-red-500/10 text-red-400 border-red-500/30",
  sca_completed: "bg-green-500/10 text-green-300 border-green-500/30",
  session_expired: "bg-zinc-800 text-zinc-500 border-zinc-700",
  token_rotated: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  failed_login: "bg-red-500/10 text-red-400 border-red-500/30",
};

// ── Nav ───────────────────────────────────────────────────────────────────────
function DashNav({ user, currentPath }: { user: any; currentPath: string }) {
  const [showMenu, setShowMenu] = useState(false);
  const NAV_ITEMS = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/transactions", label: "Transactions" },
    { href: "/dashboard/users", label: "Users" },
    { href: "/dashboard/devices", label: "Devices" },
    { href: "/dashboard/sessions", label: "Sessions" },
    { href: "/dashboard/audit", label: "Audit Log" },
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

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AuditPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [events, setEvents] = useState<AuditEvent[]>(MOCK_AUDIT);
  const [filter, setFilter] = useState<EventType | "all">("all");

  useEffect(() => {
    fetch("/api/auth/me").then(async r => {
      if (r.status === 401) { router.push("/login"); return; }
      const data = await r.json();
      setUser(data.user);
    });
  }, [router]);

  const filtered = filter === "all" ? events : events.filter(e => e.event === filter);
  const allTypes = Array.from(new Set(MOCK_AUDIT.map(e => e.event))) as EventType[];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <DashNav user={user} currentPath={pathname} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-base font-bold text-white">Audit Log</h1>
            <p className="text-zinc-500 text-xs mt-0.5">Tenant activity over the last 48 hours · {MOCK_AUDIT.length} events · PCI DSS Req 10 compliant</p>
          </div>
          <button onClick={() => setEvents([...MOCK_AUDIT])} className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-xs cursor-pointer transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button onClick={() => setFilter("all")} className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors cursor-pointer ${filter === "all" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}>All</button>
          {allTypes.map(t => (
            <button key={t} onClick={() => setFilter(t)} className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors cursor-pointer ${filter === t ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}>{t.replace(/_/g, " ")}</button>
          ))}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/50">
                  {["Time", "Event", "User", "IP", "Details", "Outcome"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-zinc-500 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(evt => (
                  <tr key={evt.id} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/20 transition-colors">
                    <td className="px-3 py-2.5 text-zinc-500 whitespace-nowrap font-mono">{timeAgo(evt.time)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Badge variant="outline" className={`text-[10px] ${EVENT_BADGES[evt.event]}`}>{evt.event.replace(/_/g, " ")}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-zinc-300 whitespace-nowrap">{evt.user}</td>
                    <td className="px-3 py-2.5 font-mono text-zinc-400">{evt.ip}</td>
                    <td className="px-3 py-2.5 text-zinc-400 max-w-[200px] truncate" title={evt.details}>{evt.details}</td>
                    <td className="px-3 py-2.5">
                      {evt.outcome === "success"
                        ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                        : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
