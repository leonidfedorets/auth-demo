"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Clock, ArrowLeft, Globe, Smartphone, ShieldCheck, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import RiskBadge from "@/components/demo/RiskBadge";

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/sessions");
    if (res.status === 401) { window.location.href = "/login"; return; }
    const data = await res.json();
    setSessions(data.sessions ?? []);
    setCurrent(data.current);
    setLoading(false);
  }

  async function revoke(sessionId: string) {
    setRevoking(sessionId);
    await fetch("/api/sessions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }) });
    toast.success("Session revoked");
    load();
    setRevoking(null);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-white/10 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard"><Button variant="ghost" size="sm" className="gap-2 text-gray-400"><ArrowLeft className="w-4 h-4" />Dashboard</Button></Link>
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-400" />
          <span className="font-semibold">Active Sessions</span>
        </div>
      </nav>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold mb-6">Sessions ({sessions.length})</h1>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : sessions.length === 0 ? (
          <Card className="bg-gray-900 border-white/10 text-center py-12">
            <Clock className="w-8 h-8 mx-auto text-gray-600 mb-2" />
            <p className="text-gray-500">No active sessions</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessions.map(s => (
              <Card key={s.id} className={`bg-gray-900 border-white/10 ${s.id === current ? "border-blue-500/30" : ""}`}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {s.id === current && <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">Current</Badge>}
                        {s.sca_completed && <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-xs"><ShieldCheck className="w-3 h-3 mr-1" />SCA</Badge>}
                        <RiskBadge score={s.risk_score} />
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2 text-xs text-gray-400">
                        <div className="flex items-center gap-1"><Globe className="w-3 h-3" />{s.ip_address || "Unknown IP"}</div>
                        <div className="flex items-center gap-1"><Smartphone className="w-3 h-3" /><span className="truncate">{s.user_agent?.split(" ")[0] || "Unknown"}</span></div>
                        <div><span className="text-gray-600">AMR: </span>{Array.isArray(s.amr) ? s.amr.join(", ") : JSON.stringify(s.amr)}</div>
                        <div><span className="text-gray-600">Started: </span>{timeAgo(s.created_at)}</div>
                      </div>
                    </div>
                    {s.id !== current && (
                      <Button variant="ghost" size="sm" className="text-gray-500 hover:text-red-400 shrink-0" onClick={() => revoke(s.id)} disabled={revoking === s.id}>
                        {revoking === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
