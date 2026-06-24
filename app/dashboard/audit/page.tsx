"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const actionColors: Record<string, string> = {
  "auth.login": "text-green-400",
  "auth.login.failed": "text-red-400",
  "auth.logout": "text-gray-400",
  "auth.register": "text-blue-400",
  "auth.sca.challenge": "text-orange-400",
  "auth.sca.complete": "text-green-400",
  "auth.sca.failed": "text-red-400",
  "auth.mfa.enroll": "text-purple-400",
  "device.register": "text-cyan-400",
  "device.revoke": "text-red-400",
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => { load(); }, [page]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/audit?page=${page}&limit=20`);
    if (res.status === 401) { window.location.href = "/login"; return; }
    const data = await res.json();
    setLogs(data.logs ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard"><Button variant="ghost" size="sm" className="gap-2 text-gray-400"><ArrowLeft className="w-4 h-4" />Dashboard</Button></Link>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <span className="font-semibold">Audit Log</span>
            <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">Immutable</Badge>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={load} className="text-gray-400 gap-2"><RefreshCw className="w-4 h-4" />Refresh</Button>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">Audit Trail ({total} events)</h1>
          <p className="text-xs text-gray-500">PCI DSS Req 10 · GDPR Art 30 compliant</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : logs.length === 0 ? (
          <Card className="bg-gray-900 border-white/10 text-center py-12">
            <FileText className="w-8 h-8 mx-auto text-gray-600 mb-2" />
            <p className="text-gray-500">No audit events yet. Log in or perform actions to generate events.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {logs.map(log => (
              <Card key={log.id} className="bg-gray-900 border-white/10">
                <CardContent className="py-3 px-4 flex items-start gap-4">
                  {log.outcome === "success" ? <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className={`text-sm font-mono ${actionColors[log.action] ?? "text-gray-300"}`}>{log.action}</code>
                      {log.risk_score > 0 && <Badge variant="outline" className="text-xs border-yellow-500/20 text-yellow-400">risk:{log.risk_score}</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{log.ip_address} · {timeAgo(log.created_at)}</p>
                  </div>
                  <span className="text-xs text-gray-600 shrink-0">{new Date(log.created_at).toLocaleTimeString()}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {total > 20 && (
          <div className="flex justify-center gap-2 mt-6">
            <Button variant="outline" size="sm" className="border-white/10" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" className="border-white/10" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        )}
      </div>
    </div>
  );
}
