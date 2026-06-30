"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Workflow, CheckCircle, XCircle, Clock, SkipForward, Play,
  RefreshCw, ChevronRight, ChevronUp, ChevronDown, AlertTriangle,
  Plus, Trash2, Edit, X, Smartphone, ShieldCheck, Fingerprint,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface StepDef {
  id: string;
  label: string;
  category: string;
  isTerminal: boolean;
  isBlocking: boolean;
  isMandatory: boolean;
  isOptional: boolean;
  description: string;
  requiredFlags: string[];
  screenType: string;
  icon: string;
}

interface UserProfile {
  country: string;
  age: number;
  isUSRelated: boolean;
  geoBlocked: boolean;
  waitlisted: boolean;
  kycL2PoiStatus: "not_started" | "passed" | "rejected" | "review" | "duplicate";
  kycL3UniquenessStatus: "not_started" | "passed" | "duplicate";
  kycL3FraudStatus: "not_started" | "passed" | "review" | "failed";
  kycL3SanctionsStatus: "not_started" | "passed" | "hit";
  riskLevel: "low" | "medium" | "high";
  amlStatus: "not_started" | "passed" | "review" | "rejected";
  deviceSupportsBiometrics: boolean;
}

interface FeatureFlags {
  invite_mode: boolean;
  poi_enabled: boolean;
  seon_screening_enabled: boolean;
  biometrics_enabled: boolean;
  enhanced_aml_enabled: boolean;
  mobile_verification_required: boolean;
}

interface NamedFlow {
  id: string;
  name: string;
  description: string;
  flags: FeatureFlags;
  profile: UserProfile;
  stepIds: string[];
  updatedAt: string;
}

// ─── DEFAULT STEP REGISTRY ────────────────────────────────────────────────────
const DEFAULT_STEPS: StepDef[] = [
  { id: "invitation_", label: "Invitation / Referral", category: "Pre-KYC", isTerminal: false, isBlocking: false, isMandatory: false, isOptional: true, description: "Validates user's invitation code before allowing registration to proceed.", requiredFlags: ["invite_mode"], screenType: "invite_code", icon: "🎟️" },
  { id: "mobile_verification", label: "Mobile Verification", category: "Identity", isTerminal: false, isBlocking: false, isMandatory: true, isOptional: false, description: "User verifies their phone number via SMS OTP.", requiredFlags: ["mobile_verification_required"], screenType: "mobile_otp", icon: "📱" },
  { id: "kyc_l1_us_relation", label: "KYC L1 – US Relation Check", category: "KYC L1", isTerminal: false, isBlocking: true, isMandatory: true, isOptional: false, description: "Checks whether the user is a US citizen, resident, or taxpayer (FATCA compliance).", requiredFlags: [], screenType: "us_relation", icon: "🇺🇸" },
  { id: "kyc_l1_geo", label: "KYC L1 – Geo Eligibility", category: "KYC L1", isTerminal: false, isBlocking: true, isMandatory: true, isOptional: false, description: "Validates that the user's country of residence is permitted.", requiredFlags: [], screenType: "geo_select", icon: "🌍" },
  { id: "kyc_l1_personal_data", label: "KYC L1 – Personal Data", category: "KYC L1", isTerminal: false, isBlocking: true, isMandatory: true, isOptional: false, description: "Collects full legal name, date of birth, and nationality.", requiredFlags: [], screenType: "personal_data", icon: "👤" },
  { id: "kyc_l2_poi", label: "KYC L2 – Proof of Identity", category: "KYC L2", isTerminal: false, isBlocking: true, isMandatory: false, isOptional: false, description: "Document verification via SumSub. Accepted: passport, national ID, driving licence.", requiredFlags: ["poi_enabled"], screenType: "poi_upload", icon: "🪪" },
  { id: "kyc_l3_seon_uniqueness", label: "KYC L3 – Uniqueness Check", category: "KYC L3 (SEON)", isTerminal: false, isBlocking: true, isMandatory: false, isOptional: false, description: "Checks via SEON whether the email/phone/device fingerprint already exists.", requiredFlags: ["seon_screening_enabled"], screenType: "processing", icon: "🔍" },
  { id: "kyc_l3_seon_fraud", label: "KYC L3 – Fraud Score", category: "KYC L3 (SEON)", isTerminal: false, isBlocking: true, isMandatory: false, isOptional: false, description: "SEON fraud risk scoring against device, email and behavioral signals.", requiredFlags: ["seon_screening_enabled"], screenType: "processing", icon: "🛡️" },
  { id: "kyc_l3_seon_sanctions", label: "KYC L3 – Sanctions Screening", category: "KYC L3 (SEON)", isTerminal: false, isBlocking: true, isMandatory: false, isOptional: false, description: "Screens name and date of birth against global sanctions lists.", requiredFlags: ["seon_screening_enabled"], screenType: "processing", icon: "⚡" },
  { id: "username_creation", label: "Username / Display Name", category: "Account Setup", isTerminal: false, isBlocking: false, isMandatory: true, isOptional: false, description: "User selects their in-app display name / username.", requiredFlags: [], screenType: "username", icon: "✏️" },
  { id: "sca_pin_setup", label: "SCA – PIN Setup", category: "SCA", isTerminal: false, isBlocking: false, isMandatory: true, isOptional: false, description: "User sets their 6-digit PIN for Strong Customer Authentication.", requiredFlags: [], screenType: "pin_setup", icon: "🔢" },
  { id: "sca_device_binding", label: "SCA – Device Binding", category: "SCA", isTerminal: false, isBlocking: false, isMandatory: true, isOptional: false, description: "Cryptographic binding of the user identity to the current device.", requiredFlags: [], screenType: "device_binding", icon: "🔗" },
  { id: "biometric_enablement", label: "Biometric Enablement", category: "SCA", isTerminal: false, isBlocking: false, isMandatory: false, isOptional: true, description: "Optional step to enrol Face ID / Touch ID for frictionless future logins.", requiredFlags: ["biometrics_enabled"], screenType: "biometric", icon: "👁️" },
  { id: "aml_questionnaire", label: "AML Questionnaire", category: "Compliance", isTerminal: false, isBlocking: false, isMandatory: true, isOptional: false, description: "Standard AML questionnaire: source of funds, occupation, volume, PEP.", requiredFlags: [], screenType: "aml_form", icon: "📋" },
  { id: "enhanced_aml_questionnaire", label: "Enhanced AML Questionnaire", category: "Compliance", isTerminal: false, isBlocking: false, isMandatory: false, isOptional: false, description: "Extended AML questionnaire for high-risk users.", requiredFlags: ["enhanced_aml_enabled"], screenType: "enhanced_aml_form", icon: "📊" },
  { id: "system_configuration", label: "System Configuration", category: "System", isTerminal: false, isBlocking: false, isMandatory: true, isOptional: false, description: "Backend provisioning: creates wallet, sets default limits.", requiredFlags: [], screenType: "system_progress", icon: "⚙️" },
  { id: "wallet_ready", label: "Wallet Ready", category: "System", isTerminal: false, isBlocking: false, isMandatory: true, isOptional: false, description: "Final confirmation screen — user is fully onboarded.", requiredFlags: [], screenType: "success", icon: "🎉" },
  { id: "us_related_blocked_screen", label: "US-Related Blocked", category: "Terminal Screen", isTerminal: true, isBlocking: true, isMandatory: false, isOptional: false, description: "Shown when the user declares US residency, citizenship, or taxpayer status.", requiredFlags: [], screenType: "terminal_block", icon: "🚫" },
  { id: "geo_blocked_screen", label: "Geo Blocked", category: "Terminal Screen", isTerminal: true, isBlocking: true, isMandatory: false, isOptional: false, description: "Shown when the user's country is on the prohibited list.", requiredFlags: [], screenType: "terminal_block", icon: "🌐" },
  { id: "geo_waitlisted_screen", label: "Geo Waitlisted", category: "Terminal Screen", isTerminal: true, isBlocking: false, isMandatory: false, isOptional: false, description: "Shown when the user's country is on the waitlist.", requiredFlags: [], screenType: "terminal_wait", icon: "⏳" },
  { id: "underage_blocked_screen", label: "Underage Blocked", category: "Terminal Screen", isTerminal: true, isBlocking: true, isMandatory: false, isOptional: false, description: "Shown when the user declares age under 18.", requiredFlags: [], screenType: "terminal_block", icon: "🔞" },
  { id: "duplicate_account_screen", label: "Duplicate Account", category: "Terminal Screen", isTerminal: true, isBlocking: true, isMandatory: false, isOptional: false, description: "Shown when SEON detects an existing account on the same identity signals.", requiredFlags: [], screenType: "terminal_block", icon: "👥" },
  { id: "fraud_failed_screen", label: "Fraud Failed", category: "Terminal Screen", isTerminal: true, isBlocking: true, isMandatory: false, isOptional: false, description: "Shown when SEON fraud score exceeds the hard block threshold.", requiredFlags: [], screenType: "terminal_block", icon: "❌" },
  { id: "sanctions_blocked_screen", label: "Sanctions Hit", category: "Terminal Screen", isTerminal: true, isBlocking: true, isMandatory: false, isOptional: false, description: "Shown when the user's name/DOB matches a sanctions list entry.", requiredFlags: [], screenType: "terminal_block", icon: "⛔" },
  { id: "poi_review_pending", label: "POI Review Pending", category: "Terminal Screen", isTerminal: true, isBlocking: false, isMandatory: false, isOptional: false, description: "Shown when POI document is under manual review.", requiredFlags: [], screenType: "terminal_wait", icon: "🕐" },
  { id: "fraud_review_pending", label: "Fraud Review Pending", category: "Terminal Screen", isTerminal: true, isBlocking: false, isMandatory: false, isOptional: false, description: "Shown when SEON fraud score requires manual review.", requiredFlags: [], screenType: "terminal_wait", icon: "🔎" },
  { id: "aml_review_pending", label: "AML Review Pending", category: "Terminal Screen", isTerminal: true, isBlocking: false, isMandatory: false, isOptional: false, description: "Shown when AML questionnaire answers require manual compliance review.", requiredFlags: [], screenType: "terminal_wait", icon: "📌" },
];

const STEPS_KEY = "onboarding_steps_v2";
const FLOWS_KEY = "onboarding_flows_v2";

function loadSteps(): StepDef[] {
  if (typeof window === "undefined") return DEFAULT_STEPS;
  try { const raw = localStorage.getItem(STEPS_KEY); if (raw) return JSON.parse(raw); } catch {}
  return DEFAULT_STEPS;
}
function saveSteps(steps: StepDef[]) { try { localStorage.setItem(STEPS_KEY, JSON.stringify(steps)); } catch {} }
function genId(p: string) { return `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

// ─── FLOW BUILDER LOGIC ───────────────────────────────────────────────────────
function buildFlow(profile: UserProfile, flags: FeatureFlags, steps: StepDef[]): string[] {
  const has = (id: string) => steps.some(s => s.id === id);
  if (profile.isUSRelated) return ["kyc_l1_us_relation", "us_related_blocked_screen"].filter(has);
  if (profile.geoBlocked) return ["kyc_l1_geo", "geo_blocked_screen"].filter(has);
  if (profile.waitlisted) return ["kyc_l1_geo", "geo_waitlisted_screen"].filter(has);
  if (profile.age < 18) return ["kyc_l1_personal_data", "underage_blocked_screen"].filter(has);
  if (profile.kycL3UniquenessStatus === "duplicate") return ["kyc_l3_seon_uniqueness", "duplicate_account_screen"].filter(has);
  if (profile.kycL3FraudStatus === "failed") return ["kyc_l3_seon_fraud", "fraud_failed_screen"].filter(has);
  if (profile.kycL3SanctionsStatus === "hit") return ["kyc_l3_seon_sanctions", "sanctions_blocked_screen"].filter(has);
  if (profile.kycL2PoiStatus === "review") return ["kyc_l2_poi", "poi_review_pending"].filter(has);
  if (profile.kycL3FraudStatus === "review") return ["kyc_l3_seon_fraud", "fraud_review_pending"].filter(has);
  if (profile.amlStatus === "review") return ["aml_questionnaire", "aml_review_pending"].filter(has);

  const flow: string[] = [];
  if (flags.invite_mode) flow.push("invitation_");
  if (flags.mobile_verification_required) flow.push("mobile_verification");
  flow.push("kyc_l1_us_relation", "kyc_l1_geo", "kyc_l1_personal_data");
  if (flags.poi_enabled) flow.push("kyc_l2_poi");
  if (flags.seon_screening_enabled) flow.push("kyc_l3_seon_uniqueness", "kyc_l3_seon_fraud", "kyc_l3_seon_sanctions");
  flow.push("username_creation", "sca_pin_setup", "sca_device_binding");
  if (flags.biometrics_enabled && profile.deviceSupportsBiometrics) flow.push("biometric_enablement");
  flow.push("aml_questionnaire");
  if (flags.enhanced_aml_enabled && profile.riskLevel === "high") flow.push("enhanced_aml_questionnaire");
  flow.push("system_configuration", "wallet_ready");
  return flow.filter(has);
}

function defaultProfile(): UserProfile {
  return { country: "Germany", age: 25, isUSRelated: false, geoBlocked: false, waitlisted: false, kycL2PoiStatus: "not_started", kycL3UniquenessStatus: "not_started", kycL3FraudStatus: "not_started", kycL3SanctionsStatus: "not_started", riskLevel: "low", amlStatus: "not_started", deviceSupportsBiometrics: true };
}
function defaultFlags(): FeatureFlags {
  return { invite_mode: false, poi_enabled: true, seon_screening_enabled: true, biometrics_enabled: true, enhanced_aml_enabled: true, mobile_verification_required: true };
}

function seedFlows(steps: StepDef[]): NamedFlow[] {
  const standardProfile = defaultProfile();
  const standardFlags = defaultFlags();
  const inviteProfile = defaultProfile();
  const inviteFlags = { ...defaultFlags(), invite_mode: true };
  const highRiskProfile = { ...defaultProfile(), riskLevel: "high" as const };
  const highRiskFlags = { ...defaultFlags(), enhanced_aml_enabled: true };

  return [
    { id: genId("flow"), name: "Standard Flow", description: "Default onboarding for regular users — mobile verification, KYC L1-L3, SCA, AML.", flags: standardFlags, profile: standardProfile, stepIds: buildFlow(standardProfile, standardFlags, steps), updatedAt: new Date().toISOString() },
    { id: genId("flow"), name: "Invite-Only", description: "Closed beta — requires a valid invitation code before registration starts.", flags: inviteFlags, profile: inviteProfile, stepIds: buildFlow(inviteProfile, inviteFlags, steps), updatedAt: new Date().toISOString() },
    { id: genId("flow"), name: "High-Risk Enhanced", description: "Users flagged high-risk go through the enhanced AML questionnaire.", flags: highRiskFlags, profile: highRiskProfile, stepIds: buildFlow(highRiskProfile, highRiskFlags, steps), updatedAt: new Date().toISOString() },
  ];
}

function loadFlows(steps: StepDef[]): NamedFlow[] {
  if (typeof window === "undefined") return seedFlows(steps);
  try { const raw = localStorage.getItem(FLOWS_KEY); if (raw) return JSON.parse(raw); } catch {}
  const seeded = seedFlows(steps);
  try { localStorage.setItem(FLOWS_KEY, JSON.stringify(seeded)); } catch {}
  return seeded;
}
function saveFlows(flows: NamedFlow[]) { try { localStorage.setItem(FLOWS_KEY, JSON.stringify(flows)); } catch {} }

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
            <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }} className="w-full text-left px-3 py-2 text-red-400 hover:text-red-300 hover:bg-zinc-800 text-xs cursor-pointer">Sign out</button>
          </div>
        )}
      </div>
    </nav>
  );
}

function Field({ label, value, onChange, type = "text", className = "" }: { label: string; value: string; onChange: (v: string) => void; type?: string; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-[10px] text-zinc-500 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500" />
    </div>
  );
}
function SelectField({ label, value, onChange, options, className = "" }: { label: string; value: string; onChange: (v: string) => void; options: string[]; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-[10px] text-zinc-500 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ─── STEP REGISTRY TAB ────────────────────────────────────────────────────────
const SCREEN_TYPES = ["invite_code", "mobile_otp", "us_relation", "geo_select", "personal_data", "poi_upload", "processing", "username", "pin_setup", "device_binding", "biometric", "aml_form", "enhanced_aml_form", "system_progress", "success", "terminal_block", "terminal_wait"];
const CATEGORIES = ["Pre-KYC", "Identity", "KYC L1", "KYC L2", "KYC L3 (SEON)", "Account Setup", "SCA", "Compliance", "System", "Terminal Screen"];

function emptyStep(): StepDef {
  return { id: "", label: "", category: "Account Setup", isTerminal: false, isBlocking: false, isMandatory: true, isOptional: false, description: "", requiredFlags: [], screenType: "username", icon: "⚙️" };
}

function StepEditorModal({ initial, onClose, onSave, isNew }: { initial: StepDef; onClose: () => void; onSave: (s: StepDef) => void; isNew: boolean }) {
  const [form, setForm] = useState<StepDef>({ ...initial });
  const set = (k: keyof StepDef, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-white font-bold">{isNew ? "Add Step" : "Edit Step"}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Step ID" value={form.id} onChange={v => set("id", v.replace(/\s+/g, "_"))} className={isNew ? "" : "opacity-60 pointer-events-none"} />
          <Field label="Icon (emoji)" value={form.icon} onChange={v => set("icon", v)} />
          <Field label="Label" value={form.label} onChange={v => set("label", v)} className="col-span-2" />
          <SelectField label="Category" value={form.category} onChange={v => set("category", v)} options={CATEGORIES} />
          <SelectField label="Screen Type" value={form.screenType} onChange={v => set("screenType", v)} options={SCREEN_TYPES} />
          <Field label="Description" value={form.description} onChange={v => set("description", v)} className="col-span-2" />
          <Field label="Required Flags (comma-separated)" value={form.requiredFlags.join(", ")} onChange={v => set("requiredFlags", v.split(",").map(s => s.trim()).filter(Boolean))} className="col-span-2" />
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          {(["isTerminal", "isBlocking", "isMandatory", "isOptional"] as const).map(k => (
            <label key={k} className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer bg-zinc-800 rounded-lg px-3 py-2">
              <input type="checkbox" checked={form[k]} onChange={e => set(k, e.target.checked)} className="accent-indigo-500" />
              {k === "isTerminal" ? "Terminal screen" : k === "isBlocking" ? "Blocking" : k === "isMandatory" ? "Mandatory" : "Optional"}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-sm cursor-pointer">Cancel</button>
          <button onClick={() => form.id && form.label && onSave(form)} disabled={!form.id || !form.label} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm px-4 py-2 rounded-lg cursor-pointer">Save Step</button>
        </div>
      </div>
    </div>
  );
}

function StepRegistryTab({ steps, setSteps }: { steps: StepDef[]; setSteps: (s: StepDef[]) => void }) {
  const [filter, setFilter] = useState("All");
  const [editing, setEditing] = useState<StepDef | null>(null);
  const [isNew, setIsNew] = useState(false);

  const categories = ["All", ...Array.from(new Set(steps.map(s => s.category)))];
  const filtered = steps.filter(s => filter === "All" || s.category === filter);

  const persist = (ns: StepDef[]) => { setSteps(ns); saveSteps(ns); };

  const move = (id: string, dir: -1 | 1) => {
    const idx = steps.findIndex(s => s.id === id);
    const swap = idx + dir;
    if (swap < 0 || swap >= steps.length) return;
    const ns = [...steps];
    [ns[idx], ns[swap]] = [ns[swap], ns[idx]];
    persist(ns);
  };

  const remove = (id: string) => {
    if (!confirm("Delete this step? It will be removed from any flow that references it.")) return;
    persist(steps.filter(s => s.id !== id));
  };

  const saveStep = (s: StepDef) => {
    if (isNew) persist([...steps, s]);
    else persist(steps.map(x => x.id === s.id ? s : x));
    setEditing(null);
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {categories.map(c => (
            <button key={c} onClick={() => setFilter(c)} className={`px-3 py-1 rounded-full text-xs cursor-pointer transition-colors ${filter === c ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}>{c}</button>
          ))}
        </div>
        <button onClick={() => { setEditing(emptyStep()); setIsNew(true); }} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-2 rounded-lg cursor-pointer"><Plus className="w-3.5 h-3.5" /> Add Step</button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-zinc-800 bg-zinc-900/50">{["Order", "Step", "Category", "Terminal", "Mandatory", "Optional", "Actions"].map(h => <th key={h} className="text-left px-4 py-2.5 text-zinc-500 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={s.id} className="border-b border-zinc-800/40 hover:bg-zinc-900/40">
                <td className="px-4 py-2.5">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => move(s.id, -1)} className="text-zinc-500 hover:text-white cursor-pointer"><ChevronUp className="w-3 h-3" /></button>
                    <button onClick={() => move(s.id, 1)} className="text-zinc-500 hover:text-white cursor-pointer"><ChevronDown className="w-3 h-3" /></button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-white font-medium">{s.icon} {s.label}</div>
                  <div className="text-zinc-500 font-mono text-[10px]">{s.id}</div>
                </td>
                <td className="px-4 py-3"><Badge className="text-[10px] border border-zinc-700 text-zinc-400">{s.category}</Badge></td>
                <td className="px-4 py-3">{s.isTerminal ? <span className="text-orange-400">■</span> : <span className="text-zinc-700">—</span>}</td>
                <td className="px-4 py-3">{s.isMandatory ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <span className="text-zinc-700">—</span>}</td>
                <td className="px-4 py-3">{s.isOptional ? <CheckCircle className="w-3.5 h-3.5 text-indigo-400" /> : <span className="text-zinc-700">—</span>}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditing(s); setIsNew(false); }} className="text-zinc-500 hover:text-indigo-400 cursor-pointer p-1"><Edit className="w-3.5 h-3.5" /></button>
                    <button onClick={() => remove(s.id)} className="text-zinc-500 hover:text-red-400 cursor-pointer p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-zinc-600 text-[10px] mt-2">{steps.length} total steps · {steps.filter(s => s.isTerminal).length} terminal screens</p>
      {editing && <StepEditorModal initial={editing} isNew={isNew} onClose={() => setEditing(null)} onSave={saveStep} />}
    </div>
  );
}

// ─── FLOW BUILDER TAB ─────────────────────────────────────────────────────────
const ALL_COUNTRIES = ["Germany", "France", "United Kingdom", "Netherlands", "Ireland", "Sweden", "Denmark", "Finland", "Austria", "Belgium", "Switzerland", "Poland", "Spain", "Portugal", "Italy", "United States", "Canada", "Australia", "Brazil", "India", "China", "Thailand", "Vietnam", "Ukraine", "Serbia", "Colombia", "Peru", "Tunisia", "Morocco", "Jordan", "United Arab Emirates", "Nigeria", "Pakistan", "Bangladesh", "Ethiopia", "Algeria", "Egypt", "Kenya", "Tanzania", "Ghana", "Cameroon"];

function FlowEditor({ flow, steps, onSave, onRun }: { flow: NamedFlow; steps: StepDef[]; onSave: (f: NamedFlow) => void; onRun: (id: string) => void }) {
  const [draft, setDraft] = useState<NamedFlow>(flow);
  const stepMap = Object.fromEntries(steps.map(s => [s.id, s]));
  const computedSteps = buildFlow(draft.profile, draft.flags, steps);

  const setP = (k: keyof UserProfile, v: any) => setDraft(d => ({ ...d, profile: { ...d.profile, [k]: v } }));
  const setF = (k: keyof FeatureFlags, v: boolean) => setDraft(d => ({ ...d, flags: { ...d.flags, [k]: v } }));
  const save = () => onSave({ ...draft, stepIds: computedSteps, updatedAt: new Date().toISOString() });

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Flow Name" value={draft.name} onChange={v => setDraft(d => ({ ...d, name: v }))} />
        <Field label="Description" value={draft.description} onChange={v => setDraft(d => ({ ...d, description: v }))} />
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-3">
          <p className="text-zinc-400 text-xs font-semibold">Simulated User Profile</p>
          <div className="grid grid-cols-2 gap-2 bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <SelectField label="Country" value={draft.profile.country} onChange={v => setP("country", v)} options={ALL_COUNTRIES} />
            <Field label="Age" type="number" value={String(draft.profile.age)} onChange={v => setP("age", Number(v) || 0)} />
            <SelectField label="Risk Level" value={draft.profile.riskLevel} onChange={v => setP("riskLevel", v)} options={["low", "medium", "high"]} />
            <SelectField label="POI Status" value={draft.profile.kycL2PoiStatus} onChange={v => setP("kycL2PoiStatus", v)} options={["not_started", "passed", "rejected", "review", "duplicate"]} />
            <SelectField label="Uniqueness Status" value={draft.profile.kycL3UniquenessStatus} onChange={v => setP("kycL3UniquenessStatus", v)} options={["not_started", "passed", "duplicate"]} />
            <SelectField label="Fraud Status" value={draft.profile.kycL3FraudStatus} onChange={v => setP("kycL3FraudStatus", v)} options={["not_started", "passed", "review", "failed"]} />
            <SelectField label="Sanctions Status" value={draft.profile.kycL3SanctionsStatus} onChange={v => setP("kycL3SanctionsStatus", v)} options={["not_started", "passed", "hit"]} />
            <SelectField label="AML Status" value={draft.profile.amlStatus} onChange={v => setP("amlStatus", v)} options={["not_started", "passed", "review", "rejected"]} />
            {([["isUSRelated", "US Related"], ["geoBlocked", "Geo Blocked"], ["waitlisted", "Waitlisted"], ["deviceSupportsBiometrics", "Biometric Device"]] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-1.5 text-[11px] text-zinc-300 cursor-pointer col-span-1">
                <input type="checkbox" checked={draft.profile[k] as boolean} onChange={e => setP(k, e.target.checked)} className="accent-indigo-500" />{l}
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-zinc-400 text-xs font-semibold">Feature Flags</p>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-1.5">
            {(Object.keys(draft.flags) as (keyof FeatureFlags)[]).map(k => (
              <label key={k} className="flex items-center gap-2 cursor-pointer text-zinc-300 text-[11px]">
                <input type="checkbox" checked={draft.flags[k]} onChange={e => setF(k, e.target.checked)} className="accent-indigo-500" />
                <span className="font-mono">{k}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-zinc-400 text-xs font-semibold">Computed Steps</p>
          <Badge className="text-[10px] border border-zinc-700 text-zinc-400">{computedSteps.length} steps</Badge>
        </div>
        <div className="space-y-1.5">
          {computedSteps.map((id, idx) => {
            const s = stepMap[id];
            if (!s) return null;
            return (
              <div key={id} className={`flex items-center gap-3 rounded-lg px-3 py-2 border text-xs ${s.isTerminal ? (s.isBlocking ? "border-red-500/30 bg-red-500/5" : "border-orange-500/30 bg-orange-500/5") : "border-zinc-800 bg-zinc-900"}`}>
                <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-400 shrink-0">{idx + 1}</div>
                <span>{s.icon}</span>
                <span className="text-white">{s.label}</span>
                {s.isOptional && <Badge className="text-[9px] border border-indigo-500/30 text-indigo-400">optional</Badge>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={save} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg cursor-pointer">Save Flow</button>
        <button onClick={() => { save(); onRun(draft.id); }} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2 rounded-lg cursor-pointer"><Play className="w-3.5 h-3.5" /> Save & Run Walkthrough</button>
      </div>
    </div>
  );
}

function FlowBuilderTab({ steps, flows, setFlows, onRunWalkthrough }: { steps: StepDef[]; flows: NamedFlow[]; setFlows: (f: NamedFlow[]) => void; onRunWalkthrough: (flowId: string) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(flows[0]?.id ?? null);
  const selectedFlow = flows.find(f => f.id === selectedId) ?? null;

  const newFlow = () => {
    const nf: NamedFlow = { id: genId("flow"), name: "New Flow", description: "", flags: defaultFlags(), profile: defaultProfile(), stepIds: [], updatedAt: new Date().toISOString() };
    const list = [...flows, nf];
    setFlows(list); saveFlows(list); setSelectedId(nf.id);
  };
  const deleteFlow = (id: string) => {
    if (!confirm("Delete this flow?")) return;
    const list = flows.filter(f => f.id !== id);
    setFlows(list); saveFlows(list);
    if (selectedId === id) setSelectedId(list[0]?.id ?? null);
  };
  const saveDraft = (updated: NamedFlow) => {
    const list = flows.map(f => f.id === updated.id ? updated : f);
    setFlows(list); saveFlows(list);
  };

  return (
    <div className="flex h-[calc(100vh-180px)]">
      <div className="w-64 border-r border-zinc-800 overflow-auto p-3 flex-shrink-0 space-y-1.5">
        <button onClick={newFlow} className="w-full flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-2 rounded-lg cursor-pointer mb-2"><Plus className="w-3.5 h-3.5" /> New Flow</button>
        {flows.map(f => (
          <div key={f.id} onClick={() => setSelectedId(f.id)} className={`rounded-lg px-3 py-2.5 cursor-pointer border transition-colors group ${selectedId === f.id ? "border-indigo-500 bg-indigo-500/10" : "border-zinc-800 hover:border-zinc-700"}`}>
            <div className="flex items-center justify-between">
              <p className="text-white text-xs font-medium truncate">{f.name}</p>
              <button onClick={e => { e.stopPropagation(); deleteFlow(f.id); }} className="text-zinc-600 hover:text-red-400 cursor-pointer opacity-0 group-hover:opacity-100"><Trash2 className="w-3 h-3" /></button>
            </div>
            <p className="text-zinc-500 text-[10px] mt-0.5">{f.stepIds.length} steps</p>
          </div>
        ))}
      </div>
      {selectedFlow ? (
        <FlowEditor key={selectedFlow.id} flow={selectedFlow} steps={steps} onSave={saveDraft} onRun={onRunWalkthrough} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">Select or create a flow</div>
      )}
    </div>
  );
}

// ─── WALKTHROUGH — realistic step screens ────────────────────────────────────
function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-80 h-[600px] rounded-[2.5rem] border-4 border-zinc-700 bg-black p-2 shadow-2xl shrink-0">
      <div className="w-full h-full rounded-[2rem] bg-zinc-950 overflow-hidden flex flex-col relative">
        <div className="h-6 flex items-center justify-between px-5 text-[9px] text-zinc-400 shrink-0">
          <span>9:41</span>
          <span className="flex items-center gap-1"><Smartphone className="w-2.5 h-2.5" /><span>5G</span></span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">{children}</div>
      </div>
    </div>
  );
}

function OtpBoxes({ onComplete }: { onComplete: () => void }) {
  const [vals, setVals] = useState(["", "", "", "", "", ""]);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const setDigit = (i: number, v: string) => {
    if (!/^[0-9]?$/.test(v)) return;
    const nv = [...vals]; nv[i] = v; setVals(nv);
    if (v && i < 5) refs.current[i + 1]?.focus();
    if (nv.every(d => d) && nv.join("").length === 6) setTimeout(onComplete, 400);
  };
  return (
    <div className="flex gap-1.5 justify-center">
      {vals.map((v, i) => (
        <input key={i} ref={el => { refs.current[i] = el; }} value={v} onChange={e => setDigit(i, e.target.value)} maxLength={1}
          className="w-9 h-11 text-center bg-zinc-800 border border-zinc-700 rounded-lg text-white text-lg font-mono focus:outline-none focus:border-indigo-500" />
      ))}
    </div>
  );
}

function PinPad({ onDone }: { onDone: (pin: string) => void }) {
  const [pin, setPin] = useState("");
  const press = (d: string) => {
    if (d === "back") { setPin(p => p.slice(0, -1)); return; }
    if (pin.length >= 6) return;
    const np = pin + d;
    setPin(np);
    if (np.length === 6) setTimeout(() => onDone(np), 300);
  };
  return (
    <div className="space-y-4">
      <div className="flex gap-2 justify-center">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`w-3 h-3 rounded-full ${i < pin.length ? "bg-indigo-400" : "bg-zinc-700"}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto">
        {["1","2","3","4","5","6","7","8","9","","0","back"].map((d, i) => d === "" ? <div key={i} /> : (
          <button key={i} onClick={() => press(d)} className="h-11 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium cursor-pointer flex items-center justify-center">
            {d === "back" ? "⌫" : d}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProcessingScreen({ label, onComplete }: { label: string; onComplete: () => void }) {
  useEffect(() => { const t = setTimeout(onComplete, 1500); return () => clearTimeout(t); }, [onComplete]);
  return (
    <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-10">
      <div className="w-10 h-10 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      <p className="text-zinc-300 text-xs">{label}</p>
    </div>
  );
}

function DeviceBindingScreen({ onComplete }: { onComplete: () => void }) {
  useEffect(() => { const t = setTimeout(onComplete, 1800); return () => clearTimeout(t); }, [onComplete]);
  return (
    <div className="space-y-3 pt-10 text-center">
      <ShieldCheck className="w-10 h-10 text-indigo-400 mx-auto" />
      <p className="text-white text-sm font-semibold">Binding This Device</p>
      <div className="space-y-1.5 text-left text-[11px] text-zinc-400 max-w-[220px] mx-auto">
        <p>✓ Generating device key pair</p>
        <p>✓ Registering device fingerprint</p>
        <p className="text-zinc-600">… finalizing secure binding</p>
      </div>
    </div>
  );
}

const SYSTEM_PROGRESS_STAGES = ["Creating wallet", "Setting default limits", "Configuring notifications", "Finalizing account"];

function SystemProgressScreen({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (phase >= SYSTEM_PROGRESS_STAGES.length) { const t = setTimeout(onComplete, 400); return () => clearTimeout(t); }
    const t = setTimeout(() => setPhase(p => p + 1), 600);
    return () => clearTimeout(t);
  }, [phase, onComplete]);
  return (
    <div className="space-y-2 pt-10">
      {SYSTEM_PROGRESS_STAGES.map((s, i) => (
        <div key={s} className="flex items-center gap-2 text-xs">
          {i < phase ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : i === phase ? <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /> : <div className="w-3.5 h-3.5 rounded-full border border-zinc-700" />}
          <span className={i <= phase ? "text-zinc-300" : "text-zinc-600"}>{s}</span>
        </div>
      ))}
    </div>
  );
}

function SuccessScreen({ onComplete }: { onComplete: () => void }) {
  const [accountNumber] = useState(() => `UTH-${Math.floor(Math.random() * 900000 + 100000)}`);
  return (
    <div className="space-y-3 pt-10 text-center">
      <div className="text-5xl">🎉</div>
      <p className="text-white text-base font-bold">Wallet Ready!</p>
      <p className="text-zinc-500 text-[11px] px-4">Your account is fully set up and ready to use.</p>
      <div className="bg-zinc-800 rounded-xl p-3 mx-4 text-left space-y-1">
        <div className="flex justify-between text-[10px]"><span className="text-zinc-500">Account number</span><span className="text-white font-mono">{accountNumber}</span></div>
        <div className="flex justify-between text-[10px]"><span className="text-zinc-500">Balance</span><span className="text-white font-mono">€0.00</span></div>
      </div>
      <button onClick={onComplete} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-6 py-2.5 rounded-xl cursor-pointer mx-4">Enter App</button>
    </div>
  );
}

function StepScreen({ step, onComplete }: { step: StepDef; onComplete: () => void }) {
  const [phase, setPhase] = useState(0);
  const [form, setForm] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  switch (step.screenType) {
    case "invite_code": {
      const [code, setCode] = [form.code ?? "", (v: string) => set("code", v.toUpperCase())];
      return (
        <div className="space-y-4 pt-6">
          <p className="text-white text-sm font-semibold text-center">Enter Invitation Code</p>
          <p className="text-zinc-500 text-[11px] text-center">This is a closed beta — you need a valid code to register.</p>
          <input value={code} onChange={e => setCode(e.target.value)} maxLength={6} placeholder="ABC123"
            className="w-full text-center text-xl font-mono tracking-[0.3em] bg-zinc-800 border border-zinc-700 rounded-xl py-3 text-white focus:outline-none focus:border-indigo-500" />
          <button disabled={code.length < 6} onClick={onComplete} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white text-sm py-2.5 rounded-xl cursor-pointer">Continue</button>
        </div>
      );
    }
    case "mobile_otp":
      return phase === 0 ? (
        <div className="space-y-4 pt-6">
          <p className="text-white text-sm font-semibold text-center">Verify Your Phone</p>
          <input value={form.phone ?? ""} onChange={e => set("phone", e.target.value)} placeholder="+1 555 000 0000"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-3 text-white text-sm focus:outline-none focus:border-indigo-500" />
          <button onClick={() => setPhase(1)} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm py-2.5 rounded-xl cursor-pointer">Send Code</button>
        </div>
      ) : (
        <div className="space-y-4 pt-6">
          <p className="text-white text-sm font-semibold text-center">Enter the 6-digit code</p>
          <p className="text-zinc-500 text-[11px] text-center">Sent to {form.phone || "your phone"}</p>
          <OtpBoxes onComplete={onComplete} />
        </div>
      );
    case "us_relation":
      return (
        <div className="space-y-3 pt-6">
          <p className="text-white text-sm font-semibold text-center">US Person Status</p>
          <p className="text-zinc-500 text-[11px] text-center">Required for FATCA compliance.</p>
          <div className="space-y-2">
            {["I am not a US citizen, resident, or taxpayer", "I am a US citizen", "I hold a US Green Card", "I am a US taxpayer (other)"].map(o => (
              <label key={o} className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2.5 text-xs text-zinc-300 cursor-pointer">
                <input type="radio" name="usrel" onChange={() => set("answer", o)} className="accent-indigo-500" />{o}
              </label>
            ))}
          </div>
          <button disabled={!form.answer} onClick={onComplete} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white text-sm py-2.5 rounded-xl cursor-pointer">Continue</button>
        </div>
      );
    case "geo_select":
      return (
        <div className="space-y-3 pt-6">
          <p className="text-white text-sm font-semibold text-center">Country of Residence</p>
          <select value={form.country ?? ""} onChange={e => set("country", e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-3 text-white text-sm">
            <option value="">— select country —</option>
            {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button disabled={!form.country} onClick={onComplete} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white text-sm py-2.5 rounded-xl cursor-pointer">Continue</button>
        </div>
      );
    case "personal_data":
      return (
        <div className="space-y-2.5 pt-6">
          <p className="text-white text-sm font-semibold text-center mb-2">Personal Details</p>
          {[["firstName", "First Name"], ["lastName", "Last Name"], ["dob", "Date of Birth"], ["nationality", "Nationality"]].map(([k, l]) => (
            <input key={k} type={k === "dob" ? "date" : "text"} value={form[k] ?? ""} onChange={e => set(k, e.target.value)} placeholder={l}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-indigo-500" />
          ))}
          <button onClick={onComplete} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm py-2.5 rounded-xl cursor-pointer mt-2">Continue</button>
        </div>
      );
    case "poi_upload":
      return phase === 0 ? (
        <div className="space-y-3 pt-6">
          <p className="text-white text-sm font-semibold text-center">Proof of Identity</p>
          <div className="grid grid-cols-1 gap-2">
            {["Passport", "National ID", "Driving Licence"].map(d => (
              <button key={d} onClick={() => setPhase(1)} className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl px-4 py-3 text-left text-xs text-zinc-200 cursor-pointer">{d}</button>
            ))}
          </div>
        </div>
      ) : <ProcessingScreen label="Uploading and scanning document…" onComplete={onComplete} />;
    case "processing":
      return <ProcessingScreen label={`Running ${step.label}…`} onComplete={onComplete} />;
    case "username":
      return (
        <div className="space-y-3 pt-6">
          <p className="text-white text-sm font-semibold text-center">Choose a Username</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">@</span>
            <input value={form.username ?? ""} onChange={e => set("username", e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 pl-7 pr-3 text-white text-sm focus:outline-none focus:border-indigo-500" />
          </div>
          {form.username && <p className="text-green-400 text-[10px] text-center">✓ Username available</p>}
          <button disabled={!form.username} onClick={onComplete} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white text-sm py-2.5 rounded-xl cursor-pointer">Continue</button>
        </div>
      );
    case "pin_setup":
      return phase === 0 ? (
        <div className="space-y-4 pt-4">
          <p className="text-white text-sm font-semibold text-center">Set Your PIN</p>
          <PinPad onDone={pin => { set("pin", pin); setPhase(1); }} />
        </div>
      ) : (
        <div className="space-y-4 pt-4">
          <p className="text-white text-sm font-semibold text-center">Confirm Your PIN</p>
          <PinPad onDone={onComplete} />
        </div>
      );
    case "device_binding":
      return <DeviceBindingScreen onComplete={onComplete} />;
    case "biometric":
      return (
        <div className="space-y-4 pt-10 text-center">
          <Fingerprint className="w-12 h-12 text-indigo-400 mx-auto" />
          <p className="text-white text-sm font-semibold">Enable Face ID / Touch ID</p>
          <p className="text-zinc-500 text-[11px] px-4">Use biometrics to log in faster next time.</p>
          <div className="flex flex-col gap-2 px-4">
            <button onClick={onComplete} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm py-2.5 rounded-xl cursor-pointer">Enable</button>
            <button onClick={onComplete} className="text-zinc-400 hover:text-white text-xs py-1 cursor-pointer">Skip for now</button>
          </div>
        </div>
      );
    case "aml_form":
      return (
        <div className="space-y-2.5 pt-4">
          <p className="text-white text-sm font-semibold text-center mb-1">AML Questionnaire</p>
          <input value={form.occupation ?? ""} onChange={e => set("occupation", e.target.value)} placeholder="Occupation" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2 px-3 text-white text-xs" />
          <select value={form.sourceOfFunds ?? ""} onChange={e => set("sourceOfFunds", e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2 px-3 text-white text-xs">
            <option value="">Source of funds</option>
            <option>Salary</option><option>Business income</option><option>Investments</option><option>Savings</option>
          </select>
          <select value={form.volume ?? ""} onChange={e => set("volume", e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2 px-3 text-white text-xs">
            <option value="">Expected monthly volume</option>
            <option>&lt; €1,000</option><option>€1,000 – €10,000</option><option>&gt; €10,000</option>
          </select>
          <div className="flex items-center gap-2 text-[11px] text-zinc-300 pt-1">
            <span>Are you a PEP?</span>
            <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="pep" onChange={() => set("pep", "no")} className="accent-indigo-500" />No</label>
            <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="pep" onChange={() => set("pep", "yes")} className="accent-indigo-500" />Yes</label>
          </div>
          <button onClick={onComplete} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm py-2.5 rounded-xl cursor-pointer mt-2">Submit</button>
        </div>
      );
    case "enhanced_aml_form":
      return (
        <div className="space-y-2.5 pt-4">
          <p className="text-white text-sm font-semibold text-center mb-1">Enhanced AML Questionnaire</p>
          <input value={form.purpose ?? ""} onChange={e => set("purpose", e.target.value)} placeholder="Purpose of account" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2 px-3 text-white text-xs" />
          <input value={form.txTypes ?? ""} onChange={e => set("txTypes", e.target.value)} placeholder="Expected transaction types" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2 px-3 text-white text-xs" />
          <select value={form.thirdParty ?? ""} onChange={e => set("thirdParty", e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2 px-3 text-white text-xs">
            <option value="">Acting on behalf of a third party?</option>
            <option>No</option><option>Yes</option>
          </select>
          <textarea value={form.desc ?? ""} onChange={e => set("desc", e.target.value)} placeholder="Additional description" rows={2} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2 px-3 text-white text-xs resize-none" />
          <label className="flex items-center gap-2 text-[11px] text-zinc-300 pt-1">
            <input type="checkbox" className="accent-indigo-500" />I declare the above information is accurate
          </label>
          <button onClick={onComplete} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm py-2.5 rounded-xl cursor-pointer mt-2">Submit</button>
        </div>
      );
    case "system_progress":
      return <SystemProgressScreen onComplete={onComplete} />;
    case "success":
      return <SuccessScreen onComplete={onComplete} />;
    case "terminal_block":
      return (
        <div className="space-y-3 pt-10 text-center">
          <div className="text-5xl">{step.icon}</div>
          <p className="text-red-400 text-sm font-bold">{step.label}</p>
          <p className="text-zinc-500 text-[11px] px-4">{step.description}</p>
          <p className="text-red-400/70 text-[10px] px-4">Registration cannot proceed.</p>
        </div>
      );
    case "terminal_wait":
      return (
        <div className="space-y-3 pt-10 text-center">
          <div className="text-5xl">{step.icon}</div>
          <p className="text-orange-400 text-sm font-bold">{step.label}</p>
          <p className="text-zinc-500 text-[11px] px-4">{step.description}</p>
          <button onClick={onComplete} className="bg-orange-600 hover:bg-orange-500 text-white text-xs px-4 py-2 rounded-lg cursor-pointer">Acknowledge</button>
        </div>
      );
    default:
      return (
        <div className="space-y-3 pt-10 text-center">
          <p className="text-white text-sm font-semibold">{step.label}</p>
          <button onClick={onComplete} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg cursor-pointer">Continue</button>
        </div>
      );
  }
}

function WalkthroughRunner({ flow, flows, steps, setSelectedFlowId }: { flow: NamedFlow; flows: NamedFlow[]; steps: StepDef[]; setSelectedFlowId: (id: string) => void }) {
  const stepMap = Object.fromEntries(steps.map(s => [s.id, s]));
  const [idx, setIdx] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  const stepIds = flow.stepIds;
  const isFinished = idx >= stepIds.length;
  const currentStep = !isFinished ? stepMap[stepIds[idx]] : null;

  const handleComplete = () => {
    if (!currentStep) return;
    setLog(l => [...l, `[${new Date().toTimeString().slice(0, 8)}] ✓ ${currentStep.label}`]);
    setIdx(i => i + 1);
  };
  const reset = () => { setIdx(0); setLog([]); };

  return (
    <div className="flex h-[calc(100vh-180px)]">
      <div className="w-64 border-r border-zinc-800 overflow-auto p-4 flex-shrink-0 space-y-3">
        <div>
          <label className="block text-[10px] text-zinc-500 mb-1">Select Flow</label>
          <select value={flow.id} onChange={e => setSelectedFlowId(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white">
            {flows.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <p className="text-zinc-500 text-[10px]">{flow.description}</p>
        <div className="flex items-center justify-between">
          <p className="text-zinc-400 text-xs font-semibold">Progress</p>
          <button onClick={reset} className="text-zinc-500 hover:text-white cursor-pointer"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
        <div className="space-y-1">
          {stepIds.map((id, i) => {
            const s = stepMap[id];
            return (
              <div key={id} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-[11px] ${i === idx ? "bg-indigo-500/10 border border-indigo-500/30" : ""}`}>
                {i < idx ? <CheckCircle className="w-3 h-3 text-green-400 shrink-0" /> : i === idx ? <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse shrink-0" /> : <div className="w-2 h-2 rounded-full border border-zinc-700 shrink-0" />}
                <span className={i < idx ? "text-green-400" : i === idx ? "text-white" : "text-zinc-600"}>{s?.label}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6 flex items-center justify-center">
        <PhoneShell>
          {isFinished ? (
            <div className="space-y-3 pt-10 text-center">
              <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
              <p className="text-white text-sm font-semibold">Walkthrough complete</p>
              <button onClick={reset} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-lg cursor-pointer">Restart</button>
            </div>
          ) : currentStep ? (
            <StepScreen key={currentStep.id + idx} step={currentStep} onComplete={handleComplete} />
          ) : null}
        </PhoneShell>
      </div>
      <div className="w-56 border-l border-zinc-800 overflow-auto p-4 flex-shrink-0">
        <p className="text-zinc-400 text-xs font-semibold mb-2">Event Log</p>
        <div className="space-y-1 font-mono text-[10px] text-zinc-500">
          {log.map((l, i) => <div key={i}>{l}</div>)}
          {log.length === 0 && <p className="text-zinc-700">No events yet</p>}
        </div>
      </div>
    </div>
  );
}

function WalkthroughTab({ steps, flows, selectedFlowId, setSelectedFlowId }: { steps: StepDef[]; flows: NamedFlow[]; selectedFlowId: string | null; setSelectedFlowId: (id: string) => void }) {
  const flow = flows.find(f => f.id === selectedFlowId) ?? flows[0];
  if (!flow) return <div className="p-10 text-center text-zinc-500 text-sm">No flow available. Create one in Flow Builder.</div>;
  return <WalkthroughRunner key={flow.id} flow={flow} flows={flows} steps={steps} setSelectedFlowId={setSelectedFlowId} />;
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<"registry" | "builder" | "walkthrough">("builder");
  const [steps, setSteps] = useState<StepDef[]>(() => loadSteps());
  const [flows, setFlows] = useState<NamedFlow[]>(() => loadFlows(loadSteps()));
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(() => loadFlows(loadSteps())[0]?.id ?? null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(async r => {
      if (r.status === 401) { router.push("/login"); return; }
      const d = await r.json();
      setUser(d.user);
      setReady(true);
    });
  }, [router]);

  if (!ready) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <DashNav user={user} />
      <div className="border-b border-zinc-800 px-6 py-4 flex items-center gap-4 flex-wrap">
        <Workflow className="w-5 h-5 text-indigo-400" />
        <div>
          <h1 className="text-base font-bold text-white">Onboarding Flow Engine</h1>
          <p className="text-zinc-500 text-xs">Step registry, flow builder, and full walkthrough simulation</p>
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-green-400" />{steps.filter(s => !s.isTerminal).length} steps</span>
          <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-orange-400" />{steps.filter(s => s.isTerminal).length} terminal screens</span>
          <span className="flex items-center gap-1"><Workflow className="w-3.5 h-3.5 text-indigo-400" />{flows.length} flows</span>
        </div>
      </div>
      <div className="border-b border-zinc-800 px-6 flex gap-1">
        {([["builder", "Flow Builder"], ["registry", "Step Registry"], ["walkthrough", "Walkthrough"]] as const).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2.5 text-xs border-b-2 -mb-px cursor-pointer transition-colors ${tab === t ? "border-indigo-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>{l}</button>
        ))}
      </div>
      {tab === "registry" && <StepRegistryTab steps={steps} setSteps={setSteps} />}
      {tab === "builder" && <FlowBuilderTab steps={steps} flows={flows} setFlows={setFlows} onRunWalkthrough={id => { setSelectedFlowId(id); setTab("walkthrough"); }} />}
      {tab === "walkthrough" && <WalkthroughTab steps={steps} flows={flows} selectedFlowId={selectedFlowId} setSelectedFlowId={setSelectedFlowId} />}
    </div>
  );
}
