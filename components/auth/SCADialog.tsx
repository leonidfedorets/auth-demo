"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Shield, Loader2, Mail, Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface Props {
  method: string;
  onComplete: () => void;
  onCancel: () => void;
}

export default function SCADialog({ method, onComplete, onCancel }: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/sca/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, method }) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message ?? "Verification failed"); return; }
      onComplete();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  const icon = method === "totp" ? <Smartphone className="w-5 h-5 text-blue-400" /> : <Mail className="w-5 h-5 text-blue-400" />;
  const label = method === "totp" ? "Authenticator Code" : "Email OTP";
  const hint = method === "totp" ? "Enter the 6-digit code from your authenticator app" : "Enter the 6-digit code sent to your email (check server logs in demo)";

  return (
    <Dialog open onOpenChange={open => { if (!open) onCancel(); }}>
      <DialogContent className="bg-gray-900 border-white/10 text-white max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-full bg-blue-500/10">{icon}</div>
            <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-400">PSD2 Step-Up</Badge>
          </div>
          <DialogTitle>Verify Your Identity</DialogTitle>
          <DialogDescription className="text-gray-400">{hint}</DialogDescription>
        </DialogHeader>
        <form onSubmit={verify} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label className="text-gray-300">{label}</Label>
            <Input value={code} onChange={e => setCode(e.target.value)} placeholder="123456" maxLength={6} className="bg-gray-800 border-white/10 text-white text-center text-2xl tracking-widest font-mono" autoFocus />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1 border-white/10 text-gray-400" onClick={onCancel}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading || code.length < 6}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
            </Button>
          </div>
        </form>
        <p className="text-xs text-gray-600 text-center">Risk engine triggered this step-up authentication</p>
      </DialogContent>
    </Dialog>
  );
}
