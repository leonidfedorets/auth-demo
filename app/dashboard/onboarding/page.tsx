"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Workflow, CheckCircle, Play,
  RefreshCw, ChevronUp, ChevronDown, AlertTriangle,
  Plus, Trash2, Edit, X, Smartphone, ShieldCheck, Fingerprint,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DashNav } from "@/components/dash-nav";

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

type DeviceTarget = "web" | "mobile" | "tablet";

interface FlowBranch {
  id: string;
  label: string;
  next: string | null;
}

type FlowNode =
  | { id: string; kind: "step"; stepId: string; next: string | null }
  | { id: string; kind: "gateway"; question: string; branches: FlowBranch[] };

interface NamedFlow {
  id: string;
  name: string;
  description: string;
  device: DeviceTarget;
  nodes: Record<string, FlowNode>;
  startNodeId: string | null;
  updatedAt: string;
}

// A "slot" identifies where in the graph a new node should be attached —
// either the flow's start, the `next` pointer of a step node, or a gateway branch's `next`.
type FlowSlot =
  | { type: "start" }
  | { type: "next"; nodeId: string }
  | { type: "branch"; gatewayId: string; branchId: string };

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

const ALL_COUNTRIES = ["Germany", "France", "United Kingdom", "Netherlands", "Ireland", "Sweden", "Denmark", "Finland", "Austria", "Belgium", "Switzerland", "Poland", "Spain", "Portugal", "Italy", "United States", "Canada", "Australia", "Brazil", "India", "China", "Thailand", "Vietnam", "Ukraine", "Serbia", "Colombia", "Peru", "Tunisia", "Morocco", "Jordan", "United Arab Emirates", "Nigeria", "Pakistan", "Bangladesh", "Ethiopia", "Algeria", "Egypt", "Kenya", "Tanzania", "Ghana", "Cameroon"];

const STEPS_KEY = "onboarding_steps_v2";
const FLOWS_KEY = "onboarding_flows_v3";

function loadSteps(): StepDef[] {
  if (typeof window === "undefined") return DEFAULT_STEPS;
  try { const raw = localStorage.getItem(STEPS_KEY); if (raw) return JSON.parse(raw); } catch {}
  return DEFAULT_STEPS;
}
function saveSteps(steps: StepDef[]) { try { localStorage.setItem(STEPS_KEY, JSON.stringify(steps)); } catch {} }
function genId(p: string) { return `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

// ─── FLOW GRAPH HELPERS ───────────────────────────────────────────────────────
function emptyFlow(name: string, device: DeviceTarget = "mobile"): NamedFlow {
  return { id: genId("flow"), name, description: "", device, nodes: {}, startNodeId: null, updatedAt: new Date().toISOString() };
}

function setSlot(flow: NamedFlow, slot: FlowSlot, nodeId: string | null): NamedFlow {
  if (slot.type === "start") return { ...flow, startNodeId: nodeId };
  const nodes = { ...flow.nodes };
  if (slot.type === "next") {
    const n = nodes[slot.nodeId];
    if (!n || n.kind !== "step") return flow;
    nodes[slot.nodeId] = { ...n, next: nodeId };
    return { ...flow, nodes };
  }
  const g = nodes[slot.gatewayId];
  if (!g || g.kind !== "gateway") return flow;
  const branches = g.branches.map(b => b.id === slot.branchId ? { ...b, next: nodeId } : b);
  nodes[slot.gatewayId] = { ...g, branches };
  return { ...flow, nodes };
}

function collectDescendants(flow: NamedFlow, nodeId: string, acc: Set<string> = new Set()): Set<string> {
  if (acc.has(nodeId)) return acc;
  acc.add(nodeId);
  const n = flow.nodes[nodeId];
  if (!n) return acc;
  if (n.kind === "step" && n.next) collectDescendants(flow, n.next, acc);
  if (n.kind === "gateway") n.branches.forEach(b => { if (b.next) collectDescendants(flow, b.next as string, acc); });
  return acc;
}

function deleteChain(flow: NamedFlow, slot: FlowSlot, nodeId: string): NamedFlow {
  const toDelete = collectDescendants(flow, nodeId);
  const nodes = { ...flow.nodes };
  toDelete.forEach(id => delete nodes[id]);
  return setSlot({ ...flow, nodes }, slot, null);
}

function addStepNode(flow: NamedFlow, slot: FlowSlot, stepId: string): NamedFlow {
  const id = genId("node");
  const node: FlowNode = { id, kind: "step", stepId, next: null };
  return setSlot({ ...flow, nodes: { ...flow.nodes, [id]: node } }, slot, id);
}

function addGatewayNode(flow: NamedFlow, slot: FlowSlot, question: string): NamedFlow {
  const id = genId("node");
  const node: FlowNode = { id, kind: "gateway", question, branches: [{ id: genId("br"), label: "Yes", next: null }, { id: genId("br"), label: "No", next: null }] };
  return setSlot({ ...flow, nodes: { ...flow.nodes, [id]: node } }, slot, id);
}

function updateGatewayQuestion(flow: NamedFlow, gatewayId: string, question: string): NamedFlow {
  const g = flow.nodes[gatewayId];
  if (!g || g.kind !== "gateway") return flow;
  return { ...flow, nodes: { ...flow.nodes, [gatewayId]: { ...g, question } } };
}

function updateBranchLabel(flow: NamedFlow, gatewayId: string, branchId: string, label: string): NamedFlow {
  const g = flow.nodes[gatewayId];
  if (!g || g.kind !== "gateway") return flow;
  const branches = g.branches.map(b => b.id === branchId ? { ...b, label } : b);
  return { ...flow, nodes: { ...flow.nodes, [gatewayId]: { ...g, branches } } };
}

function addBranch(flow: NamedFlow, gatewayId: string): NamedFlow {
  const g = flow.nodes[gatewayId];
  if (!g || g.kind !== "gateway") return flow;
  const branches = [...g.branches, { id: genId("br"), label: `Option ${g.branches.length + 1}`, next: null }];
  return { ...flow, nodes: { ...flow.nodes, [gatewayId]: { ...g, branches } } };
}

function deleteBranch(flow: NamedFlow, gatewayId: string, branchId: string): NamedFlow {
  const g = flow.nodes[gatewayId];
  if (!g || g.kind !== "gateway" || g.branches.length <= 2) return flow;
  const branch = g.branches.find(b => b.id === branchId);
  let nf = flow;
  if (branch?.next) nf = deleteChain(nf, { type: "branch", gatewayId, branchId }, branch.next);
  const g2 = nf.nodes[gatewayId];
  if (!g2 || g2.kind !== "gateway") return nf;
  const branches = g2.branches.filter(b => b.id !== branchId);
  return { ...nf, nodes: { ...nf.nodes, [gatewayId]: { ...g2, branches } } };
}

// Builds a simple linear (no-branch) step chain — used only to scaffold seed/demo flows.
function linearFlow(name: string, description: string, device: DeviceTarget, stepIds: string[]): NamedFlow {
  let flow = emptyFlow(name, device);
  flow.description = description;
  let slot: FlowSlot = { type: "start" };
  for (const stepId of stepIds) {
    flow = addStepNode(flow, slot, stepId);
    const lastId = Object.keys(flow.nodes).find(id => flow.nodes[id].kind === "step" && (flow.nodes[id] as any).stepId === stepId && (flow.nodes[id] as any).next === null)!;
    slot = { type: "next", nodeId: lastId };
  }
  return flow;
}

function seedFlows(): NamedFlow[] {
  const standard = linearFlow(
    "Standard Flow", "Default onboarding for regular users — mobile verification, KYC L1-L3, SCA, AML.", "mobile",
    ["mobile_verification", "kyc_l1_geo", "kyc_l1_personal_data", "kyc_l2_poi", "username_creation", "sca_pin_setup", "sca_device_binding", "aml_questionnaire", "system_configuration", "wallet_ready"]
  );

  const invite = linearFlow(
    "Invite-Only", "Closed beta — requires a valid invitation code before registration starts.", "mobile",
    ["invitation_", "mobile_verification", "kyc_l1_geo", "kyc_l1_personal_data", "username_creation", "sca_pin_setup", "aml_questionnaire", "system_configuration", "wallet_ready"]
  );

  // Demonstrates a gateway: branches on US-person status before continuing.
  let branching = linearFlow("US-Status Branching Demo", "Shows a gateway — the flow forks based on the user's answer at KYC L1.", "web",
    ["kyc_l1_geo", "kyc_l1_personal_data"]);
  const tailStepId = Object.keys(branching.nodes).find(id => branching.nodes[id].kind === "step" && (branching.nodes[id] as any).next === null)!;
  branching = addGatewayNode(branching, { type: "next", nodeId: tailStepId }, "Is the user a US citizen, resident, or taxpayer?");
  const gatewayId = Object.keys(branching.nodes).find(id => branching.nodes[id].kind === "gateway")!;
  const gw = branching.nodes[gatewayId];
  const yesBranch = gw.kind === "gateway" ? gw.branches[0] : null;
  const noBranch = gw.kind === "gateway" ? gw.branches[1] : null;
  if (yesBranch) branching = addStepNode(branching, { type: "branch", gatewayId, branchId: yesBranch.id }, "us_related_blocked_screen");
  if (noBranch) {
    branching = addStepNode(branching, { type: "branch", gatewayId, branchId: noBranch.id }, "kyc_l2_poi");
    const poiNodeId = Object.keys(branching.nodes).find(id => branching.nodes[id].kind === "step" && (branching.nodes[id] as any).stepId === "kyc_l2_poi")!;
    branching = addStepNode(branching, { type: "next", nodeId: poiNodeId }, "username_creation");
    const userNodeId = Object.keys(branching.nodes).find(id => branching.nodes[id].kind === "step" && (branching.nodes[id] as any).stepId === "username_creation")!;
    branching = addStepNode(branching, { type: "next", nodeId: userNodeId }, "system_configuration");
    const sysNodeId = Object.keys(branching.nodes).find(id => branching.nodes[id].kind === "step" && (branching.nodes[id] as any).stepId === "system_configuration")!;
    branching = addStepNode(branching, { type: "next", nodeId: sysNodeId }, "wallet_ready");
  }

  return [standard, invite, branching];
}

function loadFlows(): NamedFlow[] {
  if (typeof window === "undefined") return seedFlows();
  try { const raw = localStorage.getItem(FLOWS_KEY); if (raw) return JSON.parse(raw); } catch {}
  const seeded = seedFlows();
  try { localStorage.setItem(FLOWS_KEY, JSON.stringify(seeded)); } catch {}
  return seeded;
}
function saveFlows(flows: NamedFlow[]) { try { localStorage.setItem(FLOWS_KEY, JSON.stringify(flows)); } catch {} }

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
            {filtered.map((s) => (
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

// ─── FLOW BUILDER TAB — graph editor with sequential steps + gateway branches ──
const DEVICE_OPTIONS: { id: DeviceTarget; label: string }[] = [
  { id: "web", label: "Web" },
  { id: "mobile", label: "Mobile" },
  { id: "tablet", label: "Tablet" },
];

function StepPickerModal({ steps, onPick, onClose }: { steps: StepDef[]; onPick: (stepId: string) => void; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("All");
  const categories = ["All", ...Array.from(new Set(steps.map(s => s.category)))];
  const filtered = steps.filter(s => (cat === "All" || s.category === cat) && (s.label.toLowerCase().includes(search.toLowerCase()) || s.id.includes(search.toLowerCase())));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <p className="text-white font-semibold text-sm">Pick a Step</p>
          <button onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-3 border-b border-zinc-800 space-y-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search steps…" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500" />
          <div className="flex gap-1.5 flex-wrap">
            {categories.map(c => (
              <button key={c} onClick={() => setCat(c)} className={`px-2.5 py-1 rounded-full text-[10px] cursor-pointer transition-colors ${cat === c ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}>{c}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.map(s => (
            <button key={s.id} onClick={() => onPick(s.id)} className="w-full flex items-center gap-3 text-left px-3 py-2 rounded-lg hover:bg-zinc-800 cursor-pointer transition-colors">
              <span className="text-base">{s.icon}</span>
              <div className="min-w-0">
                <p className="text-white text-xs font-medium truncate">{s.label}</p>
                <p className="text-zinc-500 text-[10px] truncate">{s.category} · {s.id}</p>
              </div>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-zinc-600 text-xs text-center py-6">No matching steps</p>}
        </div>
      </div>
    </div>
  );
}

function NodeSlot({ flow, onChange, slot, nodeId, steps }: { flow: NamedFlow; onChange: (f: NamedFlow) => void; slot: FlowSlot; nodeId: string | null; steps: StepDef[] }) {
  const [showPicker, setShowPicker] = useState(false);

  if (!nodeId) {
    return (
      <div className="flex gap-2 py-1">
        <button onClick={() => setShowPicker(true)} className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 border border-dashed border-indigo-500/40 rounded-lg px-2.5 py-1.5 cursor-pointer"><Plus className="w-3 h-3" /> Add Step</button>
        <button onClick={() => onChange(addGatewayNode(flow, slot, "New decision"))} className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 border border-dashed border-amber-500/40 rounded-lg px-2.5 py-1.5 cursor-pointer"><Plus className="w-3 h-3" /> Add Gateway</button>
        {showPicker && <StepPickerModal steps={steps} onClose={() => setShowPicker(false)} onPick={stepId => { onChange(addStepNode(flow, slot, stepId)); setShowPicker(false); }} />}
      </div>
    );
  }

  const node = flow.nodes[nodeId];
  if (!node) return null;

  if (node.kind === "step") {
    const stepDef = steps.find(s => s.id === node.stepId);
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
          <span>{stepDef?.icon ?? "❔"}</span>
          <span className="text-white text-xs">{stepDef?.label ?? node.stepId}</span>
          {stepDef?.isTerminal && <Badge className="text-[9px] border border-orange-500/40 text-orange-400">terminal</Badge>}
          <button onClick={() => onChange(deleteChain(flow, slot, nodeId))} className="ml-auto text-zinc-600 hover:text-red-400 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
        <div className="pl-4 border-l border-zinc-800 ml-2">
          <NodeSlot flow={flow} onChange={onChange} slot={{ type: "next", nodeId }} nodeId={node.next} steps={steps} />
        </div>
      </div>
    );
  }

  // gateway
  return (
    <div className="rounded-xl border border-amber-700/40 bg-amber-500/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-amber-400 text-xs shrink-0">⑂</span>
        <input value={node.question} onChange={e => onChange(updateGatewayQuestion(flow, node.id, e.target.value))} className="bg-transparent text-white text-xs flex-1 focus:outline-none border-b border-transparent focus:border-amber-500/50" />
        <button onClick={() => onChange(deleteChain(flow, slot, nodeId))} className="text-zinc-600 hover:text-red-400 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {node.branches.map(b => (
          <div key={b.id} className="border border-zinc-800 bg-zinc-950 rounded-lg p-2 min-w-[200px] shrink-0">
            <div className="flex items-center gap-1 mb-2">
              <input value={b.label} onChange={e => onChange(updateBranchLabel(flow, node.id, b.id, e.target.value))} className="bg-zinc-800 text-white text-[10px] px-2 py-1 rounded flex-1 focus:outline-none" />
              {node.branches.length > 2 && <button onClick={() => onChange(deleteBranch(flow, node.id, b.id))} className="text-zinc-600 hover:text-red-400 cursor-pointer"><X className="w-3 h-3" /></button>}
            </div>
            <NodeSlot flow={flow} onChange={onChange} slot={{ type: "branch", gatewayId: node.id, branchId: b.id }} nodeId={b.next} steps={steps} />
          </div>
        ))}
        <button onClick={() => onChange(addBranch(flow, node.id))} className="text-amber-400 hover:text-amber-300 text-[11px] cursor-pointer self-start whitespace-nowrap px-2 py-1.5">+ Branch</button>
      </div>
    </div>
  );
}

function FlowEditor({ flow, steps, onSave, onRun }: { flow: NamedFlow; steps: StepDef[]; onSave: (f: NamedFlow) => void; onRun: (id: string) => void }) {
  const [draft, setDraft] = useState<NamedFlow>(flow);
  const save = () => onSave({ ...draft, updatedAt: new Date().toISOString() });
  const nodeCount = Object.keys(draft.nodes).length;

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Flow Name" value={draft.name} onChange={v => setDraft(d => ({ ...d, name: v }))} />
        <Field label="Description" value={draft.description} onChange={v => setDraft(d => ({ ...d, description: v }))} />
      </div>
      <div>
        <label className="block text-[10px] text-zinc-500 mb-1.5">Target Device</label>
        <div className="flex gap-1.5">
          {DEVICE_OPTIONS.map(d => (
            <button key={d.id} onClick={() => setDraft(p => ({ ...p, device: d.id }))} className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${draft.device === d.id ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}>{d.label}</button>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-zinc-400 text-xs font-semibold">Flow Steps</p>
          <Badge className="text-[10px] border border-zinc-700 text-zinc-400">{nodeCount} node{nodeCount !== 1 ? "s" : ""}</Badge>
        </div>
        <p className="text-zinc-600 text-[10px] mb-3">Add steps in sequential order, or insert a gateway to branch the flow (e.g. Yes/No) into separate step chains.</p>
        <NodeSlot flow={draft} onChange={setDraft} slot={{ type: "start" }} nodeId={draft.startNodeId} steps={steps} />
      </div>
      <div className="flex gap-2">
        <button onClick={save} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg cursor-pointer">Save Flow</button>
        <button onClick={() => { save(); onRun(draft.id); }} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2 rounded-lg cursor-pointer"><Play className="w-3.5 h-3.5" /> Save & Run Walkthrough</button>
      </div>
    </div>
  );
}

function flowNodeCountLabel(flow: NamedFlow): string {
  return `${Object.keys(flow.nodes).length} node${Object.keys(flow.nodes).length !== 1 ? "s" : ""}`;
}

function FlowBuilderTab({ steps, flows, setFlows, onRunWalkthrough }: { steps: StepDef[]; flows: NamedFlow[]; setFlows: (f: NamedFlow[]) => void; onRunWalkthrough: (flowId: string) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(flows[0]?.id ?? null);
  const selectedFlow = flows.find(f => f.id === selectedId) ?? null;

  const newFlow = () => {
    const nf = emptyFlow("New Flow");
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
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge className="text-[9px] border border-zinc-700 text-zinc-500 capitalize">{f.device}</Badge>
              <p className="text-zinc-500 text-[10px]">{flowNodeCountLabel(f)}</p>
            </div>
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
function DeviceShell({ device, children }: { device: DeviceTarget; children: React.ReactNode }) {
  if (device === "web") {
    return (
      <div className="w-full max-w-xl rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden">
        <div className="h-8 bg-zinc-800 flex items-center gap-1.5 px-3 shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" /><div className="w-2.5 h-2.5 rounded-full bg-yellow-500" /><div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <div className="ml-3 flex-1 bg-zinc-950 rounded px-2 py-0.5 text-[10px] text-zinc-500 truncate">app.uth.io/onboarding</div>
        </div>
        <div className="h-[520px] overflow-y-auto bg-zinc-950 px-8 py-6 flex items-start justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    );
  }
  if (device === "tablet") {
    return (
      <div className="w-[440px] h-[620px] rounded-[2rem] border-4 border-zinc-700 bg-black p-3 shadow-2xl shrink-0">
        <div className="w-full h-full rounded-[1.5rem] bg-zinc-950 overflow-hidden flex flex-col">
          <div className="h-6 flex items-center justify-between px-6 text-[9px] text-zinc-400 shrink-0">
            <span>9:41</span><span>Wi-Fi</span>
          </div>
          <div className="flex-1 overflow-y-auto px-10 pb-6 flex items-start justify-center">
            <div className="w-full max-w-xs pt-4">{children}</div>
          </div>
        </div>
      </div>
    );
  }
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

function GatewayScreen({ node, onChoose }: { node: Extract<FlowNode, { kind: "gateway" }>; onChoose: (branchId: string) => void }) {
  return (
    <div className="space-y-3 pt-8">
      <div className="text-3xl text-center">⑂</div>
      <p className="text-white text-sm font-semibold text-center px-2">{node.question}</p>
      <div className="flex flex-col gap-2 px-2">
        {node.branches.map(b => (
          <button key={b.id} onClick={() => onChoose(b.id)} className="bg-zinc-800 hover:bg-indigo-600 text-white text-xs py-2.5 rounded-xl cursor-pointer transition-colors">{b.label}</button>
        ))}
      </div>
    </div>
  );
}

// Walks the flow graph node-by-node. Gateway nodes pause for a live choice; the
// chosen branch determines which downstream chain is replayed next.
function WalkthroughRunner({ flow, flows, steps, setSelectedFlowId }: { flow: NamedFlow; flows: NamedFlow[]; steps: StepDef[]; setSelectedFlowId: (id: string) => void }) {
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(flow.startNodeId);
  const [visited, setVisited] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>([]);

  const node = currentNodeId ? flow.nodes[currentNodeId] : null;
  const isFinished = !node;

  const goTo = (nextId: string | null, label: string) => {
    setLog(l => [...l, `[${new Date().toTimeString().slice(0, 8)}] ✓ ${label}`]);
    if (currentNodeId) setVisited(v => [...v, currentNodeId]);
    setCurrentNodeId(nextId);
  };
  const reset = () => { setCurrentNodeId(flow.startNodeId); setVisited([]); setLog([]); };

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
        <Badge className="text-[9px] border border-zinc-700 text-zinc-500 capitalize">{flow.device}</Badge>
        <div className="flex items-center justify-between pt-1">
          <p className="text-zinc-400 text-xs font-semibold">Visited Steps</p>
          <button onClick={reset} className="text-zinc-500 hover:text-white cursor-pointer"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
        <div className="space-y-1">
          {visited.length === 0 && <p className="text-zinc-700 text-[11px]">Nothing visited yet</p>}
          {visited.map((id, i) => {
            const n = flow.nodes[id];
            const label = n?.kind === "step" ? steps.find(s => s.id === n.stepId)?.label ?? n.stepId : n?.kind === "gateway" ? n.question : id;
            return (
              <div key={id + i} className="flex items-center gap-2 rounded-lg px-2 py-1 text-[11px]">
                <CheckCircle className="w-3 h-3 text-green-400 shrink-0" />
                <span className="text-green-400 truncate">{label}</span>
              </div>
            );
          })}
          {node && (
            <div className="flex items-center gap-2 rounded-lg px-2 py-1 text-[11px] bg-indigo-500/10 border border-indigo-500/30">
              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse shrink-0" />
              <span className="text-white truncate">{node.kind === "step" ? (steps.find(s => s.id === node.stepId)?.label ?? node.stepId) : node.question}</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6 flex items-center justify-center">
        <DeviceShell device={flow.device}>
          {isFinished ? (
            <div className="space-y-3 pt-10 text-center">
              <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
              <p className="text-white text-sm font-semibold">Walkthrough complete</p>
              <button onClick={reset} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-lg cursor-pointer">Restart</button>
            </div>
          ) : node?.kind === "step" ? (
            (() => {
              const stepDef = steps.find(s => s.id === node.stepId);
              return stepDef ? <StepScreen key={node.id} step={stepDef} onComplete={() => goTo(node.next, stepDef.label)} /> : (
                <div className="pt-10 text-center text-zinc-500 text-xs">Step &ldquo;{node.stepId}&rdquo; no longer exists in the registry.</div>
              );
            })()
          ) : node?.kind === "gateway" ? (
            <GatewayScreen key={node.id} node={node} onChoose={branchId => {
              const b = node.branches.find(x => x.id === branchId);
              goTo(b?.next ?? null, `${node.question} → ${b?.label ?? branchId}`);
            }} />
          ) : null}
        </DeviceShell>
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

// ─── EVENT BINDINGS ───────────────────────────────────────────────────────────
// Each screen type defines the exact data contract: what the client must send,
// what UTH stores internally, and what is returned to the client application.
const SCREEN_SCHEMAS: Record<string, { collects: { field: string; type: string; required: boolean; description: string }[]; stores: string[]; returns: { field: string; type: string; description: string }[] }> = {
  invite_code: { collects: [{ field: "invitation_code", type: "string(6)", required: true, description: "6-character alphanumeric invitation code" }], stores: ["invite_validated", "referrer_id"], returns: [{ field: "referrer_id", type: "string | null", description: "User ID of the referrer if code was valid" }] },
  mobile_otp: { collects: [{ field: "phone_number", type: "E.164 string", required: true, description: "International phone number e.g. +44771..." }, { field: "otp_code", type: "string(6)", required: true, description: "6-digit OTP received via SMS" }], stores: ["verified_phone"], returns: [{ field: "phone_verified", type: "boolean", description: "Whether phone was successfully verified" }, { field: "phone_last4", type: "string", description: "Last 4 digits of the verified number" }] },
  us_relation: { collects: [{ field: "us_status", type: "enum: not_us | citizen | green_card | tax_resident", required: true, description: "User's US person status for FATCA compliance" }], stores: ["fatca_declaration"], returns: [{ field: "is_us_person", type: "boolean", description: "True if any US relation was declared" }, { field: "us_status", type: "string", description: "Exact declaration value stored" }] },
  geo_select: { collects: [{ field: "country", type: "ISO 3166-1 alpha-2", required: true, description: "User's country of residence" }], stores: ["residence_country", "jurisdiction"], returns: [{ field: "country", type: "string", description: "ISO country code" }, { field: "permitted", type: "boolean", description: "Whether country is on the allowed list" }, { field: "waitlisted", type: "boolean", description: "Whether country is waitlisted" }] },
  personal_data: { collects: [{ field: "first_name", type: "string", required: true, description: "Legal first name" }, { field: "last_name", type: "string", required: true, description: "Legal last name" }, { field: "date_of_birth", type: "ISO 8601 date", required: true, description: "Date of birth for age verification" }, { field: "nationality", type: "ISO 3166-1 alpha-2", required: true, description: "Nationality / citizenship country" }], stores: ["kyc_l1_personal"], returns: [{ field: "kyc_l1_completed", type: "boolean", description: "L1 data collection complete" }, { field: "is_underage", type: "boolean", description: "True if DOB indicates user is under 18" }] },
  poi_upload: { collects: [{ field: "document_type", type: "enum: passport | national_id | driving_licence", required: true, description: "Type of identity document" }, { field: "document_front", type: "base64 string", required: true, description: "Front image of the document" }, { field: "document_back", type: "base64 string", required: false, description: "Back image (required for national ID)" }], stores: ["kyc_l2_document", "sumsub_applicant_id"], returns: [{ field: "poi_status", type: "enum: verified | review | rejected", description: "Document verification outcome" }, { field: "sumsub_applicant_id", type: "string", description: "SumSub applicant reference for future calls" }] },
  processing: { collects: [], stores: ["seon_check_result", "risk_score"], returns: [{ field: "passed", type: "boolean", description: "Whether the automated check passed" }, { field: "score", type: "number 0-100", description: "Risk score where applicable" }, { field: "status", type: "enum: passed | review | blocked", description: "Check outcome" }] },
  username: { collects: [{ field: "username", type: "string 3-20 chars", required: true, description: "Desired unique display name" }], stores: ["display_name"], returns: [{ field: "username", type: "string", description: "Confirmed unique username" }, { field: "available", type: "boolean", description: "Whether the chosen username was available" }] },
  pin_setup: { collects: [{ field: "pin", type: "string(6) digits", required: true, description: "6-digit PIN — client must hash with PBKDF2 before sending" }], stores: ["sca_pin_hash"], returns: [{ field: "pin_set", type: "boolean", description: "PIN stored successfully" }, { field: "sca_method", type: "string", description: "Registered SCA method: pin" }] },
  device_binding: { collects: [{ field: "device_public_key", type: "base64 EC P-256 public key", required: true, description: "Public key from the device-generated key pair" }, { field: "device_fingerprint", type: "string", required: true, description: "Device attestation token (Apple/Android/TPM)" }], stores: ["bound_device", "device_key_pair"], returns: [{ field: "device_id", type: "string", description: "UTH device identifier" }, { field: "binding_token", type: "JWT", description: "Device-bound token for future SCA challenges" }] },
  biometric: { collects: [{ field: "biometric_type", type: "enum: face_id | touch_id | fingerprint", required: true, description: "Biometric method to enrol" }, { field: "biometric_public_key", type: "base64", required: true, description: "Public key registered to biometric authenticator" }], stores: ["biometric_enrollment"], returns: [{ field: "biometric_enabled", type: "boolean", description: "Biometric login activated" }, { field: "biometric_type", type: "string", description: "Enrolled biometric method" }] },
  aml_form: { collects: [{ field: "occupation", type: "string", required: true, description: "User's declared occupation" }, { field: "source_of_funds", type: "enum: salary | business | investments | savings | other", required: true, description: "Primary source of funds" }, { field: "expected_monthly_volume", type: "enum: <1k | 1k-10k | >10k", required: true, description: "Expected monthly transaction volume in EUR" }, { field: "is_pep", type: "boolean", required: true, description: "Whether user is a Politically Exposed Person" }], stores: ["aml_questionnaire"], returns: [{ field: "aml_completed", type: "boolean", description: "AML questionnaire submitted successfully" }, { field: "aml_risk_score", type: "number 0-100", description: "AML risk score derived from answers" }] },
  enhanced_aml_form: { collects: [{ field: "purpose", type: "string", required: true, description: "Purpose of opening the account" }, { field: "transaction_types", type: "string[]", required: true, description: "Expected transaction types" }, { field: "acting_for_third_party", type: "boolean", required: true, description: "Whether user acts on behalf of a third party" }, { field: "declaration_accepted", type: "boolean", required: true, description: "User confirmed accuracy of all information" }], stores: ["enhanced_aml_questionnaire"], returns: [{ field: "enhanced_aml_completed", type: "boolean", description: "Enhanced AML submitted" }, { field: "compliance_hold", type: "boolean", description: "Whether account requires compliance team review" }] },
  system_progress: { collects: [], stores: ["wallet", "account_limits", "notification_preferences"], returns: [{ field: "wallet_id", type: "string", description: "Provisioned wallet identifier" }, { field: "account_number", type: "string", description: "Assigned account number" }, { field: "iban", type: "string | null", description: "IBAN if provisioned" }] },
  success: { collects: [], stores: [], returns: [{ field: "onboarding_completed", type: "boolean", description: "Full onboarding flow complete" }, { field: "account_status", type: "enum: active | pending_review", description: "Final account status" }, { field: "access_token", type: "JWT", description: "Session access token for the newly onboarded user" }] },
  gateway: { collects: [{ field: "branch_id", type: "string", required: true, description: "ID of the chosen branch from the branches array in the response" }], stores: ["decision_path"], returns: [{ field: "branch_label", type: "string", description: "Label of the chosen branch" }, { field: "next_screen_id", type: "string | null", description: "ID of the next screen in the chosen branch, or null if flow ends" }] },
  terminal_block: { collects: [], stores: ["block_reason"], returns: [{ field: "blocked", type: "true", description: "Flow terminated — registration cannot proceed" }, { field: "block_reason", type: "string", description: "Machine-readable reason code" }] },
  terminal_wait: { collects: [], stores: ["pending_reason"], returns: [{ field: "status", type: "enum: pending_review | waitlisted", description: "User is in a non-blocking waiting state" }, { field: "estimated_wait", type: "string | null", description: "Estimated review time if available" }] },
};

interface EventBinding {
  id: string;
  eventName: string;
  category: string;
  description: string;
  trigger: string;
  flowId: string | null;
  webhookUrl: string;
  isSystem: boolean;
  active: boolean;
  createdAt: string;
}

const SYSTEM_EVENTS: Omit<EventBinding, "id" | "flowId" | "webhookUrl" | "createdAt">[] = [
  { eventName: "login", category: "Authentication", description: "User attempts to log in. Trigger flows for SCA challenge, new-device binding, or step-up verification.", trigger: "POST /api/auth/login or SDK auth.signIn()", isSystem: true, active: true },
  { eventName: "user.created", category: "Lifecycle", description: "New user registration. Trigger full onboarding flow including KYC collection and account provisioning.", trigger: "POST /api/users or SDK users.create()", isSystem: true, active: true },
  { eventName: "verification.tier_upgrade", category: "KYC", description: "User requests access to a higher product tier requiring enhanced KYC (e.g. to increase limits or unlock features).", trigger: "POST /api/users/:id/verification or SDK kyc.upgrade()", isSystem: true, active: true },
  { eventName: "limit.exceeded", category: "Risk", description: "User hits a transaction limit that requires identity verification before the transaction can proceed.", trigger: "Emitted internally by transaction engine when limit threshold is crossed", isSystem: true, active: true },
  { eventName: "watchlist.cap", category: "Risk", description: "User reaches a watchlist cap — requires enhanced AML questionnaire and compliance review before proceeding.", trigger: "Emitted by AML/screening engine on watchlist match or velocity cap", isSystem: true, active: true },
  { eventName: "sca.required", category: "Authentication", description: "Strong Customer Authentication challenge required (PSD2 / RTS). Triggers PIN or biometric verification.", trigger: "Emitted by payment engine on high-value or cross-border transactions", isSystem: true, active: true },
  { eventName: "device.new", category: "Authentication", description: "Login from an unrecognized device. Trigger device binding confirmation flow.", trigger: "Emitted by auth engine when device fingerprint is not in the bound-devices list", isSystem: true, active: true },
  { eventName: "aml.review_required", category: "Compliance", description: "AML engine flagged the user for enhanced due diligence. Trigger extended AML questionnaire flow.", trigger: "Emitted by risk engine on elevated AML score or manual compliance escalation", isSystem: true, active: true },
];

const EVENTS_KEY = "onboarding_events_v1";

function loadEvents(): EventBinding[] {
  if (typeof window === "undefined") return [];
  try { const raw = localStorage.getItem(EVENTS_KEY); if (raw) return JSON.parse(raw); } catch {}
  const seeded: EventBinding[] = SYSTEM_EVENTS.map(e => ({ ...e, id: genId("ev"), flowId: null, webhookUrl: "", createdAt: new Date().toISOString() }));
  try { localStorage.setItem(EVENTS_KEY, JSON.stringify(seeded)); } catch {}
  return seeded;
}
function saveEvents(events: EventBinding[]) { try { localStorage.setItem(EVENTS_KEY, JSON.stringify(events)); } catch {} }

// ─── EVENT BINDINGS TAB ───────────────────────────────────────────────────────
function collectNodesInOrder(flow: NamedFlow, startId: string | null, depth = 0): { nodeId: string; depth: number }[] {
  if (!startId || depth > 50) return [];
  const node = flow.nodes[startId];
  if (!node) return [];
  if (node.kind === "step") return [{ nodeId: startId, depth }, ...collectNodesInOrder(flow, node.next, depth)];
  return [{ nodeId: startId, depth }, ...node.branches.flatMap(b => collectNodesInOrder(flow, b.next, depth + 1))];
}

function ApiSpecModal({ event, flow, steps, onClose }: { event: EventBinding; flow: NamedFlow | null; steps: StepDef[]; onClose: () => void }) {
  const [codeTab, setCodeTab] = useState<"curl" | "js" | "protocol">("protocol");
  const stepMap = Object.fromEntries(steps.map(s => [s.id, s]));
  const nodes = flow ? collectNodesInOrder(flow, flow.startNodeId) : [];

  const baseUrl = "https://api.uth.io/v1";
  const curlInit = `# 1. Initiate a flow session for the "${event.eventName}" event
curl -X POST ${baseUrl}/flows/session \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": "${event.eventName}",
    "userId": "usr_abc123",
    "clientId": "app_xyz",
    "context": {
      "ip": "192.168.1.1",
      "device_id": "dev_xxx",
      "user_agent": "Mozilla/5.0 ..."
    }
  }'

# Response → contains sessionId + first screen
# -----------------------------------------------

# 2. Submit data for a step (repeat for each screen)
curl -X POST ${baseUrl}/flows/session/{sessionId}/step \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "stepId": "mobile_verification",
    "data": {
      "phone_number": "+44771234567",
      "otp_code": "847291"
    }
  }'`;

  const jsCode = `import { UTHClient } from "@uth/sdk";

const uth = new UTHClient({ apiKey: process.env.UTH_API_KEY });

// Initiate flow for the "${event.eventName}" event
const session = await uth.flows.initiate({
  event: "${event.eventName}",
  userId: currentUser.id,
  context: {
    ip: request.ip,
    deviceId: deviceFingerprint,
  },
});

// UTH returns the first screen to render
console.log(session.screen);
// → { id: "mobile_verification", type: "mobile_otp", label: "Mobile Verification",
//     collectsData: ["phone_number", "otp_code"], isOptional: false }

// When user completes a step on the client side:
async function handleStepComplete(stepId: string, data: Record<string, unknown>) {
  const result = await uth.flows.submitStep({
    sessionId: session.sessionId,
    stepId,
    data,
  });

  if (result.status === "completed") {
    // All screens done — result.collectedData has the full payload
    return onFlowComplete(result);
  }
  if (result.screen) {
    // Render the next screen
    return renderScreen(result.screen);
  }
  if (result.gateway) {
    // Show a branch selection UI
    return renderGateway(result.gateway);
  }
}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <code className="text-indigo-400 text-sm font-mono font-bold">{event.eventName}</code>
              <Badge className="text-[10px] border border-zinc-700 text-zinc-400">{event.category}</Badge>
              {flow && <Badge className="text-[10px] border border-green-500/30 text-green-400">→ {flow.name}</Badge>}
            </div>
            <p className="text-zinc-500 text-xs mt-0.5">{event.description}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex border-b border-zinc-800 px-6 gap-1">
          {([["protocol", "Flow Protocol"], ["curl", "cURL"], ["js", "JavaScript SDK"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setCodeTab(id)} className={`px-3 py-2 text-xs border-b-2 -mb-px cursor-pointer transition-colors ${codeTab === id ? "border-indigo-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>{label}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {codeTab === "protocol" && (
            <div className="space-y-5">
              <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-zinc-400">Trigger</p>
                <code className="text-indigo-300 text-xs">{event.trigger}</code>
              </div>

              <div>
                <p className="text-sm font-semibold text-white mb-3">Initiation Request → Response</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                    <p className="text-[10px] text-zinc-500 font-mono mb-2">POST /v1/flows/session</p>
                    <pre className="text-[11px] text-zinc-300 font-mono leading-relaxed">{JSON.stringify({ event: event.eventName, userId: "usr_abc123", clientId: "app_xyz", context: { ip: "x.x.x.x", device_id: "dev_xxx" } }, null, 2)}</pre>
                  </div>
                  <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                    <p className="text-[10px] text-zinc-500 font-mono mb-2">200 OK — first screen</p>
                    <pre className="text-[11px] text-zinc-300 font-mono leading-relaxed">{JSON.stringify({ sessionId: "fls_xxxx", totalScreens: nodes.filter(n => flow?.nodes[n.nodeId]?.kind === "step").length, currentStep: 1, screen: { id: flow && nodes[0] && flow.nodes[nodes[0].nodeId]?.kind === "step" ? (flow.nodes[nodes[0].nodeId] as any).stepId : "screen_id", type: "mobile_otp", isOptional: false } }, null, 2)}</pre>
                  </div>
                </div>
              </div>

              {flow ? (
                <div>
                  <p className="text-sm font-semibold text-white mb-3">Screen Sequence — {flow.name} ({flow.device})</p>
                  <div className="space-y-2">
                    {nodes.map(({ nodeId, depth }) => {
                      const node = flow.nodes[nodeId];
                      if (!node) return null;
                      if (node.kind === "gateway") {
                        return (
                          <div key={nodeId} style={{ marginLeft: depth * 16 }} className="border border-amber-700/40 bg-amber-500/5 rounded-lg px-4 py-3">
                            <p className="text-xs text-amber-400 font-semibold">⑂ GATEWAY: {node.question}</p>
                            <p className="text-[10px] text-zinc-500 mt-1">Client receives <code className="font-mono text-zinc-400">gateway</code> object with branches array. Send chosen <code className="font-mono text-zinc-400">branch_id</code> back.</p>
                            <div className="flex gap-2 mt-1.5 flex-wrap">
                              {node.branches.map(b => <code key={b.id} className="text-[10px] text-amber-300 font-mono bg-zinc-800 px-2 py-0.5 rounded">{b.label}</code>)}
                            </div>
                          </div>
                        );
                      }
                      const stepDef = stepMap[node.stepId];
                      const schema = SCREEN_SCHEMAS[stepDef?.screenType ?? ""] ?? { collects: [], stores: [], returns: [] };
                      return (
                        <div key={nodeId} style={{ marginLeft: depth * 16 }} className="border border-zinc-800 bg-zinc-950 rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <span>{stepDef?.icon}</span>
                            <span className="text-white text-xs font-medium">{stepDef?.label ?? node.stepId}</span>
                            <code className="text-[10px] text-zinc-500 font-mono">{node.stepId}</code>
                            {stepDef?.isTerminal && <Badge className="text-[9px] border border-orange-500/30 text-orange-400">terminal</Badge>}
                          </div>
                          {schema.collects.length > 0 && (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">Client sends</p>
                                <div className="space-y-1">
                                  {schema.collects.map(c => (
                                    <div key={c.field} className="flex items-start gap-1.5 text-[10px]">
                                      <code className="text-indigo-300 font-mono whitespace-nowrap">{c.field}</code>
                                      <span className="text-zinc-600">:</span>
                                      <span className="text-zinc-400">{c.type}</span>
                                      {c.required && <span className="text-red-400 shrink-0">*</span>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">UTH returns</p>
                                <div className="space-y-1">
                                  {schema.returns.map(r => (
                                    <div key={r.field} className="flex items-start gap-1.5 text-[10px]">
                                      <code className="text-green-300 font-mono whitespace-nowrap">{r.field}</code>
                                      <span className="text-zinc-600">:</span>
                                      <span className="text-zinc-400">{r.type}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                          {schema.collects.length === 0 && (
                            <p className="text-[10px] text-zinc-600">Automated step — no client input required. UTH processes internally and advances.</p>
                          )}
                        </div>
                      );
                    })}
                    {nodes.length === 0 && <p className="text-zinc-600 text-xs text-center py-4">Flow has no steps yet. Add steps in Flow Builder.</p>}
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6 text-center">
                  <p className="text-zinc-400 text-sm">No flow bound to this event.</p>
                  <p className="text-zinc-600 text-xs mt-1">Bind a flow using the event settings to see the full screen sequence and data contract.</p>
                </div>
              )}
            </div>
          )}

          {codeTab === "curl" && (
            <pre className="text-[11px] text-zinc-300 font-mono leading-relaxed bg-zinc-950 border border-zinc-800 rounded-xl p-5 overflow-x-auto whitespace-pre">{curlInit}</pre>
          )}

          {codeTab === "js" && (
            <pre className="text-[11px] text-zinc-300 font-mono leading-relaxed bg-zinc-950 border border-zinc-800 rounded-xl p-5 overflow-x-auto whitespace-pre">{jsCode}</pre>
          )}
        </div>
      </div>
    </div>
  );
}

function EventBindingsTab({ flows, steps, events, setEvents, onRunWalkthrough }: {
  flows: NamedFlow[]; steps: StepDef[];
  events: EventBinding[]; setEvents: (e: EventBinding[]) => void;
  onRunWalkthrough: (flowId: string) => void;
}) {
  const [selected, setSelected] = useState<EventBinding | null>(null);
  const [showSpec, setShowSpec] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ eventName: "", category: "Custom", description: "", trigger: "" });

  const flowMap = Object.fromEntries(flows.map(f => [f.id, f]));
  const categories = Array.from(new Set(events.map(e => e.category)));

  const bindFlow = (eventId: string, flowId: string | null) => {
    const updated = events.map(e => e.id === eventId ? { ...e, flowId } : e);
    setEvents(updated); saveEvents(updated);
    if (selected?.id === eventId) setSelected(prev => prev ? { ...prev, flowId } : null);
  };
  const setWebhook = (eventId: string, url: string) => {
    const updated = events.map(e => e.id === eventId ? { ...e, webhookUrl: url } : e);
    setEvents(updated); saveEvents(updated);
    if (selected?.id === eventId) setSelected(prev => prev ? { ...prev, webhookUrl: url } : null);
  };
  const toggleActive = (eventId: string) => {
    const updated = events.map(e => e.id === eventId ? { ...e, active: !e.active } : e);
    setEvents(updated); saveEvents(updated);
  };
  const addCustomEvent = () => {
    if (!newEvent.eventName) return;
    const ev: EventBinding = { id: genId("ev"), ...newEvent, flowId: null, webhookUrl: "", isSystem: false, active: true, createdAt: new Date().toISOString() };
    const updated = [...events, ev];
    setEvents(updated); saveEvents(updated); setShowAddEvent(false);
    setNewEvent({ eventName: "", category: "Custom", description: "", trigger: "" });
  };
  const deleteEvent = (id: string) => {
    const updated = events.filter(e => e.id !== id);
    setEvents(updated); saveEvents(updated);
    if (selected?.id === id) setSelected(null);
  };

  const catColors: Record<string, string> = { Authentication: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10", KYC: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10", Risk: "text-red-400 border-red-500/30 bg-red-500/10", Compliance: "text-orange-400 border-orange-500/30 bg-orange-500/10", Lifecycle: "text-green-400 border-green-500/30 bg-green-500/10", Custom: "text-zinc-400 border-zinc-700 bg-zinc-800" };

  return (
    <div className="flex h-[calc(100vh-180px)]">
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">Event Bindings</h2>
            <p className="text-zinc-500 text-xs mt-0.5">Bind application events to onboarding flows. UTH will return the screen sequence and data contracts to your client app.</p>
          </div>
          <button onClick={() => setShowAddEvent(true)} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-2 rounded-lg cursor-pointer"><Plus className="w-3.5 h-3.5" /> Custom Event</button>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {categories.map(cat => {
            const catEvents = events.filter(e => e.category === cat);
            return (
              <div key={cat} className="space-y-1.5">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest px-1">{cat}</p>
                {catEvents.map(ev => {
                  const boundFlow = ev.flowId ? flowMap[ev.flowId] : null;
                  const nodeCount = boundFlow ? Object.keys(boundFlow.nodes).length : 0;
                  const isSelected = selected?.id === ev.id;
                  return (
                    <div key={ev.id} onClick={() => setSelected(isSelected ? null : ev)} className={`rounded-xl border p-4 cursor-pointer transition-colors ${isSelected ? "border-indigo-500 bg-indigo-500/5" : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="text-white text-xs font-mono font-semibold">{ev.eventName}</code>
                            <Badge className={`text-[9px] border ${catColors[ev.category] ?? catColors.Custom}`}>{ev.category}</Badge>
                            {ev.isSystem && <Badge className="text-[9px] border border-zinc-700 text-zinc-500">system</Badge>}
                            {!ev.active && <Badge className="text-[9px] border border-zinc-700 text-zinc-600">inactive</Badge>}
                          </div>
                          <p className="text-zinc-500 text-[11px] mt-1">{ev.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          {boundFlow ? (
                            <div className="space-y-0.5">
                              <p className="text-green-400 text-[10px]">→ {boundFlow.name}</p>
                              <p className="text-zinc-600 text-[10px]">{nodeCount} nodes · {boundFlow.device}</p>
                            </div>
                          ) : (
                            <p className="text-zinc-600 text-[10px]">unbound</p>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3" onClick={e => e.stopPropagation()}>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] text-zinc-500 mb-1">Bound Flow</label>
                              <select value={ev.flowId ?? ""} onChange={e => bindFlow(ev.id, e.target.value || null)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500">
                                <option value="">— not bound —</option>
                                {flows.map(f => <option key={f.id} value={f.id}>{f.name} ({f.device})</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] text-zinc-500 mb-1">Webhook URL (on completion)</label>
                              <input value={ev.webhookUrl} onChange={e => setWebhook(ev.id, e.target.value)} placeholder="https://your-app.io/webhooks/uth" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500" />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setShowSpec(true); }} className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 rounded-lg px-3 py-1.5 cursor-pointer">View API Spec</button>
                            {boundFlow && <button onClick={() => { onRunWalkthrough(boundFlow.id); }} className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 border border-green-500/30 rounded-lg px-3 py-1.5 cursor-pointer"><Play className="w-3 h-3" /> Run Walkthrough</button>}
                            <button onClick={() => toggleActive(ev.id)} className="text-xs text-zinc-500 hover:text-white border border-zinc-700 rounded-lg px-3 py-1.5 cursor-pointer">{ev.active ? "Deactivate" : "Activate"}</button>
                            {!ev.isSystem && <button onClick={() => deleteEvent(ev.id)} className="text-xs text-red-400 hover:text-red-300 border border-red-500/30 rounded-lg px-3 py-1.5 cursor-pointer ml-auto"><Trash2 className="w-3 h-3" /></button>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mt-2">
          <p className="text-xs font-semibold text-white mb-2">How it works</p>
          <ol className="space-y-2 text-xs text-zinc-400 list-decimal list-inside leading-relaxed">
            <li>Your client app fires an event (e.g. <code className="text-indigo-300 font-mono">login</code>) to UTH with the user ID and context.</li>
            <li>UTH looks up the bound flow for that event and creates a session (<code className="text-indigo-300 font-mono">sessionId</code>).</li>
            <li>UTH returns the first <code className="text-indigo-300 font-mono">screen</code> object describing what data to collect, the screen type, and whether it&apos;s optional.</li>
            <li>Your client renders the screen, collects the data, and <code className="text-indigo-300 font-mono">POST</code>s it back to UTH.</li>
            <li>UTH validates the data, stores relevant fields, and returns the next screen — or a <code className="text-indigo-300 font-mono">gateway</code> for branching, or <code className="text-indigo-300 font-mono">completed</code> with the full payload.</li>
            <li>If a webhook URL is set, UTH calls it on flow completion with the collected data and the outcome.</li>
          </ol>
        </div>
      </div>

      {showSpec && selected && (
        <ApiSpecModal event={selected} flow={selected.flowId ? flowMap[selected.flowId] ?? null : null} steps={steps} onClose={() => setShowSpec(false)} />
      )}

      {showAddEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-3">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-white font-bold">Add Custom Event</h3>
              <button onClick={() => setShowAddEvent(false)} className="text-zinc-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Event Name <span className="text-zinc-600">(dot-notation, e.g. payment.pending)</span></label>
                <input value={newEvent.eventName} onChange={e => setNewEvent(p => ({ ...p, eventName: e.target.value }))} placeholder="my.custom.event" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono" />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Category</label>
                <input value={newEvent.category} onChange={e => setNewEvent(p => ({ ...p, category: e.target.value }))} placeholder="Custom" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Description</label>
                <input value={newEvent.description} onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))} placeholder="When and why this event fires" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Trigger / Source</label>
                <input value={newEvent.trigger} onChange={e => setNewEvent(p => ({ ...p, trigger: e.target.value }))} placeholder="POST /api/your-endpoint or SDK call" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAddEvent(false)} className="text-zinc-400 hover:text-white text-sm cursor-pointer">Cancel</button>
              <button onClick={addCustomEvent} disabled={!newEvent.eventName} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm px-4 py-2 rounded-lg cursor-pointer">Add Event</button>
            </div>
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
  const [tab, setTab] = useState<"registry" | "builder" | "walkthrough" | "events">("builder");
  const [steps, setSteps] = useState<StepDef[]>(() => loadSteps());
  const [flows, setFlows] = useState<NamedFlow[]>(() => loadFlows());
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(() => flows[0]?.id ?? null);
  const [events, setEvents] = useState<EventBinding[]>(() => loadEvents());
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

  const boundCount = events.filter(e => e.flowId).length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <DashNav user={user} />
      <div className="border-b border-zinc-800 px-6 py-4 flex items-center gap-4 flex-wrap">
        <Workflow className="w-5 h-5 text-indigo-400" />
        <div>
          <h1 className="text-base font-bold text-white">Onboarding Flow Engine</h1>
          <p className="text-zinc-500 text-xs">Step registry, flow builder, event bindings, and full walkthrough simulation</p>
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-green-400" />{steps.filter(s => !s.isTerminal).length} steps</span>
          <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-orange-400" />{steps.filter(s => s.isTerminal).length} terminal screens</span>
          <span className="flex items-center gap-1"><Workflow className="w-3.5 h-3.5 text-indigo-400" />{flows.length} flows</span>
          <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-indigo-400" />{boundCount}/{events.length} events bound</span>
        </div>
      </div>
      <div className="border-b border-zinc-800 px-6 flex gap-1">
        {([["builder", "Flow Builder"], ["registry", "Step Registry"], ["events", "Event Bindings"], ["walkthrough", "Walkthrough"]] as const).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2.5 text-xs border-b-2 -mb-px cursor-pointer transition-colors ${tab === t ? "border-indigo-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>{l}</button>
        ))}
      </div>
      {tab === "registry" && <StepRegistryTab steps={steps} setSteps={setSteps} />}
      {tab === "builder" && <FlowBuilderTab steps={steps} flows={flows} setFlows={setFlows} onRunWalkthrough={id => { setSelectedFlowId(id); setTab("walkthrough"); }} />}
      {tab === "events" && <EventBindingsTab flows={flows} steps={steps} events={events} setEvents={setEvents} onRunWalkthrough={id => { setSelectedFlowId(id); setTab("walkthrough"); }} />}
      {tab === "walkthrough" && <WalkthroughTab steps={steps} flows={flows} selectedFlowId={selectedFlowId} setSelectedFlowId={setSelectedFlowId} />}
    </div>
  );
}
