"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Workflow, CheckCircle, XCircle, Clock, SkipForward, Play,
  RefreshCw, ChevronRight, AlertTriangle, Shield, User,
  Globe, Smartphone, Lock, Fingerprint, FileText, Zap, Info, X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── TYPES ────────────────────────────────────────────────────────────────────
type StepStatus = "pending" | "completed" | "skipped" | "blocked" | "review";

interface StepDef {
  id: string;
  label: string;
  category: string;
  isTerminal: boolean;
  isBlocking: boolean;
  isMandatory: boolean;
  isOptional: boolean;
  description: string;
  requiredFlags?: string[];
  icon: string;
}

interface UserProfile {
  country: string;
  age: number;
  isUSRelated: boolean;
  geoBlocked: boolean;
  waitlisted: boolean;
  kycL1PersonalStatus: "not_started" | "passed" | "underage";
  kycL2PoiStatus: "not_started" | "passed" | "rejected" | "review" | "duplicate";
  kycL3UniquenessStatus: "not_started" | "passed" | "duplicate";
  kycL3FraudStatus: "not_started" | "passed" | "review" | "failed";
  kycL3SanctionsStatus: "not_started" | "passed" | "hit";
  riskLevel: "low" | "medium" | "high";
  amlStatus: "not_started" | "passed" | "review" | "rejected";
  deviceSupportsбиоmetrics: boolean;
}

interface FeatureFlags {
  invite_mode: boolean;
  poi_enabled: boolean;
  seon_screening_enabled: boolean;
  biometrics_enabled: boolean;
  enhanced_aml_enabled: boolean;
  mobile_verification_required: boolean;
}

interface FlowStep {
  stepId: string;
  status: StepStatus;
  completedAt?: string;
  skippedReason?: string;
}

// ─── STEP REGISTRY ────────────────────────────────────────────────────────────
const STEP_REGISTRY: StepDef[] = [
  // ── Regular steps
  { id: "invitation_", label: "Invitation / Referral", category: "Pre-KYC", isTerminal: false, isBlocking: false, isMandatory: false, isOptional: true, description: "Validates user's invitation code before allowing registration to proceed.", requiredFlags: ["invite_mode"], icon: "🎟️" },
  { id: "mobile_verification", label: "Mobile Verification", category: "Identity", isTerminal: false, isBlocking: false, isMandatory: true, isOptional: false, description: "User verifies their phone number via SMS OTP. Required to proceed with identity checks.", requiredFlags: ["mobile_verification_required"], icon: "📱" },
  { id: "kyc_l1_us_relation", label: "KYC L1 – US Relation Check", category: "KYC L1", isTerminal: false, isBlocking: true, isMandatory: true, isOptional: false, description: "Checks whether the user is a US citizen, resident, or taxpayer (FATCA compliance). US-related users are blocked.", requiredFlags: [], icon: "🇺🇸" },
  { id: "kyc_l1_geo", label: "KYC L1 – Geo Eligibility", category: "KYC L1", isTerminal: false, isBlocking: true, isMandatory: true, isOptional: false, description: "Validates that the user's country of residence is permitted. Blocked or waitlisted countries trigger respective screens.", requiredFlags: [], icon: "🌍" },
  { id: "kyc_l1_personal_data", label: "KYC L1 – Personal Data", category: "KYC L1", isTerminal: false, isBlocking: true, isMandatory: true, isOptional: false, description: "Collects full legal name, date of birth, and country. Underage users (<18) are blocked.", requiredFlags: [], icon: "👤" },
  { id: "kyc_l2_poi", label: "KYC L2 – Proof of Identity", category: "KYC L2", isTerminal: false, isBlocking: true, isMandatory: false, isOptional: false, description: "Document verification via SumSub. Accepted: passport, national ID, driving licence. Duplicate documents blocked.", requiredFlags: ["poi_enabled"], icon: "🪪" },
  { id: "kyc_l3_seon_uniqueness", label: "KYC L3 – Uniqueness Check", category: "KYC L3 (SEON)", isTerminal: false, isBlocking: true, isMandatory: false, isOptional: false, description: "Checks via SEON whether the email/phone/device fingerprint already exists in the system (duplicate account detection).", requiredFlags: ["seon_screening_enabled"], icon: "🔍" },
  { id: "kyc_l3_seon_fraud", label: "KYC L3 – Fraud Score", category: "KYC L3 (SEON)", isTerminal: false, isBlocking: true, isMandatory: false, isOptional: false, description: "SEON fraud risk scoring. Score > threshold → review queue. High confidence fraud → immediate block.", requiredFlags: ["seon_screening_enabled"], icon: "🛡️" },
  { id: "kyc_l3_seon_sanctions", label: "KYC L3 – Sanctions Screening", category: "KYC L3 (SEON)", isTerminal: false, isBlocking: true, isMandatory: false, isOptional: false, description: "Screens name and date of birth against global sanctions lists (OFAC, UN, EU, FATF). Hit → blocked screen.", requiredFlags: ["seon_screening_enabled"], icon: "⚡" },
  { id: "username_creation", label: "Username / Display Name", category: "Account Setup", isTerminal: false, isBlocking: false, isMandatory: true, isOptional: false, description: "User selects their in-app display name / username. Uniqueness validated in real time.", requiredFlags: [], icon: "✏️" },
  { id: "sca_pin_setup", label: "SCA – PIN Setup", category: "SCA", isTerminal: false, isBlocking: false, isMandatory: true, isOptional: false, description: "User sets their 6-digit PIN for Strong Customer Authentication. Stored as PBKDF2 hash, never in plain text.", requiredFlags: [], icon: "🔢" },
  { id: "sca_device_binding", label: "SCA – Device Binding", category: "SCA", isTerminal: false, isBlocking: false, isMandatory: true, isOptional: false, description: "Cryptographic binding of the user identity to the current device. Generates device-scoped key pair.", requiredFlags: [], icon: "🔗" },
  { id: "biometric_enablement", label: "Biometric Enablement", category: "SCA", isTerminal: false, isBlocking: false, isMandatory: false, isOptional: true, description: "Optional step to enrol Face ID / Touch ID / fingerprint for frictionless future logins. Skipped if device does not support biometrics.", requiredFlags: ["biometrics_enabled"], icon: "👁️" },
  { id: "aml_questionnaire", label: "AML Questionnaire", category: "Compliance", isTerminal: false, isBlocking: false, isMandatory: true, isOptional: false, description: "Standard AML questionnaire: source of funds, occupation, expected transaction volume, PEP declaration.", requiredFlags: [], icon: "📋" },
  { id: "enhanced_aml_questionnaire", label: "Enhanced AML Questionnaire", category: "Compliance", isTerminal: false, isBlocking: false, isMandatory: false, isOptional: false, description: "Extended AML questionnaire for high-risk users: business relationship, beneficial ownership, regulatory declarations.", requiredFlags: ["enhanced_aml_enabled"], icon: "📊" },
  { id: "system_configuration", label: "System Configuration", category: "System", isTerminal: false, isBlocking: false, isMandatory: true, isOptional: false, description: "Backend provisioning: creates wallet, sets default limits, configures notification preferences. Transparent to user.", requiredFlags: [], icon: "⚙️" },
  { id: "wallet_ready", label: "Wallet Ready 🎉", category: "System", isTerminal: false, isBlocking: false, isMandatory: true, isOptional: false, description: "Final confirmation screen. User is now fully onboarded and can access the app.", requiredFlags: [], icon: "🎉" },
  // ── Terminal / blocking screens
  { id: "us_related_blocked_screen", label: "US-Related Blocked", category: "Terminal Screen", isTerminal: true, isBlocking: true, isMandatory: false, isOptional: false, description: "Shown when the user declares US residency, citizenship, or taxpayer status. Registration cannot proceed.", requiredFlags: [], icon: "🚫" },
  { id: "geo_blocked_screen", label: "Geo Blocked", category: "Terminal Screen", isTerminal: true, isBlocking: true, isMandatory: false, isOptional: false, description: "Shown when the user's country is on the prohibited/blocked list. Registration cannot proceed.", requiredFlags: [], icon: "🌐" },
  { id: "geo_waitlisted_screen", label: "Geo Waitlisted", category: "Terminal Screen", isTerminal: true, isBlocking: false, isMandatory: false, isOptional: false, description: "Shown when the user's country is on the waitlist. User is added to waitlist queue.", requiredFlags: [], icon: "⏳" },
  { id: "underage_blocked_screen", label: "Underage Blocked", category: "Terminal Screen", isTerminal: true, isBlocking: true, isMandatory: false, isOptional: false, description: "Shown when the user declares age < 18. Registration cannot proceed.", requiredFlags: [], icon: "🔞" },
  { id: "duplicate_account_screen", label: "Duplicate Account", category: "Terminal Screen", isTerminal: true, isBlocking: true, isMandatory: false, isOptional: false, description: "Shown when SEON detects an existing account linked to the same identity signals.", requiredFlags: [], icon: "👥" },
  { id: "fraud_failed_screen", label: "Fraud Failed", category: "Terminal Screen", isTerminal: true, isBlocking: true, isMandatory: false, isOptional: false, description: "Shown when SEON fraud score exceeds the hard block threshold.", requiredFlags: [], icon: "❌" },
  { id: "sanctions_blocked_screen", label: "Sanctions Hit", category: "Terminal Screen", isTerminal: true, isBlocking: true, isMandatory: false, isOptional: false, description: "Shown when the user's name/DOB matches a sanctions list entry.", requiredFlags: [], icon: "⛔" },
  { id: "poi_review_pending", label: "POI Review Pending", category: "Terminal Screen", isTerminal: true, isBlocking: false, isMandatory: false, isOptional: false, description: "Shown when POI document is under manual review. User must wait for compliance team approval.", requiredFlags: [], icon: "🕐" },
  { id: "fraud_review_pending", label: "Fraud Review Pending", category: "Terminal Screen", isTerminal: true, isBlocking: false, isMandatory: false, isOptional: false, description: "Shown when SEON fraud score requires manual review before approval.", requiredFlags: [], icon: "🔎" },
  { id: "aml_review_pending", label: "AML Review Pending", category: "Terminal Screen", isTerminal: true, isBlocking: false, isMandatory: false, isOptional: false, description: "Shown when AML questionnaire answers require manual compliance review.", requiredFlags: [], icon: "📌" },
];

const STEP_MAP = Object.fromEntries(STEP_REGISTRY.map(s => [s.id, s]));

// ─── FLOW BUILDER LOGIC ───────────────────────────────────────────────────────
function buildFlow(profile: UserProfile, flags: FeatureFlags): string[] {
  // Terminal / blocked paths first
  if (profile.isUSRelated) return ["kyc_l1_us_relation", "us_related_blocked_screen"];
  if (profile.geoBlocked) return ["kyc_l1_geo", "geo_blocked_screen"];
  if (profile.waitlisted) return ["kyc_l1_geo", "geo_waitlisted_screen"];
  if (profile.age < 18) return ["kyc_l1_personal_data", "underage_blocked_screen"];
  if (profile.kycL3UniquenessStatus === "duplicate") return ["kyc_l3_seon_uniqueness", "duplicate_account_screen"];
  if (profile.kycL3FraudStatus === "failed") return ["kyc_l3_seon_fraud", "fraud_failed_screen"];
  if (profile.kycL3SanctionsStatus === "hit") return ["kyc_l3_seon_sanctions", "sanctions_blocked_screen"];
  if (profile.kycL2PoiStatus === "review") return ["kyc_l2_poi", "poi_review_pending"];
  if (profile.kycL3FraudStatus === "review") return ["kyc_l3_seon_fraud", "fraud_review_pending"];
  if (profile.amlStatus === "review") return ["aml_questionnaire", "aml_review_pending"];

  const flow: string[] = [];

  // Pre-KYC
  if (flags.invite_mode) flow.push("invitation_");

  // Identity
  if (flags.mobile_verification_required) flow.push("mobile_verification");

  // L1
  flow.push("kyc_l1_us_relation");
  flow.push("kyc_l1_geo");
  flow.push("kyc_l1_personal_data");

  // L2 POI
  if (flags.poi_enabled) flow.push("kyc_l2_poi");

  // L3 SEON
  if (flags.seon_screening_enabled) {
    flow.push("kyc_l3_seon_uniqueness");
    flow.push("kyc_l3_seon_fraud");
    flow.push("kyc_l3_seon_sanctions");
  }

  // Account setup
  flow.push("username_creation");
  flow.push("sca_pin_setup");
  flow.push("sca_device_binding");

  // Biometrics (optional)
  if (flags.biometrics_enabled && profile.deviceSupportsбиоmetrics) {
    flow.push("biometric_enablement");
  }

  // AML
  flow.push("aml_questionnaire");
  if (flags.enhanced_aml_enabled && profile.riskLevel === "high") {
    flow.push("enhanced_aml_questionnaire");
  }

  // System
  flow.push("system_configuration");
  flow.push("wallet_ready");

  return flow;
}

// ─── NAV ─────────────────────────────────────────────────────────────────────
function DashNav({ user }: { user: any }) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const NAV = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/transactions", label: "Transactions" },
    { href: "/dashboard/clients", label: "Clients" },
    { href: "/dashboard/devices", label: "Devices" },
    { href: "/dashboard/sessions", label: "Sessions" },
    { href: "/dashboard/audit", label: "Audit Log" },
    { href: "/dashboard/kyb", label: "KYB" },
    { href: "/dashboard/onboarding", label: "Onboarding" },
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
        {NAV.map(item => (
          <Link key={item.href} href={item.href} className={`px-3 py-2.5 text-xs whitespace-nowrap transition-colors border-b-2 -mb-px ${pathname === item.href ? "border-indigo-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
            {item.label}
          </Link>
        ))}
      </div>
      <div className="relative ml-3 shrink-0">
        <button onClick={() => setMenu(!menu)} className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white cursor-pointer">
          <div className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center text-white font-bold text-xs">{user?.email?.[0]?.toUpperCase() || "?"}</div>
        </button>
        {menu && (
          <div className="absolute right-0 top-9 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl w-44 z-50 py-1">
            <Link href="/dashboard/settings" onClick={() => setMenu(false)} className="block px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs">Settings</Link>
            <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }} className="w-full text-left px-3 py-2 text-red-400 hover:text-red-300 hover:bg-zinc-800 text-xs border-t border-zinc-800 cursor-pointer">Sign out</button>
          </div>
        )}
      </div>
    </nav>
  );
}

// ─── STEP REGISTRY TAB ────────────────────────────────────────────────────────
function StepRegistryTab() {
  const [selected, setSelected] = useState<StepDef | null>(null);
  const [filter, setFilter] = useState("All");

  const categories = useMemo(() => ["All", ...Array.from(new Set(STEP_REGISTRY.map(s => s.category)))], []);
  const filtered = STEP_REGISTRY.filter(s => filter === "All" || s.category === filter);

  return (
    <div className="flex h-[calc(100vh-140px)]">
      <div className={`flex-1 overflow-auto ${selected ? "lg:max-w-[60%]" : ""}`}>
        <div className="p-4 border-b border-zinc-800 flex gap-2 flex-wrap">
          {categories.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className={`px-3 py-1 rounded-full text-xs cursor-pointer transition-colors ${filter === c ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}>
              {c}
            </button>
          ))}
        </div>
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-zinc-950 border-b border-zinc-800">
            <tr>{["Step","Category","Terminal","Mandatory","Optional","Description"].map(h => <th key={h} className="text-left px-4 py-2.5 text-zinc-500 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} onClick={() => setSelected(selected?.id === s.id ? null : s)}
                className={`border-b border-zinc-800/40 hover:bg-zinc-900 cursor-pointer ${selected?.id === s.id ? "bg-zinc-900" : ""} ${s.isTerminal ? "opacity-70" : ""}`}>
                <td className="px-4 py-3">
                  <div className="text-white font-medium">{s.label}</div>
                  <div className="text-zinc-500 font-mono text-[10px]">{s.id}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge className="text-[10px] border border-zinc-700 text-zinc-400">{s.category}</Badge>
                </td>
                <td className="px-4 py-3">{s.isTerminal ? <span className="text-orange-400">■</span> : <span className="text-zinc-700">—</span>}</td>
                <td className="px-4 py-3">{s.isMandatory ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <span className="text-zinc-700">—</span>}</td>
                <td className="px-4 py-3">{s.isOptional ? <CheckCircle className="w-3.5 h-3.5 text-indigo-400" /> : <span className="text-zinc-700">—</span>}</td>
                <td className="px-4 py-3 text-zinc-400 max-w-xs truncate">{s.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && (
        <div className="w-full lg:w-[40%] border-l border-zinc-800 overflow-auto flex-shrink-0">
          <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 px-5 py-3 flex justify-between items-center">
            <p className="text-white font-semibold text-sm">{selected.label}</p>
            <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-5 space-y-4">
            <div className="text-5xl text-center">{selected.icon}</div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800/50">
              {([
                ["Step ID", selected.id, true],
                ["Category", selected.category],
                ["Terminal", selected.isTerminal ? "Yes – replaces normal flow" : "No"],
                ["Blocking", selected.isBlocking ? "Yes – halts flow" : "No"],
                ["Mandatory", selected.isMandatory ? "Yes – always included" : "No"],
                ["Optional", selected.isOptional ? "Yes – can be skipped/hidden" : "No"],
                ["Required Flags", selected.requiredFlags?.length ? selected.requiredFlags.join(", ") : "None"],
              ] as [string, string, boolean?][]).map(([l, v, m]) => (
                <div key={l} className="flex items-center justify-between px-3 py-2 gap-2">
                  <span className="text-zinc-500 text-xs">{l}</span>
                  <span className={`text-xs ${m ? "font-mono text-indigo-300" : "text-zinc-300"}`}>{v}</span>
                </div>
              ))}
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <p className="text-zinc-500 text-[10px] mb-1">Description</p>
              <p className="text-zinc-300 text-xs leading-relaxed">{selected.description}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FLOW SIMULATOR TAB ───────────────────────────────────────────────────────
const LOW_RISK_COUNTRIES = ["Germany","France","United Kingdom","Netherlands","Ireland","Sweden","Denmark","Finland","Austria","Belgium","Switzerland","Poland","Spain","Portugal","Italy"];
const HIGH_RISK_COUNTRIES = ["Nigeria","Pakistan","Bangladesh","Ethiopia","Algeria","Egypt","Kenya","Tanzania","Ghana","Cameroon"];
const ALL_COUNTRIES = [...LOW_RISK_COUNTRIES, "United States","Canada","Australia","Brazil","India","China","Thailand","Vietnam","Ukraine","Serbia","Colombia","Peru","Tunisia","Morocco","Jordan","UAE", ...HIGH_RISK_COUNTRIES];

function FlowSimulatorTab() {
  const [profile, setProfile] = useState<UserProfile>({
    country: "Germany", age: 25, isUSRelated: false, geoBlocked: false, waitlisted: false,
    kycL1PersonalStatus: "not_started", kycL2PoiStatus: "not_started",
    kycL3UniquenessStatus: "not_started", kycL3FraudStatus: "not_started",
    kycL3SanctionsStatus: "not_started", riskLevel: "low", amlStatus: "not_started",
    deviceSupportsбиоmetrics: true,
  });

  const [flags, setFlags] = useState<FeatureFlags>({
    invite_mode: false, poi_enabled: true, seon_screening_enabled: true,
    biometrics_enabled: true, enhanced_aml_enabled: true, mobile_verification_required: true,
  });

  const setP = (k: keyof UserProfile, v: any) => setProfile(p => ({ ...p, [k]: v }));
  const setF = (k: keyof FeatureFlags, v: boolean) => setFlags(f => ({ ...f, [k]: v }));

  const flow = useMemo(() => buildFlow(profile, flags), [profile, flags]);

  function stepColor(step: StepDef) {
    if (step.isTerminal && step.isBlocking) return "border-red-500/40 bg-red-500/5";
    if (step.isTerminal) return "border-orange-500/40 bg-orange-500/5";
    if (step.isMandatory) return "border-indigo-500/20 bg-indigo-500/5";
    return "border-zinc-700 bg-zinc-900";
  }

  return (
    <div className="flex h-[calc(100vh-140px)]">
      {/* Profile Config */}
      <div className="w-72 border-r border-zinc-800 overflow-auto p-4 space-y-5 flex-shrink-0">
        <div>
          <p className="text-zinc-400 text-xs font-semibold mb-2">User Profile State</p>
          <div className="space-y-3">
            <div>
              <label className="text-zinc-500 text-[10px] block mb-1">Country</label>
              <select value={profile.country} onChange={e => setP("country", e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded text-white text-xs px-2 py-1.5 cursor-pointer">
                {ALL_COUNTRIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-zinc-500 text-[10px] block mb-1">Age</label>
              <input type="number" min={0} max={120} value={profile.age} onChange={e => setP("age", +e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded text-white text-xs px-2 py-1.5" />
            </div>
            <div>
              <label className="text-zinc-500 text-[10px] block mb-1">Risk Level</label>
              <select value={profile.riskLevel} onChange={e => setP("riskLevel", e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded text-white text-xs px-2 py-1.5 cursor-pointer">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            {([
              ["isUSRelated", "US Related"],
              ["geoBlocked", "Geo Blocked"],
              ["waitlisted", "Waitlisted"],
              ["deviceSupportsбиоmetrics", "Device Supports Biometrics"],
            ] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-2 cursor-pointer text-zinc-300 text-xs">
                <input type="checkbox" checked={profile[k] as boolean} onChange={e => setP(k, e.target.checked)} className="accent-indigo-500" />
                {l}
              </label>
            ))}
          </div>
        </div>

        <div className="border-t border-zinc-800 pt-4">
          <p className="text-zinc-400 text-xs font-semibold mb-2">KYC Status</p>
          <div className="space-y-2">
            <div>
              <label className="text-zinc-500 text-[10px] block mb-1">POI (L2) Status</label>
              <select value={profile.kycL2PoiStatus} onChange={e => setP("kycL2PoiStatus", e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded text-white text-[11px] px-2 py-1 cursor-pointer">
                {["not_started","passed","rejected","review","duplicate"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-zinc-500 text-[10px] block mb-1">Uniqueness (L3) Status</label>
              <select value={profile.kycL3UniquenessStatus} onChange={e => setP("kycL3UniquenessStatus", e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded text-white text-[11px] px-2 py-1 cursor-pointer">
                {["not_started","passed","duplicate"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-zinc-500 text-[10px] block mb-1">Fraud (L3) Status</label>
              <select value={profile.kycL3FraudStatus} onChange={e => setP("kycL3FraudStatus", e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded text-white text-[11px] px-2 py-1 cursor-pointer">
                {["not_started","passed","review","failed"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-zinc-500 text-[10px] block mb-1">Sanctions (L3) Status</label>
              <select value={profile.kycL3SanctionsStatus} onChange={e => setP("kycL3SanctionsStatus", e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded text-white text-[11px] px-2 py-1 cursor-pointer">
                {["not_started","passed","hit"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-zinc-500 text-[10px] block mb-1">AML Status</label>
              <select value={profile.amlStatus} onChange={e => setP("amlStatus", e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded text-white text-[11px] px-2 py-1 cursor-pointer">
                {["not_started","passed","review","rejected"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-800 pt-4">
          <p className="text-zinc-400 text-xs font-semibold mb-2">Feature Flags</p>
          <div className="space-y-1.5">
            {(Object.keys(flags) as (keyof FeatureFlags)[]).map(k => (
              <label key={k} className="flex items-center gap-2 cursor-pointer text-zinc-300 text-[11px]">
                <input type="checkbox" checked={flags[k]} onChange={e => setF(k, e.target.checked)} className="accent-indigo-500" />
                <span className="font-mono">{k}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Computed Flow */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white">Computed Flow</h2>
            <Badge className="text-[10px] border border-zinc-700 text-zinc-400">{flow.length} steps</Badge>
          </div>

          <div className="space-y-2">
            {flow.map((stepId, idx) => {
              const step = STEP_MAP[stepId];
              if (!step) return null;
              return (
                <div key={stepId} className={`border rounded-xl p-3 ${stepColor(step)}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 text-[10px] font-bold">{idx + 1}</div>
                      {idx < flow.length - 1 && <div className="w-px h-4 bg-zinc-700" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-xs font-medium">{step.label}</span>
                        {step.isTerminal && <Badge className="text-[9px] border border-orange-500/40 text-orange-400">terminal</Badge>}
                        {step.isBlocking && step.isTerminal && <Badge className="text-[9px] border border-red-500/40 text-red-400">blocking</Badge>}
                        {step.isOptional && <Badge className="text-[9px] border border-indigo-500/30 text-indigo-400">optional</Badge>}
                        {step.requiredFlags?.some(f => f === "invite_mode" && flags.invite_mode) && <Badge className="text-[9px] border border-zinc-700 text-zinc-500">flag: invite_mode</Badge>}
                      </div>
                      <p className="text-zinc-500 text-[10px] mt-0.5">{step.category} · {step.id}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {flow.some(id => STEP_MAP[id]?.isTerminal && STEP_MAP[id]?.isBlocking) && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-red-300 text-xs">This flow ends at a <strong>blocking terminal screen</strong> — user cannot complete registration with the current profile.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── WALKTHROUGH TAB ──────────────────────────────────────────────────────────
function WalkthroughTab() {
  const defaultProfile: UserProfile = {
    country: "Germany", age: 25, isUSRelated: false, geoBlocked: false, waitlisted: false,
    kycL1PersonalStatus: "not_started", kycL2PoiStatus: "not_started",
    kycL3UniquenessStatus: "not_started", kycL3FraudStatus: "not_started",
    kycL3SanctionsStatus: "not_started", riskLevel: "low", amlStatus: "not_started",
    deviceSupportsбиоmetrics: true,
  };
  const defaultFlags: FeatureFlags = {
    invite_mode: false, poi_enabled: true, seon_screening_enabled: true,
    biometrics_enabled: true, enhanced_aml_enabled: false, mobile_verification_required: true,
  };

  const [flow] = useState<string[]>(() => buildFlow(defaultProfile, defaultFlags));
  const [stepStates, setStepStates] = useState<FlowStep[]>(() => flow.map(id => ({ stepId: id, status: "pending" })));
  const [currentIdx, setCurrentIdx] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  const currentStep = STEP_MAP[flow[currentIdx]];
  const isFinished = currentIdx >= flow.length;

  function advance(action: "complete" | "skip") {
    if (isFinished) return;
    const now = new Date().toISOString();
    setStepStates(prev => prev.map((s, i) => i === currentIdx
      ? { ...s, status: action === "complete" ? "completed" : "skipped", completedAt: now }
      : s
    ));
    setLog(prev => [...prev, `[${now.slice(11,19)}] ${action === "complete" ? "✓" : "⇒"} ${currentStep?.label}`]);
    setCurrentIdx(i => i + 1);
  }

  function reset() {
    setStepStates(flow.map(id => ({ stepId: id, status: "pending" })));
    setCurrentIdx(0);
    setLog([]);
  }

  return (
    <div className="flex h-[calc(100vh-140px)]">
      {/* Progress list */}
      <div className="w-72 border-r border-zinc-800 overflow-auto p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <p className="text-zinc-400 text-xs font-semibold">Flow Progress</p>
          <button onClick={reset} className="text-zinc-500 hover:text-white cursor-pointer"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
        <div className="space-y-1.5">
          {flow.map((stepId, idx) => {
            const step = STEP_MAP[stepId];
            const state = stepStates[idx];
            const isCurrent = idx === currentIdx && !isFinished;
            return (
              <div key={stepId} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors ${isCurrent ? "bg-indigo-500/10 border border-indigo-500/30" : "border border-transparent"}`}>
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                  {state.status === "completed" ? <CheckCircle className="w-4 h-4 text-green-400" />
                    : state.status === "skipped" ? <SkipForward className="w-4 h-4 text-zinc-500" />
                    : isCurrent ? <div className="w-3 h-3 rounded-full bg-indigo-400 animate-pulse" />
                    : <div className="w-3 h-3 rounded-full border border-zinc-600" />}
                </div>
                <span className={state.status === "completed" ? "text-green-400" : state.status === "skipped" ? "text-zinc-600" : isCurrent ? "text-white" : "text-zinc-500"}>{step?.label}</span>
              </div>
            );
          })}
          {isFinished && (
            <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs bg-green-500/10 border border-green-500/30">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-green-400 font-semibold">Onboarding complete!</span>
            </div>
          )}
        </div>
        {/* Progress bar */}
        <div className="mt-4 space-y-1">
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>{stepStates.filter(s => s.status === "completed" || s.status === "skipped").length} / {flow.length}</span>
            <span>{Math.round((stepStates.filter(s => s.status !== "pending").length / flow.length) * 100)}%</span>
          </div>
          <div className="bg-zinc-800 rounded-full h-1.5 overflow-hidden">
            <div className="bg-indigo-500 h-full rounded-full transition-all"
              style={{ width: `${(stepStates.filter(s => s.status !== "pending").length / flow.length) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Step detail */}
      <div className="flex-1 overflow-auto p-6 flex flex-col items-center justify-center">
        {isFinished ? (
          <div className="text-center space-y-4">
            <div className="text-6xl">🎉</div>
            <h2 className="text-xl font-bold text-white">Onboarding Complete!</h2>
            <p className="text-zinc-400 text-sm max-w-sm">All {flow.length} steps processed. The user is now fully onboarded and ready to use the app.</p>
            <button onClick={reset} className="flex items-center gap-2 mx-auto bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg cursor-pointer transition-colors">
              <RefreshCw className="w-4 h-4" />Restart Walkthrough
            </button>
          </div>
        ) : currentStep ? (
          <div className="max-w-md w-full space-y-5">
            <div className="flex items-center gap-2 text-zinc-500 text-xs">
              <span>Step {currentIdx + 1} of {flow.length}</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-zinc-400">{currentStep.category}</span>
            </div>
            <div className="text-center text-5xl">{currentStep.icon}</div>
            <div className="text-center">
              <h2 className="text-lg font-bold text-white">{currentStep.label}</h2>
              <p className="text-zinc-500 text-xs mt-1 font-mono">{currentStep.id}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-zinc-400 text-xs leading-relaxed">{currentStep.description}</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {currentStep.isTerminal && currentStep.isBlocking ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 w-full text-center">
                  <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                  <p className="text-red-300 text-sm font-semibold">Blocking Terminal Screen</p>
                  <p className="text-red-400/70 text-xs mt-1">User cannot proceed. Registration is halted.</p>
                </div>
              ) : currentStep.isTerminal ? (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 w-full text-center">
                  <Clock className="w-6 h-6 text-orange-400 mx-auto mb-2" />
                  <p className="text-orange-300 text-sm font-semibold">Non-blocking Terminal Screen</p>
                  <p className="text-orange-400/70 text-xs mt-1">User is placed in a pending/waiting state.</p>
                  <button onClick={() => advance("complete")} className="mt-3 bg-orange-600 hover:bg-orange-500 text-white text-xs px-4 py-2 rounded-lg cursor-pointer">Acknowledge →</button>
                </div>
              ) : (
                <>
                  <button onClick={() => advance("complete")} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg cursor-pointer transition-colors">
                    <CheckCircle className="w-4 h-4" />Complete Step
                  </button>
                  {currentStep.isOptional && (
                    <button onClick={() => advance("skip")} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm px-4 py-2 rounded-lg cursor-pointer transition-colors">
                      <SkipForward className="w-4 h-4" />Skip (optional)
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Event log */}
      {log.length > 0 && (
        <div className="w-60 border-l border-zinc-800 overflow-auto p-4 flex-shrink-0">
          <p className="text-zinc-400 text-xs font-semibold mb-3">Event Log</p>
          <div className="space-y-1 font-mono text-[10px] text-zinc-500">
            {log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<"simulator" | "registry" | "walkthrough">("simulator");

  useEffect(() => {
    fetch("/api/auth/me").then(async r => {
      if (r.status === 401) { router.push("/login"); return; }
      const d = await r.json(); setUser(d.user);
    });
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <DashNav user={user} />

      <div className="border-b border-zinc-800 px-6 py-4 flex items-center gap-4">
        <Workflow className="w-5 h-5 text-indigo-400" />
        <div>
          <h1 className="text-base font-bold text-white">Onboarding Flow Engine</h1>
          <p className="text-zinc-500 text-xs">Step registry, flow builder simulation, and step-by-step walkthrough</p>
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-green-400" />{STEP_REGISTRY.filter(s => !s.isTerminal).length} steps</span>
          <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-orange-400" />{STEP_REGISTRY.filter(s => s.isTerminal).length} terminal screens</span>
        </div>
      </div>

      <div className="border-b border-zinc-800 px-6 flex gap-1">
        {([["simulator","Flow Simulator"],["registry","Step Registry"],["walkthrough","Walkthrough"]] as const).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2.5 text-xs border-b-2 -mb-px cursor-pointer transition-colors ${tab === t ? "border-indigo-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>{l}</button>
        ))}
      </div>

      {tab === "registry" && <StepRegistryTab />}
      {tab === "simulator" && <FlowSimulatorTab />}
      {tab === "walkthrough" && <WalkthroughTab />}
    </div>
  );
}
