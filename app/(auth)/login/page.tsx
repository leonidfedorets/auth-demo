"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Shield, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SCADialog from "@/components/auth/SCADialog";
import RiskBadge from "@/components/demo/RiskBadge";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scaState, setScaState] = useState<{ required: boolean; method: string; sessionId: string } | null>(null);
  const [riskResult, setRiskResult] = useState<any>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const fp = await getFingerprint();
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fingerprint: fp }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message ?? "Login failed");
        return;
      }

      if (data.risk) setRiskResult(data.risk);

      if (data.scaRequired) {
        setScaState({ required: true, method: data.method, sessionId: data.sessionId });
        toast.info(`Step-up auth required — ${data.method === "totp" ? "Enter your authenticator code" : "Check your email for a code"}`);
        return;
      }

      toast.success("Signed in successfully");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSCAComplete() {
    setScaState(null);
    toast.success("MFA verified — welcome back!");
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-blue-500/10 border border-blue-500/20">
              <Shield className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-gray-400 mt-1">Sign in to Auth Service Demo</p>
        </div>

        <Card className="bg-gray-900 border-white/10">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-lg">Sign In</CardTitle>
            <CardDescription className="text-gray-400">
              Risk engine runs on every login. Try Tor or VPN to see it trigger SCA.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Email</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="you@example.com" required className="bg-gray-800 border-white/10 text-white placeholder:text-gray-500" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Password</Label>
                <div className="relative">
                  <Input value={password} onChange={e => setPassword(e.target.value)} type={showPw ? "text" : "password"} placeholder="••••••••" required className="bg-gray-800 border-white/10 text-white placeholder:text-gray-500 pr-10" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {riskResult && (
                <div className="rounded-lg border border-white/10 bg-gray-800/50 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Risk Assessment</span>
                    <RiskBadge level={riskResult.level} score={riskResult.score} />
                  </div>
                  {riskResult.signals?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {riskResult.signals.map((s: any) => (
                        <div key={s.name} className="text-xs text-gray-500 flex justify-between">
                          <span>{s.description}</span>
                          <span className="text-yellow-400">+{s.score}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Authenticating...</> : "Sign In"}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm text-gray-500">
              No account? <Link href="/register" className="text-blue-400 hover:underline">Create one</Link>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10">
              <p className="text-xs text-gray-500 text-center mb-2">Demo accounts</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 text-xs border-white/10 text-gray-400" onClick={() => { setEmail("demo@example.com"); setPassword("Demo1234!"); }}>
                  demo@example.com
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 flex justify-center gap-4 text-xs text-gray-600">
          <Link href="/" className="hover:text-gray-400">← Home</Link>
          <Link href="/demo/risk" className="hover:text-gray-400">Risk Demo</Link>
          <Link href="/demo/webauthn" className="hover:text-gray-400">Passkeys</Link>
        </div>
      </div>

      {scaState && (
        <SCADialog method={scaState.method} onComplete={handleSCAComplete} onCancel={() => setScaState(null)} />
      )}
    </div>
  );
}

async function getFingerprint(): Promise<string> {
  const parts = [navigator.userAgent, navigator.language, screen.width, screen.height, new Date().getTimezoneOffset()];
  const str = parts.join("|");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
