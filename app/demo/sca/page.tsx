"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Shield, ArrowLeft, Loader2, CheckCircle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SCADemoPage() {
  const [qrDataURL, setQrDataURL] = useState("");
  const [secret, setSecret] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(async r => {
      if (!r.ok) return;
      const { user: u } = await r.json();
      setUser(u);
      if (u?.totp_verified) setEnrolled(true);
    });
  }, []);

  async function enrollTOTP() {
    setEnrollLoading(true);
    try {
      const res = await fetch("/api/sca/totp-enroll", { method: "POST" });
      if (res.status === 401) { toast.error("Please log in first"); return; }
      const data = await res.json();
      setQrDataURL(data.qrDataURL);
      setSecret(data.secret);
    } finally {
      setEnrollLoading(false);
    }
  }

  async function verifyTOTP() {
    setVerifyLoading(true);
    try {
      const res = await fetch("/api/sca/totp-enroll", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: totpCode }) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message ?? "Invalid code"); return; }
      toast.success("TOTP authenticator enrolled! MFA is now active on your account.");
      setEnrolled(true);
    } finally {
      setVerifyLoading(false);
    }
  }

  const psd2Triggers = [
    { trigger: "Risk score ≥ 40", example: "VPN + new device login", action: "Email OTP challenge" },
    { trigger: "Amount > €50", example: "High-value transaction", action: "TOTP / WebAuthn step-up" },
    { trigger: "New payee", example: "First payment to recipient", action: "TOTP challenge" },
    { trigger: "MFA enrolled", example: "Any login", action: "TOTP required" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-white/10 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard"><Button variant="ghost" size="sm" className="gap-2 text-gray-400"><ArrowLeft className="w-4 h-4" />Dashboard</Button></Link>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-400" />
          <span className="font-semibold">SCA / Step-Up Auth</span>
        </div>
        <Badge variant="outline" className="text-xs border-red-500/30 text-red-400">PSD2 Compliant</Badge>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Strong Customer Authentication</h1>
          <p className="text-gray-400">PSD2-compliant step-up authentication. Enroll TOTP below, then log out and back in to see the SCA challenge flow trigger automatically.</p>
        </div>

        <Tabs defaultValue="enroll">
          <TabsList className="bg-gray-900 border border-white/10 mb-6">
            <TabsTrigger value="enroll">TOTP Enrollment</TabsTrigger>
            <TabsTrigger value="flow">SCA Flow</TabsTrigger>
            <TabsTrigger value="triggers">Triggers</TabsTrigger>
          </TabsList>

          <TabsContent value="enroll">
            {enrolled ? (
              <Card className="bg-gray-900 border-green-500/20">
                <CardContent className="pt-6 text-center">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <h3 className="font-semibold text-lg mb-1">TOTP Active</h3>
                  <p className="text-gray-400 text-sm">Your authenticator app is enrolled. Future logins will require your 6-digit code.</p>
                  <Badge className="mt-3 bg-green-500/10 text-green-400 border-green-500/20">MFA Enabled</Badge>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="bg-gray-900 border-white/10">
                  <CardHeader>
                    <CardTitle>Step 1 — Generate Secret</CardTitle>
                    <CardDescription className="text-gray-400">Click to generate a TOTP secret and QR code</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!qrDataURL ? (
                      <Button onClick={enrollTOTP} disabled={enrollLoading} className="w-full">
                        {enrollLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Generate TOTP Secret
                      </Button>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex justify-center">
                          <img src={qrDataURL} alt="TOTP QR Code" className="w-48 h-48 rounded-lg" />
                        </div>
                        <div className="bg-gray-800 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">Manual entry secret</p>
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-green-400 font-mono break-all flex-1">{secret}</code>
                            <Button variant="ghost" size="sm" className="shrink-0" onClick={() => { navigator.clipboard.writeText(secret); toast.success("Secret copied"); }}>
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500">Scan with Google Authenticator, Authy, or 1Password</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-gray-900 border-white/10">
                  <CardHeader>
                    <CardTitle>Step 2 — Verify Code</CardTitle>
                    <CardDescription className="text-gray-400">Enter the 6-digit code from your authenticator</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-gray-300">TOTP Code</Label>
                      <Input value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" className="bg-gray-800 border-white/10 text-white text-center text-2xl tracking-widest font-mono" disabled={!qrDataURL} maxLength={6} />
                    </div>
                    <Button onClick={verifyTOTP} disabled={!qrDataURL || totpCode.length !== 6 || verifyLoading} className="w-full">
                      {verifyLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                      Verify & Enroll
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="flow">
            <Card className="bg-gray-900 border-white/10">
              <CardHeader><CardTitle>PSD2 SCA Challenge Flow</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { step: 1, label: "POST /api/auth/login", desc: "User submits credentials", color: "bg-blue-400" },
                    { step: 2, label: "Risk Engine Evaluation", desc: "Score calculated from IP, device, velocity, geo signals", color: "bg-yellow-400" },
                    { step: 3, label: "SCA Gate Check", desc: "score ≥ 40 OR MFA enrolled OR high-value transaction", color: "bg-orange-400" },
                    { step: 4, label: "Challenge Issued", desc: "Method selected (TOTP → WebAuthn → Email OTP)", color: "bg-red-400" },
                    { step: 5, label: "POST /api/sca/verify", desc: "User submits code — server validates and issues full tokens", color: "bg-green-400" },
                    { step: 6, label: "JWT with sca: true", desc: "amr includes method, acr = silver, sca_method claim set", color: "bg-purple-400" },
                  ].map(s => (
                    <div key={s.step} className="flex items-start gap-4">
                      <div className={`w-7 h-7 rounded-full ${s.color} flex items-center justify-center text-white text-sm font-bold shrink-0`}>{s.step}</div>
                      <div>
                        <code className="text-sm text-white">{s.label}</code>
                        <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="triggers">
            <div className="space-y-3">
              {psd2Triggers.map(t => (
                <Card key={t.trigger} className="bg-gray-900 border-white/10">
                  <CardContent className="pt-4 flex items-start gap-4">
                    <Badge variant="outline" className="border-orange-500/30 text-orange-400 text-xs shrink-0">{t.trigger}</Badge>
                    <div className="flex-1">
                      <p className="text-sm text-gray-300">{t.example}</p>
                      <p className="text-xs text-gray-500 mt-1">→ {t.action}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
