"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/transactions", label: "Transactions" },
  { href: "/dashboard/clients", label: "Clients" },
  { href: "/dashboard/devices", label: "Devices" },
  { href: "/dashboard/sessions", label: "Sessions" },
  { href: "/dashboard/audit", label: "Audit Log" },
  { href: "/dashboard/kyb", label: "KYB" },
  { href: "/dashboard/cdd", label: "CDD" },
  { href: "/dashboard/cases", label: "Cases" },
  { href: "/dashboard/onboarding", label: "Onboarding" },
  { href: "/dashboard/risk-rules", label: "Risk Rules" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function DashNav({ user }: { user: any }) {
  const pathname = usePathname();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <nav className="border-b border-zinc-800 px-4 py-0 flex items-center bg-zinc-950 sticky top-0 z-40 h-11">
      <Link href="/" className="flex items-center gap-1.5 mr-5 shrink-0">
        <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center">
          <span className="font-black text-white text-[9px]">UTH</span>
        </div>
        <span className="font-black text-sm tracking-tighter hidden sm:block">
          <span className="text-indigo-400">U</span>
          <span className="text-indigo-300">T</span>
          <span className="text-indigo-200">H</span>
        </span>
      </Link>

      <div className="flex items-center gap-0.5 overflow-x-auto flex-1 scrollbar-none">
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2.5 text-xs whitespace-nowrap transition-colors border-b-2 -mb-px ${
              pathname === item.href
                ? "border-indigo-500 text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="relative ml-3 shrink-0">
        <button
          onClick={() => setShowMenu(v => !v)}
          className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
        >
          <div className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center text-white font-bold text-xs">
            {user?.email?.[0]?.toUpperCase() || "?"}
          </div>
          <span className="hidden sm:block max-w-[120px] truncate">{user?.email}</span>
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-9 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl w-52 z-50 py-1">
              <div className="px-3 py-2 border-b border-zinc-800">
                <p className="text-white text-xs font-semibold truncate">{user?.email}</p>
                {user?.id && (
                  <p className="text-zinc-500 text-[10px] font-mono truncate mt-0.5">{user.id}</p>
                )}
              </div>
              <Link
                href="/dashboard"
                onClick={() => setShowMenu(false)}
                className="block px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard/settings"
                onClick={() => setShowMenu(false)}
                className="block px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs"
              >
                Settings
              </Link>
              <Link
                href="/changelog"
                onClick={() => setShowMenu(false)}
                className="block px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs"
              >
                Changelog
              </Link>
              <button
                onClick={async () => {
                  setShowMenu(false);
                  await fetch("/api/auth/logout", { method: "POST" });
                  window.location.href = "/login";
                }}
                className="w-full text-left px-3 py-2 text-red-400 hover:text-red-300 hover:bg-zinc-800 text-xs border-t border-zinc-800 cursor-pointer"
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
