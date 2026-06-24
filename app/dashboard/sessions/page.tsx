"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { X, Globe, Monitor, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ── Mock data ──────────────────────────────────────────────────────────────────
type ACR = "gold" | "silver" | "bronze";

interface MockSession {
  id: string;
  user: string;
  started: string;
  lastActive: string;
  expires: string;
  ip: string;
  country: string;
  device: string;
  platform: string;
  acr: ACR;
  risk: number;
  amr: string[];
  authMethod: string;
  jwtSnapshot: Record<string, unknown>;
}

const now = Date.now();

const MOCK_SESSIONS: MockSession[] = [
  {
    id: "ses-aa1-f7e3b2d0-c4a8-4e1d-9f5c-2b7a8e3d1f09",
    user: "alice@acmecorp.io",
    started: new Date(now - 12 * 60000).toISOString(),
    lastActive: new Date(now - 2 * 60000).toISOString(),
    expires: new Date(now + 8 * 3600000).toISOString(),
    ip: "82.77.42.11",
    country: "DE",
    device: "iPhone 14 Pro",
    platform: "ios",
    acr: "gold",
    risk: 5,
    amr: ["hwk", "face"],
    authMethod: "WebAuthn / Face ID",
    jwtSnapshot: { sub: "c7ed9c17-aaaa-1111-bbbb-aabbccddeeff", email: "alice@acmecorp.io", acr: "gold", amr: ["hwk", "face"], sca: true, risk: 5, iat: Math.floor(now / 1000) - 720, exp: Math.floor(now / 1000) + 28800 },
  },
  {
    id: "ses-ab1-3c9e1a7f-d6b2-4f08-8c3a-1d5e9b7f2a04",
    user: "alice@acmecorp.io",
    started: new Date(now - 3 * 3600000).toISOString(),
    lastActive: new Date(now - 30 * 60000).toISOString(),
    expires: new Date(now + 5 * 3600000).toISOString(),
    ip: "82.77.42.11",
    country: "DE",
    device: "MacBook Pro 14",
    platform: "macos",
    acr: "silver",
    risk: 12,
    amr: ["pwd", "otp"],
    authMethod: "Password + TOTP",
    jwtSnapshot: { sub: "c7ed9c17-aaaa-1111-bbbb-aabbccddeeff", email: "alice@acmecorp.io", acr: "silver", amr: ["pwd", "otp"], sca: false, risk: 12, iat: Math.floor(now / 1000) - 10800, exp: Math.floor(now / 1000) + 18000 },
  },
  {
    id: "ses-bc1-9d4f2e8a-b7c3-4120-ae6d-3f8c1b9e5d07",
    user: "bob@acmecorp.io",
    started: new Date(now - 45 * 60000).toISOString(),
    lastActive: new Date(now - 5 * 60000).toISOString(),
    expires: new Date(now + 7 * 3600000).toISOString(),
    ip: "31.14.128.5",
    country: "FR",
    device: "Pixel 7",
    platform: "android",
    acr: "gold",
    risk: 8,
    amr: ["hwk"],
    authMethod: "WebAuthn / Fingerprint",
    jwtSnapshot: { sub: "b8fa1c33-bbbb-2222-cccc-bbccddeeff00", email: "bob@acmecorp.io", acr: "gold", amr: ["hwk"], sca: true, risk: 8, iat: Math.floor(now / 1000) - 2700, exp: Math.floor(now / 1000) + 25200 },
  },
  {
    id: "ses-bd1-e5a3c7f1-2d9b-4e60-8a4c-7b2f1e3d9c05",
    user: "bob@acmecorp.io",
    started: new Date(now - 6 * 3600000).toISOString(),
    lastActive: new Date(now - 2 * 3600000).toISOString(),
    expires: new Date(now + 2 * 3600000).toISOString(),
    ip: "31.14.128.5",
    country: "FR",
    device: "Surface Pro 9",
    platform: "windows",
    acr: "silver",
    risk: 22,
    amr: ["pwd", "hwk"],
    authMethod: "Password + Windows Hello",
    jwtSnapshot: { sub: "b8fa1c33-bbbb-2222-cccc-bbccddeeff00", email: "bob@acmecorp.io", acr: "silver", amr: ["pwd", "hwk"], sca: false, risk: 22, iat: Math.floor(now / 1000) - 21600, exp: Math.floor(now / 1000) + 7200 },
  },
  {
    id: "ses-ce1-1f7d5b9e-3a4c-4f82-bc1e-9d6a3f7b2e08",
    user: "carol@acmecorp.io",
    started: new Date(now - 20 * 60000).toISOString(),
    lastActive: new Date(now - 1 * 60000).toISOString(),
    expires: new Date(now + 9 * 3600000).toISOString(),
    ip: "195.43.97.222",
    country: "GB",
    device: "iPhone 15",
    platform: "ios",
    acr: "gold",
    risk: 3,
    amr: ["hwk", "face"],
    authMethod: "WebAuthn / Face ID",
    jwtSnapshot: { sub: "d9gb2e44-cccc-3333-dddd-ccddeeff0011", email: "carol@acmecorp.io", acr: "gold", amr: ["hwk", "face"], sca: true, risk: 3, iat: Math.floor(now / 1000) - 1200, exp: Math.floor(now / 1000) + 32400 },
  },
  {
    id: "ses-ag1-4b8e1c6f-7d9a-4230-bf5c-2e8a4d6b1f03",
    user: "alice@acmecorp.io",
    started: new Date(now - 2 * 3600000).toISOString(),
    lastActive: new Date(now - 15 * 60000).toISOString(),
    expires: new Date(now + 6 * 3600000).toISOString(),
    ip: "82.77.44.99",
    country: "DE",
    device: "Galaxy S23",
    platform: "android",
    acr: "bronze",
    risk: 41,
    amr: ["pwd"],
    authMethod: "Password only",
    jwtSnapshot: { sub: "c7ed9c17-aaaa-1111-bbbb-aabbccddeeff", email: "alice@acmecorp.io", acr: "bronze", amr: ["pwd"], sca: false, risk: 41, iat: Math.floor(now / 1000) - 7200, exp: Math.floor(now / 1000) + 21600 },
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

function RiskChip({ score }: { score: number }) {
  if (score < 20) return <span className="text-green-400 text-xs font-mono">{score}</span>;
  if (score < 50) return <span className="text-yellow-400 text-xs font-mono">{score}</span>;
  return <span className="text-red-400 text-xs font-mono">{score}</span>;
}

function AcrBadge({ acr }: { acr: ACR }) {
  const map: Record<ACR, string> = {
    gold: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    silver: "bg-zinc-400/10 text-zinc-300 border-zinc-500/30",
    bronze: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  };
  return <Badge variant="outline" className={`text-[10px] capitalize ${map[acr]}`}>{acr}</Badge>;
}

function DeviceIcon({ platform }: { platform: string }) {
  if (platform === "ios" || platform === "android") return <Smartphone className="w-3.5 h-3.5" />;
  return <Monitor className="w-3.5 h-3.5" />;
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
function SessionPanel({ session, onClose }: { session: MockSession; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-zinc-900 border-l border-zinc-800 h-full overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-900">
          <span className="text-white font-semibold text-sm">Session Detail</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-5 text-xs">
          <Section title="Identity">
            <Row label="Session ID" value={<span className="font-mono text-zinc-300 break-all text-[10px]">{session.id}</span>} />
            <Row label="User" value={session.user} />
            <Row label="Auth Method" value={session.authMethod} />
          </Section>
          <Section title="Timing">
            <Row label="Started" value={new Date(session.started).toLocaleString()} />
            <Row label="Last active" value={timeAgo(session.lastActive)} />
            <Row label="Expires" value={new Date(session.expires).toLocaleString()} />
          </Section>
          <Section title="Network">
            <Row label="IP" value={<span className="font-mono">{session.ip}</span>} />
            <Row label="Country" value={session.country} />
          </Section>
          <Section title="Device">
            <Row label="Model" value={session.device} />
            <Row label="Platform" value={<span className="capitalize">{session.platform}</span>} />
          </Section>
          <Section title="Auth Claims">
            <Row label="ACR" value={<AcrBadge acr={session.acr} />} />
            <Row label="AMR" value={session.amr.join(", ")} />
            <Row label="Risk score" value={<RiskChip score={session.risk} />} />
          </Section>
          <Section title="JWT Claims Snapshot">
            <pre className="text-[10px] text-zinc-400 bg-zinc-950 rounded-lg p-3 overflow-auto max-h-48 font-mono leading-relaxed">
              {JSON.stringify(session.jwtSnapshot, null, 2)}
            </pre>
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
export default function SessionsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [selected, setSelected] = useState<MockSession | null>(null);

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
          <h1 className="text-base font-bold text-white">Active Sessions</h1>
          <p className="text-zinc-500 text-xs mt-0.5">All active sessions across tenant users — {MOCK_SESSIONS.length} sessions</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/50">
                  {["Session ID", "User", "Started", "Last active", "Expires", "IP", "Country", "Device", "ACR", "Risk"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-zinc-500 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_SESSIONS.map(s => (
                  <tr
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/40 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2.5 font-mono text-zinc-400 whitespace-nowrap">{s.id.slice(0, 12)}…</td>
                    <td className="px-3 py-2.5 text-zinc-300 whitespace-nowrap">{s.user}</td>
                    <td className="px-3 py-2.5 text-zinc-400 whitespace-nowrap">{timeAgo(s.started)}</td>
                    <td className="px-3 py-2.5 text-zinc-400 whitespace-nowrap">{timeAgo(s.lastActive)}</td>
                    <td className="px-3 py-2.5 text-zinc-400 whitespace-nowrap">{timeAgo(s.expires).replace("ago", "left")}</td>
                    <td className="px-3 py-2.5 font-mono text-zinc-400">{s.ip}</td>
                    <td className="px-3 py-2.5 text-zinc-400">{s.country}</td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1.5 text-zinc-400">
                        <DeviceIcon platform={s.platform} />
                        <span className="hidden sm:block truncate max-w-[100px]">{s.device}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5"><AcrBadge acr={s.acr} /></td>
                    <td className="px-3 py-2.5"><RiskChip score={s.risk} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selected && <SessionPanel session={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
