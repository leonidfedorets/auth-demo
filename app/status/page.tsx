import Link from "next/link";
import { Shield } from "lucide-react";
export default function Page() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <nav className="border-b border-white/8 px-6 py-4 flex items-center gap-2">
        <Shield className="w-5 h-5 text-indigo-400" />
        <Link href="/" className="font-bold text-white">AuthService</Link>
      </nav>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3 max-w-sm">
          <h1 className="text-2xl font-black text-white">Coming soon</h1>
          <p className="text-zinc-400 text-sm">This page is being prepared.</p>
          <Link href="/" className="text-indigo-400 hover:underline text-sm">← Back home</Link>
        </div>
      </div>
    </div>
  );
}
