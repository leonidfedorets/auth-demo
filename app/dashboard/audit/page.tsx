"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DashNav } from "@/components/dash-nav";

interface AuditLog {
  id: string;
  action: string;
  outcome: string | null;
  ip_address: string | null;
  user_agent: string | null;
  risk_score: number | null;
  details: string | Record<string, unknown> | null;
  created_at: string;
  client_email: string | null;
  client_name: string | null;
  client_id: string | null;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function actionBadgeClass(action: string) {
  if (action.includes("login") && !action.includes("fail")) return "bg-green-500/10 text-green-400 border-green-500/30";
  if (action.includes("fail") || action.includes("error")) return "bg-red-500/10 text-red-400 border-red-500/30";
  if (action.includes("revok") || action.includes("delet")) return "bg-red-500/10 text-red-400 border-red-500/30";
  if (action.includes("register")) return "bg-blue-500/10 text-blue-400 border-blue-500/30";
  if (action.includes("device")) return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
  if (action.includes("sca")) return "bg-purple-500/10 text-purple-400 border-purple-500/30";
  if (action.includes("logout")) return "bg-zinc-500/10 text-zinc-400 border-zinc-700";
  return "bg-indigo-500/10 text-indigo-400 border-indigo-500/30";
}

function detailsText(d: AuditLog["details"]): string {
  if (!d) return "—";
  if (typeof d === "string") {
    try { return JSON.stringify(JSON.parse(d), null, 0).slice(0, 120); } catch { return d.slice(0, 120); }
  }
  return JSON.stringify(d).slice(0, 120);
}


export default function AuditPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/audit?limit=100").then(async r => {
      if (r.status === 401) { router.push("/login"); return; }
      const data = await r.json();
      setLogs(data.logs ?? []);
      setTodayCount(data.todayCount ?? 0);
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

  const allActions = Array.from(new Set(logs.map(l => l.action)));
  const filtered = filter === "all" ? logs : logs.filter(l => l.action === filter);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <DashNav user={user} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-base font-bold text-white">Audit Log</h1>
            <p className="text-zinc-500 text-xs mt-0.5">
              Tenant activity · {logs.length} events · {todayCount} today · PCI DSS Req 10
            </p>
          </div>
          <button onClick={load} className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-xs cursor-pointer transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          <button onClick={() => setFilter("all")} className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors cursor-pointer ${filter === "all" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}>All</button>
          {allActions.map(a => (
            <button key={a} onClick={() => setFilter(a)} className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors cursor-pointer ${filter === a ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}>{a.replace(/\./g, " ")}</button>
          ))}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16"><div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-zinc-500 text-sm">No audit events yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/50">
                    {["Time", "Action", "Client", "IP", "Details", "Outcome"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-zinc-500 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(evt => {
                    const isOpen = expanded === evt.id;
                    const rawDetails = (() => {
                      if (!evt.details) return null;
                      if (typeof evt.details === "string") { try { return JSON.parse(evt.details); } catch { return evt.details; } }
                      return evt.details;
                    })();
                    return (
                      <>
                        <tr
                          key={evt.id}
                          onClick={() => setExpanded(isOpen ? null : evt.id)}
                          className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors cursor-pointer"
                        >
                          <td className="px-3 py-2.5 text-zinc-500 whitespace-nowrap font-mono">{timeAgo(evt.created_at)}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <Badge variant="outline" className={`text-[10px] ${actionBadgeClass(evt.action)}`}>{evt.action.replace(/\./g, " ")}</Badge>
                          </td>
                          <td className="px-3 py-2.5 text-zinc-300 whitespace-nowrap">
                            {evt.client_email ?? <span className="text-zinc-600">system</span>}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-zinc-400">{evt.ip_address || "—"}</td>
                          <td className="px-3 py-2.5 text-zinc-400 max-w-[200px] truncate">{detailsText(evt.details)}</td>
                          <td className="px-3 py-2.5">
                            {evt.outcome === "failure" || evt.outcome === "failed"
                              ? <XCircle className="w-3.5 h-3.5 text-red-400" />
                              : <CheckCircle className="w-3.5 h-3.5 text-green-400" />}
                          </td>
                          <td className="px-3 py-2.5 text-zinc-600">
                            {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr key={`${evt.id}-detail`} className="bg-zinc-900/60 border-b border-zinc-800/50">
                            <td colSpan={7} className="px-4 py-3">
                              <div className="grid grid-cols-2 gap-3 text-xs mb-2">
                                <div><span className="text-zinc-500">Event ID: </span><span className="font-mono text-zinc-400">{evt.id}</span></div>
                                <div><span className="text-zinc-500">Time: </span><span className="text-zinc-400">{new Date(evt.created_at).toLocaleString()}</span></div>
                                {evt.risk_score != null && <div><span className="text-zinc-500">Risk score: </span><span className="font-mono text-yellow-400">{evt.risk_score}</span></div>}
                                {evt.user_agent && <div className="col-span-2"><span className="text-zinc-500">UA: </span><span className="text-zinc-400 break-all">{evt.user_agent}</span></div>}
                                {evt.client_id && <div><span className="text-zinc-500">Client ID: </span><span className="font-mono text-indigo-300 text-[10px]">{evt.client_id}</span></div>}
                              </div>
                              {rawDetails && (
                                <div>
                                  <p className="text-zinc-500 text-[10px] uppercase tracking-wide mb-1">Full payload</p>
                                  <pre className="bg-zinc-950 rounded-lg p-2.5 text-[10px] font-mono text-zinc-400 overflow-auto max-h-48 border border-zinc-800">
                                    {JSON.stringify(rawDetails, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
