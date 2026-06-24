"use client";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Key, ArrowLeft, Fingerprint, CheckCircle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function WebAuthnDemoPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function registerPasskey() {
    setLoading(true);
    setStatus(null);
    try {
      if (!window.PublicKeyCredential) { toast.error("WebAuthn not supported in this browser"); return; }
      const { startRegistration } = await import("@simplewebauthn/browser");
      const beginRes = await fetch("/api/webauthn/register/begin", { method: "POST" });
      if (beginRes.status === 401) { toast.error("Please log in first"); return; }
      const options = await beginRes.json();
      if (options.error) { toast.error(options.error); return; }

      const registration = await startRegistration({ optionsJSON: options });

      const finishRes = await fetch("/api/webauthn/register/finish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(registration) });
      const data = await finishRes.json();
      if (!finishRes.ok) { toast.error(data.error ?? "Registration failed"); return; }

      setStatus("registered");
      toast.success("Passkey registered! You can now sign in without a password.");
    } catch (err: any) {
      if (err.name === "NotAllowedError") toast.error("Passkey registration was cancelled");
      else toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function authenticatePasskey() {
    setLoading(true);
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const beginRes = await fetch("/api/webauthn/auth/begin", { method: "POST" });
      const options = await beginRes.json();
      const assertion = await startAuthentication({ optionsJSON: options });
      const finishRes = await fetch("/api/webauthn/auth/finish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(assertion) });
      const data = await finishRes.json();
      if (!finishRes.ok) { toast.error(data.error ?? "Auth failed"); return; }
      setStatus("authenticated");
      toast.success("Authenticated with passkey! ACR = gold.");
    } catch (err: any) {
      if (err.name === "NotAllowedError") toast.error("Passkey authentication was cancelled");
      else toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  const steps = [
    { num: 1, title: "Browser requests credential creation", code: "navigator.credentials.create({ publicKey: challenge })" },
    { num: 2, title: "User authenticates with device biometrics / PIN", code: "Face ID · Touch ID · Windows Hello · Security Key" },
    { num: 3, title: "Server verifies attestation object", code: "CBOR-encoded authenticator data + AAGUID" },
    { num: 4, title: "Credential stored with sign counter", code: "Replay detection on each use" },
    { num: 5, title: "JWT issued with ACR = gold", code: 'amr: ["hwk"], acr: "urn:mace:incommon:iap:gold"' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-white/10 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard"><Button variant="ghost" size="sm" className="gap-2 text-gray-400"><ArrowLeft className="w-4 h-4" />Dashboard</Button></Link>
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-purple-400" />
          <span className="font-semibold">WebAuthn / Passkeys</span>
        </div>
        <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">FIDO2 Level 2</Badge>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Passkey Registration & Authentication</h1>
          <p className="text-gray-400">Register a passkey using your device's built-in authenticator (Face ID, Touch ID, Windows Hello). Works on any FIDO2-compliant device.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className={`bg-gray-900 border-white/10 ${status === "registered" ? "border-green-500/40" : ""}`}>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Fingerprint className="w-6 h-6 text-purple-400" />
                {status === "registered" && <Badge className="bg-green-500/10 text-green-400 border-green-500/20">Registered</Badge>}
              </div>
              <CardTitle>Register Passkey</CardTitle>
              <CardDescription className="text-gray-400">Add a new passkey using your device authenticator</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400 mb-4">Your browser will prompt you to authenticate with Face ID, Touch ID, or a security key. The private key never leaves your device.</p>
              <Button onClick={registerPasskey} disabled={loading} className="w-full gap-2 bg-purple-600 hover:bg-purple-700">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
                Register Passkey
              </Button>
            </CardContent>
          </Card>

          <Card className={`bg-gray-900 border-white/10 ${status === "authenticated" ? "border-green-500/40" : ""}`}>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-6 h-6 text-green-400" />
                {status === "authenticated" && <Badge className="bg-green-500/10 text-green-400 border-green-500/20">Verified</Badge>}
              </div>
              <CardTitle>Sign In with Passkey</CardTitle>
              <CardDescription className="text-gray-400">Authenticate passwordlessly using a registered passkey</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400 mb-4">Sign-counter verification detects cloned authenticators. JWT receives ACR = gold and amr = ["hwk"].</p>
              <Button onClick={authenticatePasskey} disabled={loading} variant="outline" className="w-full gap-2 border-white/10 text-gray-300">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                Sign In with Passkey
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gray-900 border-white/10 mb-6">
          <CardHeader><CardTitle className="text-sm text-gray-300">How It Works (FIDO2 / WebAuthn L2)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {steps.map(s => (
              <div key={s.num} className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs font-bold shrink-0">{s.num}</div>
                <div>
                  <p className="text-sm text-gray-300">{s.title}</p>
                  <code className="text-xs text-gray-500 font-mono">{s.code}</code>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { label: "Platform Authenticators", examples: "Face ID · Touch ID · Windows Hello", icon: "📱" },
            { label: "Cross-Platform Keys", examples: "YubiKey · FIDO USB-C · NFC", icon: "🔑" },
            { label: "Backup & Sync", examples: "iCloud Keychain · Google Password Manager", icon: "☁️" },
          ].map(a => (
            <Card key={a.label} className="bg-gray-900 border-white/10">
              <CardContent className="pt-4 text-center">
                <div className="text-3xl mb-2">{a.icon}</div>
                <p className="text-sm font-medium text-white mb-1">{a.label}</p>
                <p className="text-xs text-gray-500">{a.examples}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
