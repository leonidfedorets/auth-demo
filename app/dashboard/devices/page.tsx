"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Monitor, Smartphone, Globe, X, Shield, ShieldCheck, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ── Mock data ──────────────────────────────────────────────────────────────────
type DeviceStatus = "bound" | "attested" | "revoked";
type Platform = "ios" | "android" | "macos" | "windows" | "web";

interface MockDevice {
  id: string;
  user: string;
  platform: Platform;
  model: string;
  browser: string;
  ua: string;
  fingerprint: string;
  status: DeviceStatus;
  lastSeen: string;
  lastSeenIp: string;
  lastSeenCountry: string;
  risk: number;
  attestationType: string;
  attestationVerified: boolean;
  bindingDate: string;
  sessions: string[];
}

const MOCK_DEVICES: MockDevice[] = [
  {
    id: "dev-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    user: "alice@acmecorp.io",
    platform: "ios",
    model: "iPhone 14 Pro",
    browser: "Safari 17",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    fingerprint: "fp_7a3c9e2b1d4f8a06",
    status: "attested",
    lastSeen: new Date(Date.now() - 5 * 60000).toISOString(),
    lastSeenIp: "82.77.42.11",
    lastSeenCountry: "DE",
    risk: 5,
    attestationType: "apple",
    attestationVerified: true,
    bindingDate: new Date(Date.now() - 30 * 86400000).toISOString(),
    sessions: ["ses-aa1", "ses-aa2"],
  },
  {
    id: "dev-b2c3d4e5-f6a7-8901-bcde-f12345678901",
    user: "alice@acmecorp.io",
    platform: "macos",
    model: "MacBook Pro 14",
    browser: "Chrome 122",
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0",
    fingerprint: "fp_3b8d1f5e7c2a4069",
    status: "bound",
    lastSeen: new Date(Date.now() - 2 * 3600000).toISOString(),
    lastSeenIp: "82.77.42.11",
    lastSeenCountry: "DE",
    risk: 12,
    attestationType: "none",
    attestationVerified: false,
    bindingDate: new Date(Date.now() - 15 * 86400000).toISOString(),
    sessions: ["ses-ab1"],
  },
  {
    id: "dev-c3d4e5f6-a7b8-9012-cdef-012345678902",
    user: "bob@acmecorp.io",
    platform: "android",
    model: "Pixel 7",
    browser: "Chrome Mobile 121",
    ua: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/121.0.0.0 Mobile",
    fingerprint: "fp_9c6e2a8d4b1f7053",
    status: "attested",
    lastSeen: new Date(Date.now() - 1 * 3600000).toISOString(),
    lastSeenIp: "31.14.128.5",
    lastSeenCountry: "FR",
    risk: 8,
    attestationType: "android",
    attestationVerified: true,
    bindingDate: new Date(Date.now() - 60 * 86400000).toISOString(),
    sessions: ["ses-bc1", "ses-bc2"],
  },
  {
    id: "dev-d4e5f6a7-b8c9-0123-def0-123456789003",
    user: "bob@acmecorp.io",
    platform: "windows",
    model: "Surface Pro 9",
    browser: "Edge 121",
    ua: "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 Edg/121.0.0.0",
    fingerprint: "fp_2d7a5c9e3b8f1046",
    status: "bound",
    lastSeen: new Date(Date.now() - 6 * 3600000).toISOString(),
    lastSeenIp: "31.14.128.5",
    lastSeenCountry: "FR",
    risk: 22,
    attestationType: "windows",
    attestationVerified: true,
    bindingDate: new Date(Date.now() - 10 * 86400000).toISOString(),
    sessions: ["ses-bd1"],
  },
  {
    id: "dev-e5f6a7b8-c9d0-1234-ef01-234567890004",
    user: "carol@acmecorp.io",
    platform: "ios",
    model: "iPhone 15",
    browser: "Safari 17",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15",
    fingerprint: "fp_8e4b1c6f9d3a2057",
    status: "attested",
    lastSeen: new Date(Date.now() - 20 * 60000).toISOString(),
    lastSeenIp: "195.43.97.222",
    lastSeenCountry: "GB",
    risk: 3,
    attestationType: "apple",
    attestationVerified: true,
    bindingDate: new Date(Date.now() - 5 * 86400000).toISOString(),
    sessions: ["ses-ce1"],
  },
  {
    id: "dev-f6a7b8c9-d0e1-2345-f012-345678900005",
    user: "carol@acmecorp.io",
    platform: "web",
    model: "Web Browser",
    browser: "Firefox 123",
    ua: "Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0",
    fingerprint: "fp_5f9c3a7e2b4d8061",
    status: "revoked",
    lastSeen: new Date(Date.now() - 48 * 3600000).toISOString(),
    lastSeenIp: "195.43.97.222",
    lastSeenCountry: "GB",
    risk: 68,
    attestationType: "none",
    attestationVerified: false,
    bindingDate: new Date(Date.now() - 90 * 86400000).toISOString(),
    sessions: [],
  },
  {
    id: "dev-07a8b9c0-d1e2-3456-0123-456789000006",
    user: "alice@acmecorp.io",
    platform: "android",
    model: "Samsung Galaxy S23",
    browser: "Chrome Mobile 122",
    ua: "Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 Chrome/122.0.0.0",
    fingerprint: "fp_1a6d8c4f3e9b2075",
    status: "bound",
    lastSeen: new Date(Date.now() - 12 * 3600000).toISOString(),
    lastSeenIp: "82.77.44.99",
    lastSeenCountry: "DE",
    risk: 15,
    attestationType: "android",
    attestationVerified: false,
    bindingDate: new Date(Date.now() - 3 * 86400000).toISOString(),
    sessions: ["ses-ag1"],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function PlatformIcon({ platform }: { platform: Platform }) {
  if (platform === "ios" || platform === "android") return <Smartphone className="w-3.5 h-3.5" />;
  if (platform === "windows" || platform === "macos") return <Monitor className="w-3.5 h-3.5" />;
  return <Globe className="w-3.5 h-3.5" />;
}

function RiskChip({ score }: { score: number }) {
  if (score < 20) return <span className="text-green-400 text-xs font-mono">{score}</span>;
  if (score < 50) return <span className="text-yellow-400 text-xs font-mono">{score}</span>;
  if (score < 75) return <span className="text-orange-400 text-xs font-mono">{score}</span>;
  return <span className="text-red-400 text-xs font-mono">{score}</span>;
}

function StatusBadge({ status }: { status: DeviceStatus }) {
  const map: Record<DeviceStatus, string> = {
    bound: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    attested: "bg-green-500/10 text-green-400 border-green-500/30",
    revoked: "bg-red-500/10 text-red-400 border-red-500/30",
  };
  return <Badge variant="outline" className={`text-[10px] capitalize ${map[status]}`}>{status}</Badge>;
}

// ── Nav ───────────────────────────────────────────────────────────────────────
function DashNav({ user, currentPath }: { user: any; currentPath: string }) {
  const [showMenu, setShowMenu] = useState(false);
  const NAV_ITEMS = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/transactions", label: "Transactions" },
    { href: "/dashboard/users", label: "Users" },
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
          <div className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center text-white font-bold text-xs">
            {user?.email?.[0]?.toUpperCase() || "?"}
          </div>
          <span className="hidden sm:block max-w-[120px] truncate">{user?.email}</span>
        </button>
        {showMenu && (
          <div className="absolute right-0 top-9 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl w-48 z-50 py-1">
            <div className="px-3 py-2 border-b border-zinc-800"><p className="text-white text-xs font-semibold truncate">{user?.email}</p><p className="text-zinc-500 text-[10px] font-mono truncate">{user?.id}</p></div>
            <Link href="/dashboard" onClick={() => setShowMenu(false)} className="block px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs">Dashboard</Link>
            <Link href="/dashboard/settings" onClick={() => setShowMenu(false)} className="block px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs">Settings</Link>
            <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }} className="w-full text-left px-3 py-2 text-red-400 hover:text-red-300 hover:bg-zinc-800 text-xs border-t border-zinc-800 cursor-pointer">Sign out</button>
          </div>
        )}
      </div>
    </nav>
  );
}

// ── Side panel ────────────────────────────────────────────────────────────────
function DevicePanel({ device, onClose }: { device: MockDevice; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-zinc-900 border-l border-zinc-800 h-full overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
          <div className="flex items-center gap-2">
            <PlatformIcon platform={device.platform} />
            <span className="text-white font-semibold text-sm">{device.model}</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-5 text-xs">
          <Section title="Identity">
            <Row label="Device ID" value={<span className="font-mono text-zinc-300 break-all">{device.id}</span>} />
            <Row label="Fingerprint" value={<span className="font-mono text-zinc-300">{device.fingerprint}</span>} />
            <Row label="User" value={device.user} />
            <Row label="Platform" value={<span className="capitalize">{device.platform}</span>} />
          </Section>

          <Section title="User Agent">
            <p className="text-zinc-400 font-mono leading-relaxed break-all">{device.ua}</p>
          </Section>

          <Section title="Binding">
            <Row label="Status" value={<StatusBadge status={device.status} />} />
            <Row label="Bound on" value={new Date(device.bindingDate).toLocaleString()} />
            <Row label="Attestation" value={
              <span className="flex items-center gap-1">
                {device.attestationVerified
                  ? <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
                  : <Shield className="w-3.5 h-3.5 text-zinc-500" />}
                {device.attestationType}
                {device.attestationVerified ? " ✓" : " (unverified)"}
              </span>
            } />
          </Section>

          <Section title="Last Seen">
            <Row label="Time" value={timeAgo(device.lastSeen)} />
            <Row label="IP" value={<span className="font-mono">{device.lastSeenIp}</span>} />
            <Row label="Country" value={device.lastSeenCountry} />
          </Section>

          <Section title="Risk">
            <Row label="Score" value={<RiskChip score={device.risk} />} />
          </Section>

          <Section title="Sessions using this device">
            {device.sessions.length === 0
              ? <p className="text-zinc-500">No active sessions</p>
              : device.sessions.map(s => (
                <div key={s} className="flex items-center gap-2 py-1.5 border-b border-zinc-800 last:border-0">
                  <Wifi className="w-3 h-3 text-indigo-400" />
                  <span className="font-mono text-zinc-300">{s}</span>
                </div>
              ))
            }
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

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DevicesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [selected, setSelected] = useState<MockDevice | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(async r => {
      if (r.status === 401) { router.push("/login"); return; }
      const data = await r.json();
      setUser(data.user);
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <DashNav user={user} currentPath={pathname} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-5">
          <h1 className="text-base font-bold text-white">Devices</h1>
          <p className="text-zinc-500 text-xs mt-0.5">All bound and attested devices across tenant users</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/50">
                  {["Device ID", "User", "Platform", "Browser / UA", "Fingerprint", "Status", "Last seen", "Risk"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-zinc-500 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_DEVICES.map(d => (
                  <tr
                    key={d.id}
                    onClick={() => setSelected(d)}
                    className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/40 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2.5 font-mono text-zinc-400 whitespace-nowrap">{d.id.slice(0, 16)}…</td>
                    <td className="px-3 py-2.5 text-zinc-300 whitespace-nowrap">{d.user}</td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1.5 text-zinc-400">
                        <PlatformIcon platform={d.platform} />
                        <span className="capitalize hidden sm:block">{d.platform}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-zinc-400 max-w-[150px] truncate">{d.model} · {d.browser}</td>
                    <td className="px-3 py-2.5 font-mono text-zinc-500">{d.fingerprint}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={d.status} /></td>
                    <td className="px-3 py-2.5 text-zinc-400 whitespace-nowrap">{timeAgo(d.lastSeen)}</td>
                    <td className="px-3 py-2.5"><RiskChip score={d.risk} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selected && <DevicePanel device={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
