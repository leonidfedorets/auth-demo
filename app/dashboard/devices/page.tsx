"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Monitor, Smartphone, Globe, X, Shield, ShieldCheck, Wifi, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Device {
  id: string;
  client_email: string;
  client_name: string;
  client_id: string;
  platform: string;
  user_agent: string;
  name: string;
  fingerprint: string;
  status: string;
  attestation_type: string;
  attestation_verified: boolean;
  trusted: boolean;
  last_seen_at: string | null;
  last_seen_ip: string | null;
  created_at: string;
}

function timeAgo(iso: string | null) {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function PlatformIcon({ platform }: { platform: string }) {
  const p = (platform ?? "").toLowerCase();
  if (p === "ios" || p === "android") return <Smartphone className="w-3.5 h-3.5" />;
  if (p === "windows" || p === "macos") return <Monitor className="w-3.5 h-3.5" />;
  return <Globe className="w-3.5 h-3.5" />;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    verified: "bg-green-500/10 text-green-400 border-green-500/30",
    bound: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    attested: "bg-green-500/10 text-green-400 border-green-500/30",
    revoked: "bg-red-500/10 text-red-400 border-red-500/30",
  };
  const cls = map[status] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-700";
  return <Badge variant="outline" className={`text-[10px] capitalize ${cls}`}>{status}</Badge>;
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

function DevicePanel({ device, onClose }: { device: Device; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-zinc-900 border-l border-zinc-800 h-full overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
          <div className="flex items-center gap-2">
            <PlatformIcon platform={device.platform} />
            <span className="text-white font-semibold text-sm">{device.name || device.platform}</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-5 text-xs">
          <Section title="Identity">
            <Row label="Device ID" value={<span className="font-mono text-zinc-300 break-all text-[10px]">{device.id}</span>} />
            <Row label="Fingerprint" value={<span className="font-mono text-zinc-300">{device.fingerprint || "—"}</span>} />
            <Row label="Client" value={device.client_email} />
            <Row label="Client ID" value={<span className="font-mono text-[10px] text-zinc-400">{device.client_id}</span>} />
            <Row label="Platform" value={<span className="capitalize">{device.platform}</span>} />
          </Section>
          <Section title="User Agent">
            <p className="text-zinc-400 font-mono leading-relaxed break-all">{device.user_agent || "—"}</p>
          </Section>
          <Section title="Status">
            <Row label="Status" value={<StatusBadge status={device.status} />} />
            <Row label="Attestation" value={
              <span className="flex items-center gap-1">
                {device.attestation_verified
                  ? <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
                  : <Shield className="w-3.5 h-3.5 text-zinc-500" />}
                {device.attestation_type || "none"}
                {device.attestation_verified ? " ✓" : " (unverified)"}
              </span>
            } />
            <Row label="Trusted" value={device.trusted ? "Yes" : "No"} />
          </Section>
          <Section title="Last Seen">
            <Row label="Time" value={timeAgo(device.last_seen_at)} />
            <Row label="IP" value={<span className="font-mono">{device.last_seen_ip || "—"}</span>} />
          </Section>
          <Section title="Registered">
            <Row label="Date" value={new Date(device.created_at).toLocaleString()} />
          </Section>
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

export default function DevicesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Device | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/devices").then(async r => {
      if (r.status === 401) { router.push("/login"); return; }
      const data = await r.json();
      setDevices(data.devices ?? []);
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

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <DashNav user={user} currentPath={pathname} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-base font-bold text-white">Devices</h1>
            <p className="text-zinc-500 text-xs mt-0.5">All bound and attested devices across tenant clients · {devices.length} total</p>
          </div>
          <button onClick={load} className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-xs cursor-pointer transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16"><div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /></div>
          ) : devices.length === 0 ? (
            <div className="text-center py-16 text-zinc-500 text-sm">No devices registered yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/50">
                    {["Device ID", "Client", "Platform", "Name / UA", "Status", "Attestation", "Last seen"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-zinc-500 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {devices.map(d => (
                    <tr key={d.id} onClick={() => setSelected(d)} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/40 cursor-pointer transition-colors">
                      <td className="px-3 py-2.5 font-mono text-zinc-400 whitespace-nowrap">{d.id.slice(0, 8)}…</td>
                      <td className="px-3 py-2.5 text-zinc-300 whitespace-nowrap">
                        <div>{d.client_email}</div>
                        {d.client_name && <div className="text-zinc-500 text-[10px]">{d.client_name}</div>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-1.5 text-zinc-400">
                          <PlatformIcon platform={d.platform} />
                          <span className="capitalize hidden sm:block">{d.platform}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-zinc-400 max-w-[150px] truncate">{d.name || d.user_agent}</td>
                      <td className="px-3 py-2.5"><StatusBadge status={d.status} /></td>
                      <td className="px-3 py-2.5">
                        {d.attestation_verified
                          ? <span className="flex items-center gap-1 text-green-400"><ShieldCheck className="w-3.5 h-3.5" />{d.attestation_type}</span>
                          : <span className="text-zinc-500">{d.attestation_type || "none"}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-400 whitespace-nowrap">{timeAgo(d.last_seen_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selected && <DevicePanel device={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
