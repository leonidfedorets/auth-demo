"use client";
import { useState, useEffect } from "react";
import { Copy, Check, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function getCookieToken(): string | null {
  // Can't read httpOnly cookies client-side — fetch from /api/auth/me
  return null;
}

export default function JWTInspector() {
  const [rawToken, setRawToken] = useState("");
  const [parsed, setParsed] = useState<{ header: any; payload: any; valid: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch claims from server (token is httpOnly)
    fetch("/api/auth/me").then(async r => {
      setLoading(false);
      if (!r.ok) return;
      const { claims } = await r.json();
      if (claims) {
        setParsed({ header: { alg: "HS256", typ: "JWT", kid: "demo-v1" }, payload: claims, valid: true });
        setRawToken("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImRlbW8tdjEifQ.<payload>.<signature>");
      }
    });
  }, []);

  function copy(text: string) {
    navigator.clipboard.writeText(JSON.stringify(parsed?.payload, null, 2));
    setCopied(true);
    toast.success("Claims copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <div className="h-40 flex items-center justify-center text-gray-500">Loading token...</div>;
  if (!parsed) return <div className="h-40 flex items-center justify-center text-gray-500">No active session</div>;

  const claimsDoc: Record<string, string> = {
    sub: "User ID (subject)",
    email: "User email address",
    tid: "Tenant ID",
    sid: "Session ID — bind token to session",
    did: "Device ID — proof-of-possession binding",
    dfp: "Device fingerprint hash",
    amr: "Authentication Method References (RFC 8176)",
    acr: "Authentication Context Class Reference (RFC 6711)",
    risk: "Adaptive risk score 0–100",
    risk_lvl: "Risk level: low | medium | high | critical",
    sca: "SCA (PSD2) completed flag",
    sca_method: "SCA method used",
    ttype: "Token type: access | refresh | sca_challenge",
    fid: "Refresh token rotation family ID",
    iss: "Issuer",
    iat: "Issued at (Unix timestamp)",
    exp: "Expiry (Unix timestamp)",
  };

  return (
    <div className="space-y-4">
      <Card className="bg-gray-900 border-white/10">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-white">JWT Access Token Claims</CardTitle>
            <CardDescription className="text-gray-400">Decoded payload of your current access token. All fields are configurable.</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="border-white/10 text-gray-400 gap-2" onClick={() => copy(rawToken)}>
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            Copy Claims
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {Object.entries(parsed.payload).map(([key, val]) => {
              const isTime = ["iat", "exp", "nbf"].includes(key);
              const display = isTime ? `${val} (${new Date(Number(val) * 1000).toLocaleString()})` : Array.isArray(val) ? val.join(", ") : typeof val === "object" ? JSON.stringify(val) : String(val);
              return (
                <div key={key} className="flex items-start gap-3 text-sm py-2 border-b border-white/5 last:border-0">
                  <code className="w-24 shrink-0 text-blue-400 font-mono text-xs">{key}</code>
                  <code className="text-gray-300 font-mono text-xs break-all flex-1">{display}</code>
                  {claimsDoc[key] && <span className="text-xs text-gray-600 shrink-0 max-w-[180px] text-right">{claimsDoc[key]}</span>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-900 border-white/10">
        <CardHeader><CardTitle className="text-sm text-gray-300">Token Structure</CardTitle></CardHeader>
        <CardContent>
          <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap break-all">
            <span className="text-red-400">{"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImRlbW8tdjEifQ"}</span>
            <span className="text-gray-600">.</span>
            <span className="text-purple-400">{"<base64url(payload)>"}</span>
            <span className="text-gray-600">.</span>
            <span className="text-green-400">{"<HMAC-SHA256-signature>"}</span>
          </pre>
          <div className="mt-3 flex gap-4 text-xs text-gray-500">
            <span><span className="text-red-400">■</span> Header</span>
            <span><span className="text-purple-400">■</span> Payload (claims)</span>
            <span><span className="text-green-400">■</span> Signature</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
