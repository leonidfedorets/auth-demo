"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function UthLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
        <span className="font-black text-white text-xs tracking-tighter">UTH</span>
      </div>
      <span className="font-black text-xl tracking-tighter">
        <span className="text-indigo-400">U</span><span className="text-indigo-300">T</span><span className="text-indigo-200">H</span>
      </span>
    </div>
  );
}

export function LandingNav() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(async r => {
      if (r.ok) {
        const d = await r.json();
        setUser(d.user ?? null);
      }
    }).catch(() => {}).finally(() => setChecked(true));
  }, []);

  return (
    <nav className="border-b border-white/8 px-6 py-4 flex items-center justify-between sticky top-0 bg-zinc-950/90 backdrop-blur-xl z-50">
      <div className="flex items-center gap-8">
        <Link href="/">
          <UthLogo />
        </Link>
        <div className="hidden md:flex items-center gap-6">
          {[["Platform", "/platform"], ["How it works", "#how-it-works"], ["Use cases", "#use-cases"], ["Pricing", "/pricing"], ["Docs", "/docs"]].map(([l, h]) => (
            <Link key={l} href={h} className="text-sm text-zinc-400 hover:text-white transition-colors">{l}</Link>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {checked && user ? (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center text-white font-bold text-sm">
                {user.email[0].toUpperCase()}
              </div>
              <span className="hidden sm:block max-w-[140px] truncate">{user.email}</span>
            </button>
            {showMenu && (
              <div className="absolute right-0 top-10 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl w-48 z-50 py-1">
                <div className="px-3 py-2 border-b border-zinc-800">
                  <p className="text-white text-xs font-semibold truncate">{user.email}</p>
                </div>
                <Link href="/dashboard" onClick={() => setShowMenu(false)} className="block px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs">Dashboard</Link>
                <button
                  onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}
                  className="w-full text-left px-3 py-2 text-red-400 hover:text-red-300 hover:bg-zinc-800 text-xs border-t border-zinc-800 cursor-pointer"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : checked ? (
          <>
            <Link href="/login"><Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">Sign in</Button></Link>
            <Link href="/onboarding"><Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">Start free <ChevronRight className="w-3.5 h-3.5 ml-0.5" /></Button></Link>
          </>
        ) : null}
      </div>
    </nav>
  );
}
