"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, X, ArrowLeft, ChevronUp, ChevronDown, Trash2, Edit3,
  Check, AlertCircle, Workflow, Settings, FileText, Users, Save,
  ToggleLeft, ToggleRight, GripVertical, Copy, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DashNav } from "@/components/dash-nav";

// ── Types ─────────────────────────────────────────────────────────────────────
type FieldType = "text"|"textarea"|"dropdown"|"date"|"boolean"|"number";
type RequiredAt = "create"|"complete"|"close"|"optional";
type TriggerType = "manual"|"auto"|"transaction"|"risk_alert";
type Department = "AML"|"Onboarding"|"Compliance"|"Settlements"|"Fraud";

interface Field {
  id: string; key: string; label: string; type: FieldType;
  requiredAt: RequiredAt; options: string[]; active: boolean;
  conditionalOn: { key: string; value: string } | null; sortOrder: number;
}
interface Transition {
  id: string; from: string; to: string;
  requiresReason: boolean; notifyRoles: string[]; autoAction: string | null;
}
interface ApproverTemplate { id: string; name: string; role: string; sortOrder: number }
interface SlaConfig { slaDays: number; escalationDays: number | null; escalateTo: string | null }
interface CaseFlow {
  id: string; name: string; department: Department;
  approvalRequired: boolean; triggerType: TriggerType;
  version: number; active: boolean; createdAt: string; updatedAt: string;
  fields: Field[]; transitions: Transition[];
  approverTemplates: ApproverTemplate[]; sla: SlaConfig;
}

// ── State machine constants ───────────────────────────────────────────────────
const ALL_STATUSES = ["new","active","rfi","handoff","complete","reject","pending_approval","closed"] as const;
type Status = typeof ALL_STATUSES[number];

const ALL_POSSIBLE_TRANSITIONS: [Status, Status][] = [
  ["new","active"],["active","rfi"],["active","complete"],["active","reject"],
  ["active","handoff"],["rfi","active"],["handoff","active"],
  ["complete","pending_approval"],["complete","closed"],
  ["reject","pending_approval"],["reject","closed"],
  ["pending_approval","closed"],["pending_approval","active"],["closed","active"],
];

const STATUS_COLOR: Record<Status, string> = {
  new: "bg-zinc-700 text-zinc-200 border-zinc-500",
  active: "bg-blue-600/30 text-blue-300 border-blue-500/50",
  rfi: "bg-amber-600/30 text-amber-300 border-amber-500/50",
  handoff: "bg-purple-600/30 text-purple-300 border-purple-500/50",
  complete: "bg-green-600/30 text-green-300 border-green-500/50",
  reject: "bg-red-600/30 text-red-300 border-red-500/50",
  pending_approval: "bg-orange-600/30 text-orange-300 border-orange-500/50",
  closed: "bg-zinc-800 text-zinc-500 border-zinc-700",
};

const DEPARTMENTS: Department[] = ["AML","Onboarding","Compliance","Settlements","Fraud"];
const TRIGGER_TYPES: { value: TriggerType; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "auto", label: "Auto (System Event)" },
  { value: "transaction", label: "Transaction Flag" },
  { value: "risk_alert", label: "Risk Alert" },
];
const FIELD_TYPES: { value: FieldType; label: string; icon: string }[] = [
  { value: "text", label: "Text", icon: "Aa" },
  { value: "textarea", label: "Text Area", icon: "¶" },
  { value: "dropdown", label: "Dropdown", icon: "▼" },
  { value: "date", label: "Date", icon: "📅" },
  { value: "boolean", label: "Toggle", icon: "◉" },
  { value: "number", label: "Number", icon: "#" },
];
const REQUIRED_AT: { value: RequiredAt; label: string }[] = [
  { value: "create", label: "On Create" },
  { value: "complete", label: "On Complete" },
  { value: "close", label: "On Close" },
  { value: "optional", label: "Optional" },
];

// ── Canvas: node positions (cx, cy, w, h) ────────────────────────────────────
const NODES: Record<Status, { x: number; y: number; w: number; h: number; label: string }> = {
  new:              { x: 70,  y: 160, w: 76,  h: 34, label: "new" },
  active:           { x: 220, y: 160, w: 90,  h: 34, label: "active" },
  rfi:              { x: 180, y: 60,  w: 74,  h: 34, label: "rfi" },
  handoff:          { x: 360, y: 60,  w: 92,  h: 34, label: "handoff" },
  complete:         { x: 360, y: 160, w: 110, h: 34, label: "complete" },
  reject:           { x: 360, y: 260, w: 88,  h: 34, label: "reject" },
  pending_approval: { x: 560, y: 160, w: 152, h: 34, label: "pending approval" },
  closed:           { x: 760, y: 160, w: 82,  h: 34, label: "closed" },
};

// ── Arrow path helper ─────────────────────────────────────────────────────────
function arrowPath(from: Status, to: Status, offset = 0): string {
  const a = NODES[from], b = NODES[to];
  const ax = a.x, ay = a.y, aw = a.w, ah = a.h;
  const bx = b.x, by = b.y, bw = b.w, bh = b.h;

  // Determine exit/entry edges
  const dx = bx - ax, dy = by - ay;

  let x1: number, y1: number, x2: number, y2: number;
  let cpx: number, cpy: number;

  if (Math.abs(dx) >= Math.abs(dy)) {
    // Horizontal dominant
    if (dx > 0) {
      x1 = ax + aw / 2; y1 = ay + offset;
      x2 = bx - bw / 2; y2 = by + offset;
    } else {
      x1 = ax - aw / 2; y1 = ay + offset;
      x2 = bx + bw / 2; y2 = by + offset;
    }
    cpx = (x1 + x2) / 2; cpy = Math.min(y1, y2) - 20;
  } else {
    // Vertical dominant
    if (dy < 0) {
      x1 = ax + offset; y1 = ay - ah / 2;
      x2 = bx + offset; y2 = by + bh / 2;
    } else {
      x1 = ax + offset; y1 = ay + ah / 2;
      x2 = bx + offset; y2 = by - bh / 2;
    }
    cpx = (x1 + x2) / 2 - 20; cpy = (y1 + y2) / 2;
  }

  // Special overrides for known awkward paths
  if (from === "active" && to === "handoff") {
    x1 = ax + aw / 2 - 15; y1 = ay - ah / 2;
    x2 = bx - bw / 2; y2 = by;
    cpx = ax + aw / 2; cpy = by;
  }
  if (from === "handoff" && to === "active") {
    x1 = bx - bw / 2 + 15; y1 = ay; // swap — we draw from handoff here
    x2 = ax + aw / 2 - 15; y2 = ay - ah / 2; // wrong, recalc
    // Redo: from=handoff, to=active
    x1 = NODES.handoff.x - NODES.handoff.w / 2; y1 = NODES.handoff.y;
    x2 = NODES.active.x; y2 = NODES.active.y - NODES.active.h / 2;
    cpx = NODES.active.x + 20; cpy = NODES.handoff.y - 10;
  }
  if (from === "complete" && to === "closed") {
    x1 = NODES.complete.x + NODES.complete.w / 2; y1 = NODES.complete.y + 8;
    x2 = NODES.closed.x - NODES.closed.w / 2; y2 = NODES.closed.y + 8;
    cpx = (x1 + x2) / 2; cpy = NODES.pending_approval.y + NODES.pending_approval.h / 2 + 30;
  }
  if (from === "reject" && to === "closed") {
    x1 = NODES.reject.x + NODES.reject.w / 2; y1 = NODES.reject.y;
    x2 = NODES.closed.x - NODES.closed.w / 2; y2 = NODES.closed.y + 14;
    cpx = (x1 + x2) / 2; cpy = NODES.reject.y + 20;
  }
  if (from === "pending_approval" && to === "active") {
    x1 = NODES.pending_approval.x; y1 = NODES.pending_approval.y + NODES.pending_approval.h / 2;
    x2 = NODES.active.x; y2 = NODES.active.y + NODES.active.h / 2;
    cpx = (x1 + x2) / 2; cpy = NODES.active.y + 60;
  }
  if (from === "closed" && to === "active") {
    x1 = NODES.closed.x; y1 = NODES.closed.y + NODES.closed.h / 2;
    x2 = NODES.active.x; y2 = NODES.active.y + NODES.active.h / 2;
    cpx = (x1 + x2) / 2; cpy = NODES.active.y + 80;
  }

  return `M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`;
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function FG({ label, children, req }: { label: string; children: React.ReactNode; req?: boolean }) {
  return <div><Label className="text-zinc-400 text-[10px] mb-1 block">{label}{req && <span className="text-red-400 ml-0.5">*</span>}</Label>{children}</div>;
}
function FIn({ value, onChange, placeholder, type, disabled }: { value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean }) {
  return <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type ?? "text"} disabled={disabled}
    className="h-8 text-xs bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-indigo-500" />;
}
function FSel({ value, onChange, opts, placeholder }: { value: string; onChange: (v: string) => void; opts: { value: string; label: string }[]; placeholder?: string }) {
  return <select value={value} onChange={e => onChange(e.target.value)}
    className="w-full h-8 text-xs bg-zinc-900 border border-zinc-700 text-white rounded-md px-2 focus:border-indigo-500 outline-none">
    {placeholder && <option value="">{placeholder}</option>}
    {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>;
}
function DeptBadge({ dept }: { dept: string }) {
  const c = dept === "AML" ? "bg-red-500/10 text-red-400 border-red-500/20" : dept === "Fraud" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" : dept === "Compliance" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" : dept === "Onboarding" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-purple-500/10 text-purple-400 border-purple-500/20";
  return <Badge variant="outline" className={`text-[9px] ${c}`}>{dept}</Badge>;
}
function Spinner() { return <div className="w-4 h-4 border-2 border-white/20 border-t-indigo-500 rounded-full animate-spin" />; }

// ── Flow Canvas ───────────────────────────────────────────────────────────────
function FlowCanvas({
  flowId, transitions, onToggle, selectedTransition, onSelectTransition,
}: {
  flowId: string;
  transitions: Transition[];
  onToggle: (from: string, to: string, enabled: boolean) => void;
  selectedTransition: [string, string] | null;
  onSelectTransition: (t: [string, string] | null) => void;
}) {
  const enabledSet = new Set(transitions.map(t => `${t.from}→${t.to}`));

  return (
    <div className="relative w-full overflow-x-auto">
      <svg width={860} height={320} className="min-w-[860px]">
        <defs>
          <marker id="arrow-on" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#6366f1" />
          </marker>
          <marker id="arrow-off" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#3f3f46" />
          </marker>
          <marker id="arrow-sel" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#f59e0b" />
          </marker>
        </defs>

        {/* Draw all possible transitions */}
        {ALL_POSSIBLE_TRANSITIONS.map(([from, to]) => {
          const key = `${from}→${to}`;
          const on = enabledSet.has(key);
          const selected = selectedTransition?.[0] === from && selectedTransition?.[1] === to;
          const d = arrowPath(from, to, 0);
          const color = selected ? "#f59e0b" : on ? "#6366f1" : "#3f3f46";
          const marker = selected ? "url(#arrow-sel)" : on ? "url(#arrow-on)" : "url(#arrow-off)";
          return (
            <path
              key={key}
              d={d}
              stroke={color}
              strokeWidth={selected ? 2.5 : on ? 2 : 1.5}
              fill="none"
              markerEnd={marker}
              strokeDasharray={on ? undefined : "4 3"}
              className="cursor-pointer"
              onClick={() => {
                if (selected) { onSelectTransition(null); return; }
                onSelectTransition([from, to]);
              }}
              style={{ filter: on ? `drop-shadow(0 0 3px ${color}40)` : undefined }}
            />
          );
        })}

        {/* Draw nodes */}
        {(Object.entries(NODES) as [Status, typeof NODES[Status]][]).map(([status, n]) => {
          const colorCls = STATUS_COLOR[status];
          const inTransitions = transitions.some(t => t.from === status || t.to === status);
          return (
            <g key={status}>
              <rect
                x={n.x - n.w / 2} y={n.y - n.h / 2} width={n.w} height={n.h}
                rx={6} ry={6}
                className={`${inTransitions ? "fill-zinc-800" : "fill-zinc-900"}`}
                stroke={inTransitions ? "#6366f1" : "#52525b"}
                strokeWidth={inTransitions ? 1.5 : 1}
              />
              <text
                x={n.x} y={n.y + 4.5}
                textAnchor="middle"
                fontSize={10}
                fontFamily="monospace"
                fill={inTransitions ? "#e4e4e7" : "#71717a"}
                fontWeight={inTransitions ? "600" : "400"}
              >
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 px-1 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-indigo-500 inline-block rounded"/>Enabled</span>
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-zinc-600 inline-block rounded border-dashed" style={{borderTop:"1px dashed #52525b"}}/>Disabled</span>
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-amber-500 inline-block rounded"/>Selected</span>
        <span className="ml-auto">Click an arrow to configure it</span>
      </div>
    </div>
  );
}

// ── Transition Inspector ──────────────────────────────────────────────────────
function TransitionInspector({
  from, to, transition, flowId,
  onToggle, onUpdate,
}: {
  from: string; to: string;
  transition: Transition | undefined;
  flowId: string;
  onToggle: (from: string, to: string, enabled: boolean) => void;
  onUpdate: (from: string, to: string, patch: Partial<Transition>) => void;
}) {
  const enabled = !!transition;
  const [requiresReason, setRequiresReason] = useState(transition?.requiresReason ?? false);
  const [autoAction, setAutoAction] = useState(transition?.autoAction ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRequiresReason(transition?.requiresReason ?? false);
    setAutoAction(transition?.autoAction ?? "");
  }, [from, to, transition]);

  async function save() {
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/case-types/${flowId}/transitions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, enabled: true, requiresReason, autoAction: autoAction || null }),
      });
      if (r.ok) onUpdate(from, to, { requiresReason, autoAction: autoAction || null });
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-white text-xs font-semibold">
          <span className="font-mono px-1.5 py-0.5 bg-zinc-800 rounded text-indigo-300">{from}</span>
          <span className="mx-1 text-zinc-500">→</span>
          <span className="font-mono px-1.5 py-0.5 bg-zinc-800 rounded text-indigo-300">{to}</span>
        </h4>
        <button
          onClick={() => onToggle(from, to, !enabled)}
          className={`flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-md border transition-colors ${enabled ? "bg-green-500/10 text-green-400 border-green-500/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30" : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/30"}`}
        >
          {enabled ? <><ToggleRight className="w-3 h-3" />Enabled</> : <><ToggleLeft className="w-3 h-3" />Disabled</>}
        </button>
      </div>
      {enabled && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <div onClick={() => setRequiresReason(v => !v)}
              className={`w-8 h-4 rounded-full transition-colors relative ${requiresReason ? "bg-indigo-600" : "bg-zinc-700"}`}>
              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${requiresReason ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
            <span className="text-zinc-300 text-xs">Requires reason / comment</span>
          </label>
          <FG label="Auto Action (optional)">
            <FSel value={autoAction} onChange={setAutoAction} opts={[
              { value: "send_zoho_rfi", label: "Create Zoho RFI ticket" },
              { value: "notify_mlro", label: "Notify MLRO" },
              { value: "freeze_sla", label: "Pause SLA timer" },
            ]} placeholder="None" />
          </FG>
          <Button onClick={save} disabled={saving} size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 w-full">
            {saving ? <Spinner /> : <><Save className="w-3 h-3 mr-1" />Save Transition Config</>}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Field Editor Row ──────────────────────────────────────────────────────────
function FieldRow({
  field, flowId, allFields, onUpdate, onDelete, onMove,
}: {
  field: Field; flowId: string; allFields: Field[];
  onUpdate: (id: string, patch: Partial<Field>) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: "up" | "down") => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(field.label);
  const [ftype, setFtype] = useState<FieldType>(field.type);
  const [requiredAt, setRequiredAt] = useState<RequiredAt>(field.requiredAt);
  const [options, setOptions] = useState(field.options.join(", "));
  const [condKey, setCondKey] = useState(field.conditionalOn?.key ?? "");
  const [condVal, setCondVal] = useState(field.conditionalOn?.value ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const conditionalOn = condKey ? { key: condKey, value: condVal } : null;
      const opts = options.split(",").map(s => s.trim()).filter(Boolean);
      const r = await fetch(`/api/admin/case-types/${flowId}/fields/${field.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, type: ftype, requiredAt, options: opts, conditionalOn }),
      });
      if (r.ok) {
        onUpdate(field.id, { label, type: ftype, requiredAt, options: opts, conditionalOn });
        setEditing(false);
      }
    } finally { setSaving(false); }
  }

  async function toggleActive() {
    const r = await fetch(`/api/admin/case-types/${flowId}/fields/${field.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !field.active }),
    });
    if (r.ok) onUpdate(field.id, { active: !field.active });
  }

  const reqColor = field.requiredAt === "create" ? "text-red-400" : field.requiredAt === "complete" ? "text-amber-400" : field.requiredAt === "close" ? "text-orange-400" : "text-zinc-500";

  return (
    <div className={`border rounded-xl transition-colors ${field.active ? "border-zinc-700 bg-zinc-900/50" : "border-zinc-800 bg-zinc-900/20 opacity-60"}`}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <GripVertical className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
        <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700">{FIELD_TYPES.find(f=>f.value===field.type)?.icon ?? "?"}</span>
        <div className="flex-1 min-w-0">
          <span className="text-xs text-white font-medium">{field.label}</span>
          <span className="ml-1.5 text-[10px] text-zinc-500 font-mono">.{field.key}</span>
          {field.conditionalOn && <span className="ml-1.5 text-[10px] text-purple-400">if {field.conditionalOn.key}={field.conditionalOn.value}</span>}
        </div>
        <span className={`text-[10px] font-semibold ${reqColor}`}>{field.requiredAt}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => onMove(field.id, "up")} className="text-zinc-500 hover:text-white p-0.5 cursor-pointer"><ChevronUp className="w-3.5 h-3.5" /></button>
          <button onClick={() => onMove(field.id, "down")} className="text-zinc-500 hover:text-white p-0.5 cursor-pointer"><ChevronDown className="w-3.5 h-3.5" /></button>
          <button onClick={toggleActive} className="text-zinc-500 hover:text-white p-0.5 cursor-pointer">{field.active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}</button>
          <button onClick={() => setEditing(v => !v)} className="text-zinc-500 hover:text-indigo-400 p-0.5 cursor-pointer"><Edit3 className="w-3.5 h-3.5" /></button>
          <button onClick={async () => { if (confirm(`Delete field "${field.label}"?`)) { await fetch(`/api/admin/case-types/${flowId}/fields/${field.id}`, { method: "DELETE" }); onDelete(field.id); } }} className="text-zinc-500 hover:text-red-400 p-0.5 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {editing && (
        <div className="border-t border-zinc-800 px-3 pb-3 pt-2 grid grid-cols-2 gap-2">
          <FG label="Label" req><FIn value={label} onChange={setLabel} /></FG>
          <FG label="Field Type"><FSel value={ftype} onChange={v => setFtype(v as FieldType)} opts={FIELD_TYPES.map(f => ({ value: f.value, label: f.label }))} /></FG>
          <FG label="Required At"><FSel value={requiredAt} onChange={v => setRequiredAt(v as RequiredAt)} opts={REQUIRED_AT} /></FG>
          <FG label="Options (comma-sep)"><FIn value={options} onChange={setOptions} placeholder="Option A, Option B" /></FG>
          <FG label="Conditional On Field"><FSel value={condKey} onChange={setCondKey} opts={allFields.filter(f => f.id !== field.id && f.type === "dropdown").map(f => ({ value: f.key, label: f.label }))} placeholder="(always show)" /></FG>
          {condKey && <FG label="When value equals"><FIn value={condVal} onChange={setCondVal} placeholder="Value" /></FG>}
          <div className="col-span-2 flex gap-2 pt-1">
            <Button size="sm" onClick={save} disabled={saving} className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700">
              {saving ? <Spinner /> : <><Check className="w-3 h-3 mr-1" />Save</>}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-7 text-xs text-zinc-400">Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add Field Form ────────────────────────────────────────────────────────────
function AddFieldForm({ flowId, onAdded }: { flowId: string; onAdded: (f: Field) => void }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [ftype, setFtype] = useState<FieldType>("text");
  const [requiredAt, setRequiredAt] = useState<RequiredAt>("optional");
  const [options, setOptions] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setErr("");
    if (!key.trim() || !label.trim()) { setErr("Key and label are required"); return; }
    setSaving(true);
    try {
      const opts = options.split(",").map(s => s.trim()).filter(Boolean);
      const r = await fetch(`/api/admin/case-types/${flowId}/fields`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim().replace(/\s+/g, "_").toLowerCase(), label: label.trim(), type: ftype, requiredAt, options: opts }),
      });
      const data = await r.json();
      if (r.ok) {
        onAdded(data);
        setKey(""); setLabel(""); setFtype("text"); setRequiredAt("optional"); setOptions(""); setOpen(false);
      } else { setErr(data.error ?? "Failed"); }
    } finally { setSaving(false); }
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-indigo-400 border border-dashed border-zinc-700 hover:border-indigo-500 rounded-xl px-3 py-2 w-full transition-colors cursor-pointer">
      <Plus className="w-3.5 h-3.5" />Add Field
    </button>
  );

  return (
    <div className="border border-indigo-500/30 bg-indigo-500/5 rounded-xl p-3 space-y-2">
      <h4 className="text-xs font-semibold text-white">New Field</h4>
      {err && <p className="text-red-400 text-[10px]">{err}</p>}
      <div className="grid grid-cols-2 gap-2">
        <FG label="Field Key" req><FIn value={key} onChange={v => setKey(v)} placeholder="field_key" /></FG>
        <FG label="Label" req><FIn value={label} onChange={v => setLabel(v)} placeholder="Display Label" /></FG>
        <FG label="Field Type"><FSel value={ftype} onChange={v => setFtype(v as FieldType)} opts={FIELD_TYPES.map(f => ({ value: f.value, label: f.label }))} /></FG>
        <FG label="Required At"><FSel value={requiredAt} onChange={v => setRequiredAt(v as RequiredAt)} opts={REQUIRED_AT} /></FG>
        {(ftype === "dropdown") && <FG label="Options (comma-sep)"><FIn value={options} onChange={setOptions} placeholder="Option A, Option B" /></FG>}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={saving} className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700">
          {saving ? <Spinner /> : <><Plus className="w-3 h-3 mr-1" />Add Field</>}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} className="h-7 text-xs text-zinc-400">Cancel</Button>
      </div>
    </div>
  );
}

// ── Main Builder Inner ────────────────────────────────────────────────────────
function BuilderInner() {
  const router = useRouter();
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [flows, setFlows] = useState<CaseFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"flow" | "fields" | "approvals" | "settings">("flow");
  const [selectedTransition, setSelectedTransition] = useState<[string, string] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [showNewFlow, setShowNewFlow] = useState(false);
  const [search, setSearch] = useState("");

  // Settings form state
  const [settingsName, setSettingsName] = useState("");
  const [settingsDept, setSettingsDept] = useState<Department>("AML");
  const [settingsTrigger, setSettingsTrigger] = useState<TriggerType>("manual");
  const [settingsApproval, setSettingsApproval] = useState(false);
  const [settingsSla, setSettingsSla] = useState(5);
  const [settingsActive, setSettingsActive] = useState(true);

  // New flow form
  const [newName, setNewName] = useState("");
  const [newDept, setNewDept] = useState<Department>("Compliance");
  const [newTrigger, setNewTrigger] = useState<TriggerType>("manual");
  const [newApproval, setNewApproval] = useState(false);
  const [newSla, setNewSla] = useState(5);
  const [creating, setCreating] = useState(false);

  // Approval template form
  const [newApproverName, setNewApproverName] = useState("");
  const [newApproverRole, setNewApproverRole] = useState("");
  const [addingApprover, setAddingApprover] = useState(false);

  const fetchFlows = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/case-types");
      if (r.ok) { const data = await r.json(); setFlows(data.caseTypes ?? []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me").then(async r => {
      if (r.status === 401) { router.push("/login"); return; }
      const d = await r.json(); setUser(d.user);
    });
    fetchFlows();
  }, [fetchFlows, router]);

  const selected = flows.find(f => f.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) {
      setSettingsName(selected.name);
      setSettingsDept(selected.department);
      setSettingsTrigger(selected.triggerType);
      setSettingsApproval(selected.approvalRequired);
      setSettingsSla(selected.sla?.slaDays ?? 5);
      setSettingsActive(selected.active);
    }
  }, [selectedId, selected]);

  function updateFlow(id: string, patch: Partial<CaseFlow>) {
    setFlows(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  }

  async function saveSettings() {
    if (!selected) return;
    setSaving(true); setSaveMsg("");
    try {
      const r = await fetch(`/api/admin/case-types/${selected.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: settingsName, department: settingsDept, triggerType: settingsTrigger, approvalRequired: settingsApproval, active: settingsActive, slaDays: settingsSla }),
      });
      if (r.ok) {
        updateFlow(selected.id, { name: settingsName, department: settingsDept, triggerType: settingsTrigger, approvalRequired: settingsApproval, active: settingsActive, sla: { ...selected.sla, slaDays: settingsSla } });
        setSaveMsg("Saved");
        setTimeout(() => setSaveMsg(""), 2000);
      }
    } finally { setSaving(false); }
  }

  async function toggleTransition(from: string, to: string, enabled: boolean) {
    if (!selected) return;
    const r = await fetch(`/api/admin/case-types/${selected.id}/transitions`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, enabled }),
    });
    if (r.ok) {
      const key = `${from}→${to}`;
      if (enabled) {
        updateFlow(selected.id, { transitions: [...selected.transitions, { id: key, from, to, requiresReason: false, notifyRoles: [], autoAction: null }] });
      } else {
        updateFlow(selected.id, { transitions: selected.transitions.filter(t => !(t.from === from && t.to === to)) });
      }
    }
  }

  async function updateTransition(from: string, to: string, patch: Partial<Transition>) {
    if (!selected) return;
    updateFlow(selected.id, {
      transitions: selected.transitions.map(t => t.from === from && t.to === to ? { ...t, ...patch } : t),
    });
  }

  async function createFlow() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const r = await fetch("/api/admin/case-types", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), department: newDept, triggerType: newTrigger, approvalRequired: newApproval, slaDays: newSla }),
      });
      const data = await r.json();
      if (r.ok) {
        await fetchFlows();
        setSelectedId(data.id);
        setShowNewFlow(false);
        setNewName(""); setNewDept("Compliance"); setNewTrigger("manual"); setNewApproval(false); setNewSla(5);
      }
    } finally { setCreating(false); }
  }

  async function addApprover() {
    if (!selected || !newApproverName.trim() || !newApproverRole.trim()) return;
    setAddingApprover(true);
    try {
      const r = await fetch(`/api/admin/case-types/${selected.id}/approvers`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newApproverName.trim(), role: newApproverRole.trim() }),
      });
      const data = await r.json();
      if (r.ok) {
        updateFlow(selected.id, { approverTemplates: [...selected.approverTemplates, data] });
        setNewApproverName(""); setNewApproverRole("");
      }
    } finally { setAddingApprover(false); }
  }

  async function deleteApprover(approverId: string) {
    if (!selected) return;
    await fetch(`/api/admin/case-types/${selected.id}/approvers/${approverId}`, { method: "DELETE" });
    updateFlow(selected.id, { approverTemplates: selected.approverTemplates.filter(a => a.id !== approverId) });
  }

  async function moveApprover(approverId: string, dir: "up" | "down") {
    if (!selected) return;
    await fetch(`/api/admin/case-types/${selected.id}/approvers/${approverId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ direction: dir }),
    });
    const arr = [...selected.approverTemplates].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = arr.findIndex(a => a.id === approverId);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= arr.length) return;
    const tmp = arr[idx].sortOrder; arr[idx].sortOrder = arr[swapIdx].sortOrder; arr[swapIdx].sortOrder = tmp;
    updateFlow(selected.id, { approverTemplates: arr });
  }

  const filteredFlows = flows.filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.department.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <DashNav user={user} />
      <div className="flex h-[calc(100vh-56px)]">

        {/* ── Left Sidebar ─────────────────────────────────────────────────── */}
        <div className="w-64 shrink-0 border-r border-zinc-800 flex flex-col">
          <div className="px-4 pt-4 pb-3 border-b border-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <button onClick={() => router.push("/dashboard/cases")} className="text-zinc-500 hover:text-white cursor-pointer"><ArrowLeft className="w-4 h-4" /></button>
                <span className="text-xs font-semibold text-white">Flow Builder</span>
              </div>
              <button onClick={() => setShowNewFlow(true)} className="text-zinc-400 hover:text-white cursor-pointer p-1 hover:bg-zinc-800 rounded"><Plus className="w-4 h-4" /></button>
            </div>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search flows…"
              className="h-7 text-xs bg-zinc-900 border-zinc-700 placeholder:text-zinc-600" />
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {loading ? (
              <div className="flex justify-center pt-8"><Spinner /></div>
            ) : filteredFlows.length === 0 ? (
              <p className="text-zinc-600 text-xs text-center pt-8">No flows found</p>
            ) : filteredFlows.map(f => (
              <button key={f.id} onClick={() => { setSelectedId(f.id); setTab("flow"); setSelectedTransition(null); }}
                className={`w-full text-left px-4 py-2.5 border-b border-zinc-900 hover:bg-zinc-800/60 transition-colors cursor-pointer ${selectedId === f.id ? "bg-zinc-800 border-l-2 border-l-indigo-500" : ""}`}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${f.active ? "bg-green-500" : "bg-zinc-600"}`} />
                  <span className="text-xs text-white truncate font-medium">{f.name}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 ml-3">
                  <DeptBadge dept={f.department} />
                  <span className="text-[10px] text-zinc-500">v{f.version}</span>
                  <span className="text-[10px] text-zinc-600 ml-auto">{f.fields.length} fields</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Main Panel ───────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-zinc-500">
              <Workflow className="w-12 h-12 text-zinc-700" />
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-400">Select a case flow to edit</p>
                <p className="text-xs mt-1">or create a new one with + above</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-6 pt-4 pb-3 border-b border-zinc-800 shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <h1 className="text-sm font-bold text-white">{selected.name}</h1>
                    <div className="flex items-center gap-2 mt-0.5">
                      <DeptBadge dept={selected.department} />
                      <span className="text-[10px] text-zinc-500">v{selected.version}</span>
                      {!selected.active && <Badge variant="outline" className="text-[9px] text-zinc-500 border-zinc-700">Inactive</Badge>}
                      <span className="text-[10px] text-zinc-600">
                        {selected.transitions.length} transitions · {selected.fields.filter(f => f.active).length} fields
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] text-zinc-400 border-zinc-700 hidden sm:flex">{selected.triggerType}</Badge>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-zinc-800 shrink-0 px-6">
                {([
                  { key: "flow", label: "State Machine", icon: Workflow },
                  { key: "fields", label: "Form Fields", icon: FileText },
                  { key: "approvals", label: "Approvals", icon: Users },
                  { key: "settings", label: "Settings", icon: Settings },
                ] as const).map(({ key, label, icon: Icon }) => (
                  <button key={key} onClick={() => { setTab(key); setSelectedTransition(null); }}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs border-b-2 transition-colors cursor-pointer ${tab === key ? "border-indigo-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
                    <Icon className="w-3.5 h-3.5" />{label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-6">

                {/* ── FLOW TAB ──────────────────────────────────────────── */}
                {tab === "flow" && (
                  <div className="space-y-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                      <FlowCanvas
                        flowId={selected.id}
                        transitions={selected.transitions}
                        onToggle={toggleTransition}
                        selectedTransition={selectedTransition}
                        onSelectTransition={setSelectedTransition}
                      />
                    </div>

                    {selectedTransition && (
                      <TransitionInspector
                        from={selectedTransition[0]}
                        to={selectedTransition[1]}
                        transition={selected.transitions.find(t => t.from === selectedTransition[0] && t.to === selectedTransition[1])}
                        flowId={selected.id}
                        onToggle={toggleTransition}
                        onUpdate={updateTransition}
                      />
                    )}

                    {/* Quick stats */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Enabled transitions", value: selected.transitions.length, max: ALL_POSSIBLE_TRANSITIONS.length, color: "text-indigo-400" },
                        { label: "Require reason", value: selected.transitions.filter(t => t.requiresReason).length, max: selected.transitions.length, color: "text-amber-400" },
                        { label: "With auto actions", value: selected.transitions.filter(t => t.autoAction).length, max: selected.transitions.length, color: "text-green-400" },
                      ].map(s => (
                        <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                          <div className={`text-xl font-bold ${s.color}`}>{s.value}<span className="text-sm text-zinc-600">/{s.max}</span></div>
                          <div className="text-[10px] text-zinc-500 mt-0.5">{s.label}</div>
                          <div className="mt-2 h-1 bg-zinc-800 rounded-full">
                            <div className="h-1 rounded-full bg-indigo-600/60" style={{ width: `${s.max ? (s.value / s.max) * 100 : 0}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Transition table */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-zinc-800">
                        <span className="text-xs font-semibold text-zinc-300">All Transitions</span>
                      </div>
                      <div className="divide-y divide-zinc-800">
                        {ALL_POSSIBLE_TRANSITIONS.map(([from, to]) => {
                          const t = selected.transitions.find(tr => tr.from === from && tr.to === to);
                          const on = !!t;
                          return (
                            <div key={`${from}→${to}`} className="flex items-center gap-3 px-4 py-2 hover:bg-zinc-800/40 group">
                              <span className="text-[10px] font-mono text-zinc-400 w-28 shrink-0">{from}</span>
                              <span className="text-zinc-600 text-xs">→</span>
                              <span className="text-[10px] font-mono text-zinc-400 w-28 shrink-0">{to}</span>
                              <div className="flex items-center gap-2 ml-auto">
                                {t?.requiresReason && <span className="text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Reason req.</span>}
                                {t?.autoAction && <span className="text-[9px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">Auto</span>}
                                <button
                                  onClick={() => toggleTransition(from, to, !on)}
                                  className={`text-[10px] px-2 py-0.5 rounded border cursor-pointer transition-colors ${on ? "text-green-400 border-green-500/30 bg-green-500/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30" : "text-zinc-500 border-zinc-700 bg-zinc-800 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/30"}`}
                                >
                                  {on ? "Enabled" : "Disabled"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── FIELDS TAB ────────────────────────────────────────── */}
                {tab === "fields" && (
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-zinc-400">{selected.fields.filter(f => f.active).length} active · {selected.fields.filter(f => !f.active).length} hidden</span>
                    </div>
                    {[...selected.fields].sort((a, b) => a.sortOrder - b.sortOrder).map(field => (
                      <FieldRow
                        key={field.id}
                        field={field}
                        flowId={selected.id}
                        allFields={selected.fields}
                        onUpdate={(id, patch) => updateFlow(selected.id, { fields: selected.fields.map(f => f.id === id ? { ...f, ...patch } : f) })}
                        onDelete={(id) => updateFlow(selected.id, { fields: selected.fields.filter(f => f.id !== id) })}
                        onMove={async (fid, dir) => {
                          await fetch(`/api/admin/case-types/${selected.id}/fields/${fid}`, {
                            method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ direction: dir }),
                          });
                          const sorted = [...selected.fields].sort((a, b) => a.sortOrder - b.sortOrder);
                          const idx = sorted.findIndex(f => f.id === fid);
                          const swapIdx = dir === "up" ? idx - 1 : idx + 1;
                          if (swapIdx >= 0 && swapIdx < sorted.length) {
                            const tmp = sorted[idx].sortOrder; sorted[idx].sortOrder = sorted[swapIdx].sortOrder; sorted[swapIdx].sortOrder = tmp;
                            updateFlow(selected.id, { fields: sorted });
                          }
                        }}
                      />
                    ))}
                    <AddFieldForm flowId={selected.id} onAdded={f => updateFlow(selected.id, { fields: [...selected.fields, f] })} />
                  </div>
                )}

                {/* ── APPROVALS TAB ─────────────────────────────────────── */}
                {tab === "approvals" && (
                  <div className="max-w-2xl space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                      <div
                        onClick={() => { saveSettings(); updateFlow(selected.id, { approvalRequired: !settingsApproval }); setSettingsApproval(v => !v); }}
                        className={`w-10 h-5 rounded-full transition-colors cursor-pointer relative shrink-0 ${settingsApproval ? "bg-indigo-600" : "bg-zinc-700"}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${settingsApproval ? "translate-x-5" : "translate-x-0.5"}`} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white">Approval Required</p>
                        <p className="text-[10px] text-zinc-500">When enabled, cases must go through the approval chain before closing</p>
                      </div>
                    </div>

                    {settingsApproval && (
                      <>
                        <p className="text-[10px] text-zinc-500">Approvers are added to each new case in this order. All must approve for auto-close.</p>
                        <div className="space-y-2">
                          {[...selected.approverTemplates].sort((a, b) => a.sortOrder - b.sortOrder).map((a, idx) => (
                            <div key={a.id} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5">
                              <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-400 font-bold shrink-0">{idx + 1}</div>
                              <div className="flex-1">
                                <p className="text-xs text-white font-medium">{a.name}</p>
                                <p className="text-[10px] text-zinc-500">{a.role}</p>
                              </div>
                              <div className="flex items-center gap-1">
                                <button onClick={() => moveApprover(a.id, "up")} className="text-zinc-500 hover:text-white cursor-pointer p-0.5"><ChevronUp className="w-3.5 h-3.5" /></button>
                                <button onClick={() => moveApprover(a.id, "down")} className="text-zinc-500 hover:text-white cursor-pointer p-0.5"><ChevronDown className="w-3.5 h-3.5" /></button>
                                <button onClick={() => deleteApprover(a.id)} className="text-zinc-500 hover:text-red-400 cursor-pointer p-0.5"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="border border-dashed border-zinc-700 rounded-xl p-3 space-y-2">
                          <p className="text-[10px] font-semibold text-zinc-400">Add Approver</p>
                          <div className="grid grid-cols-2 gap-2">
                            <FG label="Name"><FIn value={newApproverName} onChange={setNewApproverName} placeholder="e.g. MLRO" /></FG>
                            <FG label="Role"><FIn value={newApproverRole} onChange={setNewApproverRole} placeholder="e.g. Chief Compliance Officer" /></FG>
                          </div>
                          <Button size="sm" onClick={addApprover} disabled={addingApprover || !newApproverName || !newApproverRole} className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700">
                            {addingApprover ? <Spinner /> : <><Plus className="w-3 h-3 mr-1" />Add Approver</>}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ── SETTINGS TAB ──────────────────────────────────────── */}
                {tab === "settings" && (
                  <div className="max-w-lg space-y-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
                      <h3 className="text-xs font-semibold text-white">Flow Settings</h3>
                      <FG label="Flow Name" req><FIn value={settingsName} onChange={setSettingsName} /></FG>
                      <FG label="Department"><FSel value={settingsDept} onChange={v => setSettingsDept(v as Department)} opts={DEPARTMENTS.map(d => ({ value: d, label: d }))} /></FG>
                      <FG label="Trigger Type"><FSel value={settingsTrigger} onChange={v => setSettingsTrigger(v as TriggerType)} opts={TRIGGER_TYPES} /></FG>
                      <FG label="Default SLA (days)"><FIn value={settingsSla} type="number" onChange={v => setSettingsSla(Number(v))} /></FG>
                      <div className="flex items-center justify-between py-1">
                        <div>
                          <p className="text-xs text-white">Active</p>
                          <p className="text-[10px] text-zinc-500">Allow new cases to be created with this flow type</p>
                        </div>
                        <div onClick={() => setSettingsActive(v => !v)}
                          className={`w-10 h-5 rounded-full transition-colors cursor-pointer relative ${settingsActive ? "bg-indigo-600" : "bg-zinc-700"}`}>
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${settingsActive ? "translate-x-5" : "translate-x-0.5"}`} />
                        </div>
                      </div>
                      <Button onClick={saveSettings} disabled={saving} className="w-full h-8 text-xs bg-indigo-600 hover:bg-indigo-700">
                        {saving ? <Spinner /> : saveMsg ? <><Check className="w-3 h-3 mr-1" />{saveMsg}</> : <><Save className="w-3 h-3 mr-1" />Save Settings</>}
                      </Button>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
                      <h3 className="text-xs font-semibold text-zinc-400">Metadata</h3>
                      {[
                        { k: "Flow ID", v: selected.id },
                        { k: "Version", v: `v${selected.version}` },
                        { k: "Created", v: new Date(selected.createdAt).toLocaleDateString() },
                        { k: "Last updated", v: new Date(selected.updatedAt).toLocaleDateString() },
                        { k: "Cases using this flow", v: "—" },
                      ].map(({ k, v }) => (
                        <div key={k} className="flex justify-between text-xs">
                          <span className="text-zinc-500">{k}</span>
                          <span className="text-zinc-300 font-mono text-[11px]">{v}</span>
                        </div>
                      ))}
                    </div>

                    <div className="bg-red-900/10 border border-red-900/30 rounded-2xl p-4 space-y-2">
                      <h3 className="text-xs font-semibold text-red-400">Danger Zone</h3>
                      <p className="text-[10px] text-zinc-500">If cases exist using this flow, it will be deactivated instead of deleted.</p>
                      <Button variant="outline" size="sm" className="h-8 text-xs border-red-900/50 text-red-400 hover:bg-red-900/20 w-full"
                        onClick={async () => {
                          if (!confirm(`Delete flow "${selected.name}"? This cannot be undone.`)) return;
                          const r = await fetch(`/api/admin/case-types/${selected.id}`, { method: "DELETE" });
                          const data = await r.json();
                          if (r.ok) {
                            if (data.deactivated) {
                              updateFlow(selected.id, { active: false });
                              alert("Flow deactivated (has existing cases)");
                            } else {
                              setFlows(prev => prev.filter(f => f.id !== selected.id));
                              setSelectedId(null);
                            }
                          }
                        }}>
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />Delete / Deactivate Flow
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── New Flow Modal ──────────────────────────────────────────────────── */}
      {showNewFlow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h3 className="text-white font-bold text-sm">New Case Flow Type</h3>
              <button onClick={() => setShowNewFlow(false)} className="text-zinc-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-3">
              <FG label="Flow Name" req><FIn value={newName} onChange={setNewName} placeholder="e.g. EDD Review" /></FG>
              <FG label="Department"><FSel value={newDept} onChange={v => setNewDept(v as Department)} opts={DEPARTMENTS.map(d => ({ value: d, label: d }))} /></FG>
              <FG label="Trigger Type"><FSel value={newTrigger} onChange={v => setNewTrigger(v as TriggerType)} opts={TRIGGER_TYPES} /></FG>
              <FG label="Default SLA Days"><FIn value={newSla} type="number" onChange={v => setNewSla(Number(v))} /></FG>
              <div className="flex items-center gap-3 py-1">
                <div onClick={() => setNewApproval(v => !v)}
                  className={`w-10 h-5 rounded-full transition-colors cursor-pointer relative ${newApproval ? "bg-indigo-600" : "bg-zinc-700"}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${newApproval ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
                <span className="text-xs text-zinc-300">Requires approval chain</span>
              </div>
              <Button onClick={createFlow} disabled={creating || !newName.trim()} className="w-full bg-indigo-600 hover:bg-indigo-700 h-9 text-sm mt-2">
                {creating ? <Spinner /> : "Create Flow →"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CasesBuilderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    }>
      <BuilderInner />
    </Suspense>
  );
}
