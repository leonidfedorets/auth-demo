"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { X, Monitor, Smartphone, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Session {
  id: string;
  client_email: string;
  client_name: string;
  client_id: string;
  ip_address: string | null;
  user_agent: string | null;
  country: string | null;
  amr: string[] | null;
  acr: string | null;
  risk_score: number | null;
  sca_completed: boolean;
  status: string;
  expires_at: string;
  last_activity_at: string | null;
  created_at: string;
}

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function timeLeft(iso: string | null) {
  if (!iso) return "—";
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "expired";
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

function RiskChip({ score }: { score: number | null }) {
  if (score === null || score === undefined) return <span className="text-zinc-500 text-xs">—</span>;
  if (score < 20) return <span className="text-green-400 text-xs font-mono">{score}</span>;
  if (score < 50) return <span className="text-yellow-400 text-xs font-mono">{score}</span>;
  return <span className="text-red-400 text-xs font-mono">{score}</span>;
}

function AcrBadge({ acr }: { acr: string | null }) {
  if (!acr) return null;
  const map: Record<string, string> = {
    gold: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    silver: "bg-zinc-400/10 text-zinc-300 border-zinc-500/30",
    bronze: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  };
  return <Badge variant="outline" className={`text-[10px] capitalize ${map[acr] ?? "bg-zinc-700 text-zinc-400 border-zinc-600"}`}>{acr}</Badge>;
}

function DeviceIcon({ ua }: { ua: string | null }) {
  const s = (ua ?? "").toLowerCase();
  if (s.includes("iphone") || s.includes("android")) return <Smartphone className="w-3.5 h-3.5" />;
  return <Monitor className="w-3.5 h-3.5" />;
}

function DashNav({ user, currentPath }: { user: any; currentPath: string }) {
  const [showMenu, setShowMenu] = useState(false);
  const NAV_ITEMS = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/transactions", label: "Transactions" },
    { href: "/dashboard/clients", label: "Clients" },
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
          <div className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center text-white font-bold text-xs">{user?.email?.[0]?.toUpperCase() || "?"}</div>
          <span className="hidden sm:block max-w-[120px] truncate">{user?.email}</span>
        </button>
        {showMenu && (
          <div className="absolute right-0 top-9 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl w-48 z-50 py-1">
            <div className="px-3 py-2 border-b border-zinc-800"><p className="text-white text-xs font-semibold truncate">{user?.email}</p></div>
            <Link href="/dashboard" onClick={() => setShowMenu(false)} className="block px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs">Dashboard</Link>
            <Link href="/dashboard/settings" onClick={() => setShowMenu(false)} className="block px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs">Settings</Link>
            <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }} className="w-full text-left px-3 py-2 text-red-400 hover:text-red-300 hover:bg-zinc-800 text-xs border-t border-zinc-800 cursor-pointer">Sign out</button>
          </div>
        )}
      </div>
    </nav>
  );
}

function SessionPanel({ session, onClose, onRevoke, currentSid }: { session: Session; onClose: () => void; onRevoke: (id: string) => void; currentSid: string }) {
  const [revoking, setRevoking] = useState(false);

  const revoke = async () => {
    setRevoking(true);
    await fetch("/api/sessions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: session.id }) });
    onRevoke(session.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-zinc-900 border-l border-zinc-800 h-full overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-900">
          <span className="text-white font-semibold text-sm">Session Detail</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-5 text-xs">
          <Section title="Client">
            <Row label="Email" value={session.client_email} />
            {session.client_name && <Row label="Name" value={session.client_name} />}
            <Row label="Client ID" value={<span className="font-mono text-[10px] text-zinc-400 break-all">{session.client_id}</span>} />
          </Section>
          <Section title="Session">
            <Row label="Session ID" value={<span className="font-mono text-[10px] break-all">{session.id}</span>} />
            <Row label="Started" value={timeAgo(session.created_at)} />
            <Row label="Last active" value={timeAgo(session.last_activity_at)} />
            <Row label="Expires in" value={timeLeft(session.expires_at)} />
          </Section>
          <Section title="Network">
            <Row label="IP" value={<span className="font-mono">{session.ip_address || "—"}</span>} />
            <Row label="Country" value={session.country || "—"} />
          </Section>
          <Section title="Auth Claims">
            <Row label="ACR" value={<AcrBadge acr={session.acr} />} />
            <Row label="AMR" value={(session.amr ?? []).join(", ") || "—"} />
            <Row label="SCA" value={session.sca_completed ? "Completed" : "Not required"} />
            <Row label="Risk score" value={<RiskChip score={session.risk_score} />} />
          </Section>
          {session.id !== currentSid && (
            <button onClick={revoke} disabled={revoking} className="w-full py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50">
              {revoking ? "Revoking…" : "Revoke Session"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-zinc-500 uppercase tracking-wide text-[10px] font-semibold mb-2">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-zinc-500 shrink-0">{label}</span>
      <span className="text-zinc-200 text-right">{value}</span>
    </div>
  );
}

export default function SessionsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSid, setCurrentSid] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Session | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/sessions").then(async r => {
      if (r.status === 401) { router.push("/login"); return; }
      const data = await r.json();
      setSessions(data.sessions ?? []);
      setCurrentSid(data.current ?? "");
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    fetch("/api/auth/me").then(async r => {
      if (r.status === 401) { router.push("/login"); return; }
      const data = await r.json();
      setUser(data.user);
    });
    load();
  }, [router]);

  const handleRevoke = (id: string) => setSessions(s => s.filter(x => x.id !== id));

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <DashNav user={user} currentPath={pathname} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-base font-bold text-white">Active Sessions</h1>
            <p className="text-zinc-500 text-xs mt-0.5">All active sessions across tenant clients · {sessions.length} sessions</p>
          </div>
          <button onClick={load} className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-xs cursor-pointer transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16"><div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /></div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-16 text-zinc-500 text-sm">No active sessions</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/50">
                    {["Session ID", "Client", "Started", "Last active", "Expires", "IP", "ACR", "Risk"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-zinc-500 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s.id} onClick={() => setSelected(s)} className={`border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/40 cursor-pointer transition-colors ${s.id === currentSid ? "bg-indigo-500/5" : ""}`}>
                      <td className="px-3 py-2.5 font-mono text-zinc-400 whitespace-nowrap">
                        {s.id.slice(0, 8)}…
                        {s.id === currentSid && <span className="ml-1.5 text-[9px] text-indigo-400 font-medium">you</span>}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-300 whitespace-nowrap">
                        <div>{s.client_email}</div>
                        {s.client_name && <div className="text-zinc-500 text-[10px]">{s.client_name}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-400 whitespace-nowrap">{timeAgo(s.created_at)}</td>
                      <td className="px-3 py-2.5 text-zinc-400 whitespace-nowrap">{timeAgo(s.last_activity_at)}</td>
                      <td className="px-3 py-2.5 text-zinc-400 whitespace-nowrap">{timeLeft(s.expires_at)}</td>
                      <td className="px-3 py-2.5 font-mono text-zinc-400">{s.ip_address || "—"}</td>
                      <td className="px-3 py-2.5"><AcrBadge acr={s.acr} /></td>
                      <td className="px-3 py-2.5"><RiskChip score={s.risk_score} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selected && <SessionPanel session={selected} onClose={() => setSelected(null)} onRevoke={handleRevoke} currentSid={currentSid} />}
    </div>
  );
}
