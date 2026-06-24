"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

export default function RiskPage() {
  const [riskData, setRiskData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const evaluate = async () => {
      const r = await fetch("/api/risk/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "profile_view" }),
      });
      if (r.ok) setRiskData(await r.json());
      setLoading(false);
    };
    evaluate();
  }, []);

  const levelColor = (level: string) => {
    if (level === "low") return "bg-green-500/10 text-green-400 border-green-500/30";
    if (level === "medium") return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";
    if (level === "high") return "bg-orange-500/10 text-orange-400 border-orange-500/30";
    return "bg-red-500/10 text-red-400 border-red-500/30";
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Risk Profile</h1>
          <p className="text-zinc-400 mt-1">Current session risk evaluation</p>
        </div>
        <Link href="/platform/risk-engine">
          <Button variant="outline" className="border-zinc-700 text-zinc-300 gap-2">
            <ExternalLink className="h-4 w-4" />
            Risk Engine
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="text-zinc-400">Evaluating risk...</div>
      ) : riskData ? (
        <div className="grid gap-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white text-base">Risk Score</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <div className="text-5xl font-bold text-white">{riskData.score}</div>
              <div>
                <Badge variant="outline" className={levelColor(riskData.level)}>{riskData.level}</Badge>
                <div className="text-zinc-400 text-sm mt-1">Decision: <span className="text-white">{riskData.decision}</span></div>
              </div>
            </CardContent>
          </Card>

          {riskData.signals?.length > 0 && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader><CardTitle className="text-white text-base">Active Signals</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {riskData.signals.map((s: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1 border-b border-zinc-800 last:border-0">
                    <span className="text-zinc-300 text-sm">{s.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-500 text-xs">{s.description}</span>
                      <span className="text-white text-sm font-mono">+{s.score}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="text-zinc-500">Failed to evaluate risk</div>
      )}
    </div>
  );
}
