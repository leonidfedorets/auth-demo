"use client";
import { useEffect, useState, useMemo, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus, Search, X, Download, Clock, CheckCircle, AlertTriangle,
  ArrowRight, Paperclip, Send, Eye, FileText, AlertCircle, Check,
  XCircle, ArrowLeftRight, ChevronDown, ChevronRight, Inbox, Upload,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashNav } from "@/components/dash-nav";

// ─── TYPES ────────────────────────────────────────────────────────────────────
type CaseStatus = "new"|"active"|"rfi"|"handoff"|"complete"|"reject"|"pending_approval"|"closed";
type License = "UK"|"CA"|"MT"|"ALL";
type Department = "AML"|"Onboarding"|"Compliance"|"Settlements"|"Fraud";

interface CaseType {
  id: string; name: string; department: Department; approvalRequired: boolean;
  fields: CustomField[]; active: boolean; triggerType: string; version: number;
  priority?: string; description?: string; color?: string; allowedInitiatorRoles?: string[];
  approverTemplates?: ApproverTemplate[];
  sla?: { slaDays: number; escalationDays: number | null; escalateTo: string | null };
}
interface CustomField {
  id?: string; key: string; label: string;
  type: "text"|"textarea"|"dropdown"|"date"|"boolean"|"number"|"email"|"phone"|"url"|"currency";
  required?: boolean; requiredAt: "create"|"complete"|"close"|"optional";
  options?: string[]; active: boolean; conditionalOn?: {key:string;value:string}|null;
  sortOrder?: number;
}
interface Approver {
  id: string; name: string; role?: string; status: "pending"|"approved"|"rejected";
  comment?: string; resolvedAt?: string;
}
interface Comment { id: string; author: string; text: string; ts: string; isSystem: boolean }
interface Attachment { id: string; name: string; size: string; uploadedBy: string; ts: string; source: string; tags: string[] }
interface AuditEntry { id: string; actor: string; action: string; field: string; oldVal: string; newVal: string; ts: string; context?: string }
interface Case {
  id: string; typeId: string; typeName: string; clientId: string; clientName: string;
  department: Department; status: CaseStatus; assignee: string|null; reporter: string;
  initiation: string; trigger?: string; license: License; sla: string; slaBreached: boolean;
  description: string; resolution?: string; rejectReason?: string;
  approvers: Approver[]; customFields: Record<string,string|boolean>;
  batchId?: string; transactionId?: string; externalRefs: string[];
  audit: AuditEntry[]; comments: Comment[]; attachments: Attachment[];
  createdAt: string; updatedAt: string; closedAt?: string;
}
interface ApproverTemplate { id: string; name: string; role: string; roleId: string | null; roleColor: string | null; sortOrder: number }
interface Role { id: string; name: string; description: string; color: string; userCount: number }
interface OrgDept { id: string; name: string; description: string; headEmail: string; members: { type: "user" | "role"; ref: string }[] }
interface UserInfo { id: string; email: string; displayName: string }
interface FlowTransition { from: CaseStatus; to: CaseStatus; requiresReason: boolean }

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STATUS_META: Record<CaseStatus,{label:string;color:string}> = {
  new:             {label:"New",             color:"bg-zinc-500/15 text-zinc-400 border-zinc-600"},
  active:          {label:"Active",          color:"bg-blue-500/15 text-blue-400 border-blue-500/30"},
  rfi:             {label:"RFI",             color:"bg-amber-500/15 text-amber-400 border-amber-500/30"},
  handoff:         {label:"Handoff",         color:"bg-purple-500/15 text-purple-400 border-purple-500/30"},
  complete:        {label:"Complete",        color:"bg-green-500/15 text-green-400 border-green-500/30"},
  reject:          {label:"Rejected",        color:"bg-red-500/15 text-red-400 border-red-500/30"},
  pending_approval:{label:"Pending Approval",color:"bg-orange-500/15 text-orange-400 border-orange-500/30"},
  closed:          {label:"Closed",          color:"bg-zinc-800 text-zinc-600 border-zinc-700"},
};
const ALL_STATUSES: CaseStatus[] = ["new","active","rfi","handoff","complete","reject","pending_approval","closed"];
const FALLBACK_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  new:["active"], active:["rfi","complete","reject","handoff"], rfi:["active"], handoff:["active"],
  complete:["pending_approval","closed"], reject:["pending_approval","closed"],
  pending_approval:["closed","active"], closed:["active"],
};
const DEPARTMENTS: Department[] = ["AML","Onboarding","Compliance","Settlements","Fraud"];
const ASSIGNEES = ["Sarah K.","Tom B.","Maria L.","Anna W.","James R.","Lisa M."];
const PRIORITIES = ["low","medium","high","critical"] as const;
const PRIORITY_META: Record<string,{label:string;color:string}> = {
  low:      {label:"Low",      color:"text-zinc-400"},
  medium:   {label:"Medium",   color:"text-amber-400"},
  high:     {label:"High",     color:"text-orange-400"},
  critical: {label:"Critical", color:"text-red-400"},
};
const ROLE_COLORS = ["indigo","blue","green","red","amber","purple","teal","pink","orange","cyan"];
const COLOR_CLASSES: Record<string,string> = {
  indigo:"bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  blue:"bg-blue-500/15 text-blue-400 border-blue-500/30",
  green:"bg-green-500/15 text-green-400 border-green-500/30",
  red:"bg-red-500/15 text-red-400 border-red-500/30",
  amber:"bg-amber-500/15 text-amber-400 border-amber-500/30",
  purple:"bg-purple-500/15 text-purple-400 border-purple-500/30",
  teal:"bg-teal-500/15 text-teal-400 border-teal-500/30",
  pink:"bg-pink-500/15 text-pink-400 border-pink-500/30",
  orange:"bg-orange-500/15 text-orange-400 border-orange-500/30",
  cyan:"bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
};

const FIELD_TYPES = [
  {value:"text",label:"Text"},{value:"textarea",label:"Long Text"},
  {value:"number",label:"Number"},{value:"currency",label:"Currency"},
  {value:"date",label:"Date"},{value:"email",label:"Email"},
  {value:"phone",label:"Phone"},{value:"url",label:"URL"},
  {value:"dropdown",label:"Dropdown"},{value:"boolean",label:"Yes / No"},
];
const REQUIRED_AT_OPTS = ["create","complete","close","optional"];

// ─── SHARED UI ────────────────────────────────────────────────────────────────
function StatusBadge({status}:{status:CaseStatus}){
  const m=STATUS_META[status]; if(!m) return null;
  return <Badge variant="outline" className={`text-[10px] font-semibold whitespace-nowrap ${m.color}`}>{m.label}</Badge>;
}
function LicBadge({lic}:{lic:string}){
  const c=lic==="UK"?"bg-blue-500/15 text-blue-300 border-blue-500/30":lic==="CA"?"bg-red-500/15 text-red-300 border-red-500/30":lic==="MT"?"bg-amber-500/15 text-amber-300 border-amber-500/30":"bg-zinc-500/15 text-zinc-400 border-zinc-600";
  return <Badge variant="outline" className={`text-[10px] ${c}`}>{lic}</Badge>;
}
function DeptBadge({dept}:{dept:string}){
  const c=dept==="AML"?"bg-red-500/10 text-red-400 border-red-500/20":dept==="Fraud"?"bg-orange-500/10 text-orange-400 border-orange-500/20":dept==="Compliance"?"bg-indigo-500/10 text-indigo-400 border-indigo-500/20":dept==="Onboarding"?"bg-green-500/10 text-green-400 border-green-500/20":"bg-purple-500/10 text-purple-400 border-purple-500/20";
  return <Badge variant="outline" className={`text-[10px] ${c}`}>{dept}</Badge>;
}
function SlaChip({due,breached}:{due:string;breached:boolean}){
  const daysLeft=Math.floor((new Date(due).getTime()-Date.now())/86400000);
  if(breached) return <span className="flex items-center gap-1 text-[10px] text-red-400 font-semibold"><AlertCircle className="w-3 h-3"/>Breached</span>;
  if(daysLeft<0) return <span className="flex items-center gap-1 text-[10px] text-red-400 font-semibold"><AlertCircle className="w-3 h-3"/>Overdue</span>;
  if(daysLeft<=1) return <span className="flex items-center gap-1 text-[10px] text-amber-400"><Clock className="w-3 h-3"/>Due today</span>;
  return <span className="flex items-center gap-1 text-[10px] text-zinc-400"><Clock className="w-3 h-3"/>{daysLeft}d</span>;
}
function Modal({title,onClose,children,wide}:{title:string;onClose:()=>void;children:React.ReactNode;wide?:boolean}){
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
    <div className={`bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] w-full ${wide?"max-w-2xl":"max-w-lg"}`}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
        <h3 className="text-white font-bold text-sm">{title}</h3>
        <button onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer"><X className="w-4 h-4"/></button>
      </div>
      <div className="overflow-y-auto flex-1 p-6">{children}</div>
    </div>
  </div>;
}
function FG({label,children,req}:{label:string;children:React.ReactNode;req?:boolean}){
  return <div><Label className="text-zinc-400 text-[10px] mb-1 block">{label}{req&&<span className="text-red-400 ml-0.5">*</span>}</Label>{children}</div>;
}
function FIn({value,onChange,placeholder,type,disabled}:{value:string|number;onChange:(v:string)=>void;placeholder?:string;type?:string;disabled?:boolean}){
  return <Input type={type||"text"} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} disabled={disabled} className="bg-zinc-800 border-zinc-700 text-white text-xs h-8 disabled:opacity-50"/>;
}
function FSel({value,onChange,opts,placeholder,disabled}:{value:string;onChange:(v:string)=>void;opts:string[];placeholder?:string;disabled?:boolean}){
  return <select value={value} onChange={e=>onChange(e.target.value)} disabled={disabled} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white h-8 focus:outline-none focus:border-indigo-500 disabled:opacity-50"><option value="">{placeholder||"Select…"}</option>{opts.map(o=><option key={o} value={o}>{o}</option>)}</select>;
}
function FTa({value,onChange,placeholder,rows}:{value:string;onChange:(v:string)=>void;placeholder?:string;rows?:number}){
  return <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows||3} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"/>;
}
function Spinner(){return <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"/>;}
function ErrBox({msg,onRetry}:{msg:string;onRetry?:()=>void}){
  return <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0"/>{msg}{onRetry&&<button className="ml-auto underline cursor-pointer" onClick={onRetry}>Retry</button>}</div>;
}
function SectionDivider({label}:{label:string}){
  return <div className="flex items-center gap-3 mt-5 mb-3 pt-4 border-t border-zinc-800/60">
    <p className="text-xs font-semibold text-zinc-300 whitespace-nowrap">{label}</p>
    <div className="flex-1 h-px bg-zinc-800"/>
  </div>;
}

// ─── CREATE CASE MODAL ────────────────────────────────────────────────────────
interface BulkClient { id: string; name: string }

function CreateCaseModal({onClose,onCreate,defaultTransactionId,caseTypes}:{onClose:()=>void;onCreate:(id:string)=>void;defaultTransactionId?:string;caseTypes:CaseType[]}){
  const [step,setStep]=useState(1);
  const [typeId,setTypeId]=useState("");
  // single client
  const [clientId,setClientId]=useState("");
  const [clientName,setClientName]=useState("");
  // bulk
  const [bulk,setBulk]=useState(false);
  const [bulkClients,setBulkClients]=useState<BulkClient[]>([{id:"",name:""},{id:"",name:""}]);
  // common
  const [description,setDescription]=useState("");
  const [license,setLicense]=useState("");
  const [fields,setFields]=useState<Record<string,string>>({});
  const [saving,setSaving]=useState(false);
  const [saveProgress,setSaveProgress]=useState<{done:number;total:number}|null>(null);
  const [error,setError]=useState("");
  const ctype=caseTypes.find(t=>t.id===typeId);

  useEffect(()=>{
    if(defaultTransactionId) setFields(f=>({...f,transaction_id:defaultTransactionId,review_reason:"Manual Trigger"}));
  },[defaultTransactionId]);

  function addBulkClient(){setBulkClients(prev=>[...prev,{id:"",name:""}]);}
  function updateBulkClient(i:number,field:"id"|"name",val:string){
    setBulkClients(prev=>prev.map((c,idx)=>idx===i?{...c,[field]:val}:c));
  }
  function removeBulkClient(i:number){setBulkClients(prev=>prev.filter((_,idx)=>idx!==i));}

  async function createOne(cid:string|null,cname:string|null):Promise<string>{
    const r=await fetch("/api/cases",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({typeId,clientId:cid,clientName:cname,department:ctype?.department,description,license,customFields:fields,transactionId:defaultTransactionId||null,reporter:"Sarah K."})});
    const data=await r.json();
    if(!r.ok) throw new Error(data.error||"Failed to create case");
    return data.id as string;
  }

  async function submit(){
    if(!typeId||!description||!license){setError("All required fields missing.");return;}
    setSaving(true); setError("");
    try {
      if(bulk){
        const valid=bulkClients.filter(c=>c.name.trim());
        if(valid.length===0){setError("Add at least one client name.");setSaving(false);return;}
        setSaveProgress({done:0,total:valid.length});
        let lastId="";
        for(let i=0;i<valid.length;i++){
          lastId=await createOne(valid[i].id||null,valid[i].name.trim());
          setSaveProgress({done:i+1,total:valid.length});
        }
        onCreate(lastId); onClose();
      } else {
        const id=await createOne(clientId||null,clientName||null);
        onCreate(id); onClose();
      }
    } catch(e){setError(String(e));setSaving(false);setSaveProgress(null);}
  }

  const validBulkCount=bulkClients.filter(c=>c.name.trim()).length;

  return <Modal title="Create New Case" onClose={onClose} wide>
    <div className="flex gap-2 mb-6">{[1,2,3].map(s=><div key={s} className={`flex-1 h-1 rounded-full transition-colors ${step>=s?"bg-indigo-500":"bg-zinc-700"}`}/>)}</div>
    {error&&<ErrBox msg={error}/>}

    {/* Step 1: Type */}
    {step===1&&<div className="space-y-4 mt-3">
      <p className="text-xs text-zinc-400">Select the case type to proceed.</p>
      <div className="grid gap-2">{caseTypes.filter(t=>t.active).map(t=><button data-testid={`type-opt-${t.id}`} key={t.id} onClick={()=>{setTypeId(t.id);setStep(2);}} className={`flex items-center gap-4 p-4 rounded-xl border text-left cursor-pointer transition-all ${typeId===t.id?"border-indigo-500 bg-indigo-500/10":"border-zinc-700 hover:border-zinc-600 bg-zinc-800/30"}`}>
        <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center shrink-0"><FileText className="w-4 h-4 text-indigo-400"/></div>
        <div className="flex-1 min-w-0"><p className="text-white text-xs font-semibold">{t.name}</p><p className="text-zinc-500 text-[10px]">{t.department} · v{t.version} · {t.approvalRequired?"Approval required":"No approval"}</p></div>
        <DeptBadge dept={t.department}/>
      </button>)}</div>
    </div>}

    {/* Step 2: Clients + details */}
    {step===2&&<div className="space-y-4 mt-3">
      <p className="text-xs text-zinc-500">Type: <span className="text-indigo-400 font-medium">{ctype?.name}</span></p>

      {/* Single / Bulk toggle */}
      <div className="flex rounded-lg border border-zinc-700 overflow-hidden">
        <button onClick={()=>setBulk(false)} className={`flex-1 py-2 text-xs font-medium cursor-pointer transition-colors ${!bulk?"bg-indigo-600 text-white":"bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
          Single Client
        </button>
        <button onClick={()=>setBulk(true)} className={`flex-1 py-2 text-xs font-medium cursor-pointer transition-colors flex items-center justify-center gap-1.5 ${bulk?"bg-indigo-600 text-white":"bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
          <Users className="w-3 h-3"/>Bulk Creation
        </button>
      </div>

      {!bulk&&<>
        <FG label="Client ID"><FIn value={clientId} onChange={v=>{setClientId(v);setClientName(v?`Client ${v}`:"");}} placeholder="MCH-XXXX (optional for precheck)"/></FG>
        <FG label="Client Name"><FIn value={clientName} onChange={setClientName} placeholder="Resolved from ID"/></FG>
      </>}

      {bulk&&<div className="space-y-2">
        <p className="text-[10px] text-zinc-500">One case will be cloned per client with identical content.</p>
        {bulkClients.map((c,i)=><div key={i} className="flex gap-2 items-center">
          <FIn value={c.id} onChange={v=>updateBulkClient(i,"id",v)} placeholder={`Client ID ${i+1} (opt.)`}/>
          <FIn value={c.name} onChange={v=>updateBulkClient(i,"name",v)} placeholder={`Client Name ${i+1} *`}/>
          {bulkClients.length>1&&<button onClick={()=>removeBulkClient(i)} className="text-zinc-600 hover:text-red-400 cursor-pointer shrink-0 p-1"><X className="w-3.5 h-3.5"/></button>}
        </div>)}
        <button onClick={addBulkClient} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer px-2 py-1 rounded-lg hover:bg-indigo-500/10 transition-colors">
          <Plus className="w-3 h-3"/>Add Client
        </button>
        {validBulkCount>0&&<p className="text-[10px] text-indigo-400">{validBulkCount} case{validBulkCount!==1?"s":""} will be created</p>}
      </div>}

      <FG label="License" req><FSel value={license} onChange={setLicense} opts={["UK","CA","MT"]}/></FG>
      <FG label="Description" req><FTa value={description} onChange={setDescription} placeholder="Describe the case…" rows={3}/></FG>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={()=>setStep(1)} className="border-zinc-700 text-zinc-400 h-8 text-xs">Back</Button>
        <Button data-testid="next-to-fields" onClick={()=>setStep(3)} disabled={!description||!license} className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs flex-1 disabled:opacity-50">Next — Custom Fields</Button>
      </div>
    </div>}

    {/* Step 3: Custom Fields */}
    {step===3&&ctype&&<div className="space-y-4 mt-3">
      <p className="text-xs text-zinc-500">Custom fields for <span className="text-indigo-400">{ctype.name}</span>{bulk&&<span className="ml-2 text-zinc-600">· will apply to all {validBulkCount} clients</span>}</p>
      {ctype.fields.filter(f=>f.active&&(f.requiredAt==="create"||f.requiredAt==="optional")).map(f=>{
        if(f.conditionalOn&&fields[f.conditionalOn.key]!==f.conditionalOn.value) return null;
        return <FG key={f.key} label={f.label} req={f.requiredAt==="create"}>
          {f.type==="dropdown"?<FSel value={fields[f.key]||""} onChange={v=>setFields(p=>({...p,[f.key]:v}))} opts={f.options||[]}/>
          :f.type==="textarea"?<FTa value={fields[f.key]||""} onChange={v=>setFields(p=>({...p,[f.key]:v}))}/>
          :f.type==="boolean"?<label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!fields[f.key]} onChange={e=>setFields(p=>({...p,[f.key]:String(e.target.checked)}))} className="accent-indigo-500"/><span className="text-xs text-zinc-400">{f.label}</span></label>
          :<FIn value={fields[f.key]||""} onChange={v=>setFields(p=>({...p,[f.key]:v}))}
              type={f.type==="number"||f.type==="currency"?"number":f.type==="email"?"email":f.type==="url"?"url":f.type==="date"?"date":"text"}/>}
        </FG>;
      })}
      {defaultTransactionId&&<div className="rounded-lg bg-indigo-500/10 border border-indigo-500/30 p-3 text-xs text-indigo-300">Linked to transaction <span className="font-mono font-semibold">{defaultTransactionId}</span></div>}
      {saveProgress&&<div className="rounded-lg bg-indigo-500/10 border border-indigo-500/30 p-3 text-xs text-indigo-300 flex items-center gap-2"><Spinner/>Creating case {saveProgress.done} / {saveProgress.total}…</div>}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={()=>setStep(2)} className="border-zinc-700 text-zinc-400 h-8 text-xs">Back</Button>
        <Button data-testid="submit-case" onClick={submit} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs flex-1 disabled:opacity-50">
          {saving?<span className="flex items-center gap-2"><Spinner/>{saveProgress?`${saveProgress.done}/${saveProgress.total}…`:"Creating…"}</span>
          :bulk?`Create ${validBulkCount} Case${validBulkCount!==1?"s":""}`:"Create Case"}
        </Button>
      </div>
    </div>}
  </Modal>;
}

// ─── STATUS CHANGE MODAL ──────────────────────────────────────────────────────
function StatusModal({c,onClose,onUpdate,overrideTransitions}:{c:Case;onClose:()=>void;onUpdate:(id:string,patch:Partial<Case>)=>void;overrideTransitions?:CaseStatus[]}){
  const [newStatus,setNewStatus]=useState<CaseStatus|"">("");
  const [reason,setReason]=useState("");
  const [assignee,setAssignee]=useState(c.assignee||"");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const allowed=overrideTransitions??FALLBACK_TRANSITIONS[c.status]??[];

  async function apply(){
    if(!newStatus)return;
    if((newStatus==="reject"||newStatus==="handoff")&&!reason){setError("Reason is required.");return;}
    setSaving(true); setError("");
    try {
      const body: Record<string,string>={status:newStatus};
      if(reason)body.reason=reason;
      if(newStatus==="reject")body.rejectReason=reason;
      const r=await fetch(`/api/cases/${c.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const data=await r.json();
      if(!r.ok){setError(data.error||"Failed to update.");setSaving(false);return;}
      const patch:Partial<Case>={status:newStatus as CaseStatus,updatedAt:data.updatedAt};
      if(newStatus==="active"&&assignee&&!c.assignee){
        await fetch(`/api/cases/${c.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({assignee})});
        patch.assignee=assignee;
      }
      if(newStatus==="reject")patch.rejectReason=reason;
      if(newStatus==="closed")patch.closedAt=new Date().toISOString().slice(0,16).replace("T"," ");
      onUpdate(c.id,patch); onClose();
    } catch(e){setError(String(e));}
    setSaving(false);
  }

  return <Modal title={`Change Status — ${c.id}`} onClose={onClose}>
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs"><StatusBadge status={c.status}/><ArrowRight className="w-3 h-3 text-zinc-600"/><span className="text-zinc-400">Select new status</span></div>
      {error&&<ErrBox msg={error}/>}
      <div className="grid gap-2" data-testid="status-options">{allowed.map(s=><button key={s} onClick={()=>setNewStatus(s)} className={`flex items-center gap-3 p-3 rounded-xl border text-left cursor-pointer transition-all text-xs ${newStatus===s?"border-indigo-500 bg-indigo-500/10":"border-zinc-700 hover:border-zinc-600"}`}><span className="font-medium text-white">{STATUS_META[s]?.label??s}</span></button>)}</div>
      {newStatus==="active"&&!c.assignee&&<FG label="Assign to" req><FSel value={assignee} onChange={setAssignee} opts={ASSIGNEES}/></FG>}
      {(newStatus==="reject"||newStatus==="handoff")&&<FG label="Reason" req><FTa value={reason} onChange={setReason} placeholder="Required…"/></FG>}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onClose} className="border-zinc-700 text-zinc-400 h-8 text-xs">Cancel</Button>
        <Button data-testid="apply-status" onClick={apply} disabled={saving||!newStatus} className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs flex-1 disabled:opacity-50">{saving?<Spinner/>:"Apply"}</Button>
      </div>
    </div>
  </Modal>;
}

// ─── HANDOFF MODAL ────────────────────────────────────────────────────────────
function HandoffModal({c,onClose,onUpdate}:{c:Case;onClose:()=>void;onUpdate:(id:string,patch:Partial<Case>)=>void}){
  const [dept,setDept]=useState("");
  const [reason,setReason]=useState("");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  async function apply(){
    if(!dept||!reason){setError("Department and reason are required.");return;}
    setSaving(true); setError("");
    try {
      const r=await fetch(`/api/cases/${c.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({department:dept,reason,status:"active"})});
      const data=await r.json();
      if(!r.ok){setError(data.error||"Failed.");setSaving(false);return;}
      onUpdate(c.id,{department:dept as Department,assignee:null,status:"active",updatedAt:data.updatedAt});
      onClose();
    } catch(e){setError(String(e));}
    setSaving(false);
  }

  return <Modal title={`Handoff Case — ${c.id}`} onClose={onClose}>
    <div className="space-y-4">
      <div className="rounded-lg bg-zinc-800 p-3 text-xs"><p className="text-zinc-500 mb-0.5">Current Department</p><p className="text-white font-medium">{c.department}</p></div>
      {error&&<ErrBox msg={error}/>}
      <FG label="Transfer to Department" req><FSel value={dept} onChange={setDept} opts={DEPARTMENTS.filter(d=>d!==c.department)}/></FG>
      <FG label="Handoff Reason" req><FTa value={reason} onChange={setReason} placeholder="Required — explain why the case is being transferred…" rows={3}/></FG>
      <p className="text-[10px] text-zinc-600">Assignee will be reset. SLA continues. Handoff recorded in Audit Log.</p>
      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onClose} className="border-zinc-700 text-zinc-400 h-8 text-xs">Cancel</Button>
        <Button onClick={apply} disabled={saving||!dept||!reason} className="bg-purple-600 hover:bg-purple-700 h-8 text-xs flex-1 disabled:opacity-50">{saving?<Spinner/>:<><ArrowLeftRight className="w-3.5 h-3.5 mr-1.5"/>Handoff</>}</Button>
      </div>
    </div>
  </Modal>;
}

// ─── RFI MODAL ────────────────────────────────────────────────────────────────
function RfiModal({c,onClose,onUpdate}:{c:Case;onClose:()=>void;onUpdate:(id:string,patch:Partial<Case>)=>void}){
  const [subject,setSubject]=useState("");
  const [body,setBody]=useState("");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  async function send(){
    if(!subject||!body){setError("Subject and message are required.");return;}
    setSaving(true); setError("");
    try {
      const r=await fetch(`/api/cases/${c.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"rfi",reason:`RFI: ${subject}`})});
      const data=await r.json();
      if(!r.ok){setError(data.error||"Failed.");setSaving(false);return;}
      onUpdate(c.id,{status:"rfi",updatedAt:data.updatedAt});
      onClose();
    } catch(e){setError(String(e));}
    setSaving(false);
  }

  return <Modal title={`Send RFI — ${c.id}`} onClose={onClose}>
    <div className="space-y-4">
      <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-300 flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5"/>SLA pauses until client responds. Case status moves to RFI. Zoho ticket created automatically.</div>
      {error&&<ErrBox msg={error}/>}
      <FG label="Subject" req><FIn value={subject} onChange={setSubject} placeholder="Request for additional information…"/></FG>
      <FG label="Message Body" req><FTa value={body} onChange={setBody} placeholder="Dear client, please provide…" rows={4}/></FG>
      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onClose} className="border-zinc-700 text-zinc-400 h-8 text-xs">Cancel</Button>
        <Button onClick={send} disabled={saving||!subject||!body} className="bg-amber-600 hover:bg-amber-700 h-8 text-xs flex-1 disabled:opacity-50">{saving?<Spinner/>:<><Send className="w-3.5 h-3.5 mr-1.5"/>Send & Pause SLA</>}</Button>
      </div>
    </div>
  </Modal>;
}

// ─── BULK PANEL ───────────────────────────────────────────────────────────────
function BulkPanel({selected,onClear,onBulkDone}:{selected:string[];onClear:()=>void;onBulkDone:()=>void}){
  const [action,setAction]=useState("");
  const [assignee,setAssignee]=useState("");
  const [newDept,setNewDept]=useState("");
  const [reason,setReason]=useState("");
  const [saving,setSaving]=useState(false);
  const [result,setResult]=useState<string|null>(null);

  async function apply(){
    if(!action||saving)return;
    setSaving(true);
    let applied=0;
    for(const id of selected){
      try {
        if(action==="assign"&&assignee){await fetch(`/api/cases/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({assignee})});applied++;}
        else if(action==="handoff"&&newDept&&reason){await fetch(`/api/cases/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({department:newDept,reason,status:"active"})});applied++;}
      } catch{}
    }
    if(action==="export") applied=selected.length;
    setResult(`Applied to ${applied} of ${selected.length} cases.`);
    setSaving(false); onBulkDone();
  }

  return <div className="sticky bottom-0 bg-zinc-950/95 backdrop-blur border-t border-zinc-800 px-6 py-3 flex items-center gap-4 z-30">
    <span className="text-xs text-white font-semibold">{selected.length} selected</span>
    <FSel value={action} onChange={v=>{setAction(v);setResult(null);}} opts={["assign","handoff","export"]} placeholder="Bulk action…"/>
    {action==="assign"&&<FSel value={assignee} onChange={setAssignee} opts={ASSIGNEES} placeholder="Assign to…"/>}
    {action==="handoff"&&<><FSel value={newDept} onChange={setNewDept} opts={DEPARTMENTS} placeholder="Department…"/><Input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason…" className="bg-zinc-800 border-zinc-700 text-white text-xs h-8 w-40"/></>}
    {result?<span className="text-xs text-green-400">{result}</span>:<Button onClick={apply} disabled={!action||saving} className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs disabled:opacity-50">{saving?<Spinner/>:"Apply"}</Button>}
    <button onClick={onClear} className="text-zinc-500 hover:text-white cursor-pointer ml-auto"><X className="w-4 h-4"/></button>
  </div>;
}

// ─── ACTIVITY FEED ────────────────────────────────────────────────────────────
function ActivityFeed({c,onCommentAdded}:{c:Case;onCommentAdded:(comment:Comment)=>void}){
  const [tab,setTab]=useState("all");
  const [comment,setComment]=useState("");
  const [posting,setPosting]=useState(false);

  const feed=useMemo(()=>{
    if(tab==="comments")return c.comments.filter(x=>!x.isSystem);
    if(tab==="audit")return c.audit.map(a=>({id:a.id,author:a.actor,text:`${a.action}: ${a.field} ${a.oldVal}→${a.newVal}${a.context?` (${a.context})`:""} `,ts:a.ts,isSystem:true}));
    if(tab==="zoho")return c.comments.filter(x=>x.isSystem&&x.text.toLowerCase().includes("zoho"));
    return c.comments;
  },[tab,c]);

  async function postComment(){
    if(!comment.trim()||posting)return;
    setPosting(true);
    try {
      const r=await fetch(`/api/cases/${c.id}/comments`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:comment.trim()})});
      if(r.ok){const data=await r.json();onCommentAdded(data);setComment("");}
    } catch{}
    setPosting(false);
  }

  return <div className="space-y-3">
    <div className="flex gap-0 border-b border-zinc-800">{[["all","All"],["comments","Comments"],["audit","Audit Log"],["zoho","Zoho"]].map(([id,label])=><button key={id} onClick={()=>setTab(id)} className={`px-4 py-2 text-xs font-medium border-b-2 cursor-pointer transition-colors ${tab===id?"border-indigo-500 text-indigo-400":"border-transparent text-zinc-500 hover:text-zinc-300"}`}>{label}</button>)}</div>
    {tab==="zoho"&&c.externalRefs.length>0&&<div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3 text-xs text-blue-300">Linked: {c.externalRefs.join(", ")}</div>}
    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
      {feed.map(e=><div key={e.id} className={`rounded-lg p-3 text-xs ${e.isSystem?"bg-zinc-800/40 border border-zinc-800":"bg-zinc-800/70 border border-zinc-700"}`}>
        <div className="flex items-center justify-between mb-1"><span className={`font-medium ${e.isSystem?"text-zinc-500":"text-zinc-200"}`}>{e.author}</span><span className="text-zinc-600">{e.ts}</span></div>
        <p className={e.isSystem?"text-zinc-500":"text-zinc-300"}>{e.text}</p>
      </div>)}
      {feed.length===0&&<p className="text-zinc-600 text-xs text-center py-4">No entries</p>}
    </div>
    {(tab==="all"||tab==="comments")&&<div className="flex gap-2 pt-1 border-t border-zinc-800">
      <Input data-testid="comment-input" value={comment} onChange={e=>setComment(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();postComment();}}} placeholder="Add a comment (Enter to send)…" className="bg-zinc-800 border-zinc-700 text-white text-xs h-8 flex-1"/>
      <Button size="sm" data-testid="comment-send" className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs" onClick={postComment} disabled={posting||!comment.trim()}>{posting?<Spinner/>:<Send className="w-3 h-3"/>}</Button>
    </div>}
  </div>;
}

// ─── CASE DETAIL DRAWER ───────────────────────────────────────────────────────
function CaseDetail({caseId,onClose,onUpdate,caseTypes,allUsers}:{caseId:string;onClose:()=>void;onUpdate:(id:string,patch:Partial<Case>)=>void;caseTypes:CaseType[];allUsers:UserInfo[]}){
  const [c,setC]=useState<Case|null>(null);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState("details");
  const [showStatus,setShowStatus]=useState(false);
  const [showHandoff,setShowHandoff]=useState(false);
  const [showRfi,setShowRfi]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [uploadError,setUploadError]=useState("");
  const [allowedTransitions,setAllowedTransitions]=useState<CaseStatus[]|null>(null);
  const [assigneeInput,setAssigneeInput]=useState("");
  const [savingAssignee,setSavingAssignee]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);

  const fetchCase=useCallback(async()=>{
    setLoading(true);
    try{const r=await fetch(`/api/cases/${caseId}`);if(r.ok){const d=await r.json();setC(d.case);}}catch{}
    setLoading(false);
  },[caseId]);

  useEffect(()=>{fetchCase();},[fetchCase]);

  // Fetch per-case-type transitions when case or type changes
  useEffect(()=>{
    if(!c?.typeId||!c?.status)return;
    fetch(`/api/admin/case-types/${c.typeId}/transitions`)
      .then(r=>r.json())
      .then(d=>{
        const ts:(Array<{from:string;to:string}>)=d.transitions||[];
        const allowed=ts.filter(t=>t.from===c.status).map(t=>t.to as CaseStatus);
        setAllowedTransitions(allowed.length>0?allowed:null);
      })
      .catch(()=>{});
  },[c?.typeId,c?.status]);

  async function handleFileUpload(file:File){
    if(file.size>7_500_000){setUploadError("File too large (max 7.5 MB).");return;}
    setUploading(true); setUploadError("");
    try {
      const buf=await file.arrayBuffer();
      const bytes=new Uint8Array(buf);
      let binary="";
      for(let i=0;i<bytes.byteLength;i++) binary+=String.fromCharCode(bytes[i]);
      const base64=btoa(binary);
      const r=await fetch(`/api/cases/${caseId}/attachments`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({name:file.name,size:`${(file.size/1024).toFixed(1)} KB`,mimeType:file.type,data:base64}),
      });
      if(r.ok) fetchCase();
      else{const d=await r.json();setUploadError(d.error||"Upload failed");}
    } catch(e){setUploadError(String(e));}
    setUploading(false);
    if(fileRef.current) fileRef.current.value="";
  }

  function handleUpdate(id:string,patch:Partial<Case>){setC(prev=>prev?{...prev,...patch}:null);onUpdate(id,patch);}
  function addComment(comment:Comment){setC(prev=>prev?{...prev,comments:[...prev.comments,comment]}:null);}

  async function saveAssignee(email:string){
    if(!email)return;
    setSavingAssignee(true);
    try{
      const r=await fetch(`/api/cases/${caseId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({assignee:email})});
      if(r.ok){handleUpdate(caseId,{assignee:email});setAssigneeInput("");}
    }catch{}
    setSavingAssignee(false);
  }

  const ctype=caseTypes.find(t=>t.id===c?.typeId);
  const approvedCount=c?.approvers.filter(a=>a.status==="approved").length??0;
  const allApproved=(c?.approvers.length??0)>0&&(c?.approvers.every(a=>a.status!=="pending")??false);

  if(loading)return <div className="fixed inset-0 z-40 flex items-start justify-end bg-black/50">
    <div className="bg-zinc-900 border-l border-zinc-800 w-full max-w-2xl h-full flex items-center justify-center"><Spinner/></div>
  </div>;
  if(!c)return null;

  return <>
    <div className="fixed inset-0 z-40 flex items-start justify-end bg-black/50" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="bg-zinc-900 border-l border-zinc-800 w-full max-w-2xl h-full overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10 shrink-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-indigo-400 text-sm font-bold" data-testid="drawer-case-id">{c.id}</span>
                <StatusBadge status={c.status}/><LicBadge lic={c.license}/><DeptBadge dept={c.department}/>
              </div>
              <p className="text-white font-semibold">{c.typeName}</p>
              <p className="text-zinc-400 text-xs mt-0.5">{c.clientName||"(No client)"}{c.clientId&&<span className="font-mono text-zinc-600 ml-1">{c.clientId}</span>}</p>
            </div>
            <button data-testid="close-drawer" onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer shrink-0"><X className="w-4 h-4"/></button>
          </div>
          <div className="flex items-center gap-3 flex-wrap text-[10px]">
            {c.sla&&<SlaChip due={c.sla} breached={c.slaBreached}/>}
            <span className="text-zinc-600">Assignee: <span className="text-zinc-400">{c.assignee||"Unassigned"}</span></span>
            <span className="text-zinc-600">Reporter: <span className="text-zinc-400">{c.reporter}</span></span>
            {c.transactionId&&<span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">TXN: {c.transactionId}</span>}
          </div>
          {c.status!=="closed"&&<div className="flex gap-2 mt-3 flex-wrap">
            <Button size="sm" variant="outline" data-testid="change-status-btn" onClick={()=>setShowStatus(true)} className="border-zinc-700 text-zinc-300 h-7 text-[11px]"><ArrowRight className="w-3 h-3 mr-1"/>Change Status</Button>
            {c.status==="active"&&<>
              <Button size="sm" variant="outline" data-testid="rfi-btn" onClick={()=>setShowRfi(true)} className="border-amber-500/40 text-amber-400 h-7 text-[11px]"><Send className="w-3 h-3 mr-1"/>RFI</Button>
              <Button size="sm" variant="outline" data-testid="handoff-btn" onClick={()=>setShowHandoff(true)} className="border-purple-500/40 text-purple-400 h-7 text-[11px]"><ArrowLeftRight className="w-3 h-3 mr-1"/>Handoff</Button>
            </>}
          </div>}
        </div>

        {/* Tabs */}
        <div className="flex gap-0 px-6 border-b border-zinc-800 shrink-0 overflow-x-auto" style={{scrollbarWidth:"none"}}>
          {[["details","Details"],["activity","Activity"],["docs","Documents"],["approvals","Approvals"]].map(([id,label])=>
            <button key={id} onClick={()=>setTab(id)} data-testid={`drawer-tab-${id}`} className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 cursor-pointer transition-colors ${tab===id?"border-indigo-500 text-indigo-400":"border-transparent text-zinc-500 hover:text-zinc-300"}`}>
              {label}{id==="approvals"&&c.approvers.length>0&&<span className="ml-1 text-[9px] bg-zinc-700 px-1 rounded-full">{approvedCount}/{c.approvers.length}</span>}
              {id==="docs"&&c.attachments.length>0&&<span className="ml-1 text-[9px] bg-zinc-700 px-1 rounded-full">{c.attachments.length}</span>}
            </button>
          )}
        </div>

        {/* Tab content */}
        <div className="p-6 flex-1 space-y-4">
          {tab==="details"&&<>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
              <p className="text-xs font-semibold text-white mb-2">Description</p>
              <p className="text-zinc-300 text-xs leading-relaxed">{c.description}</p>
            </div>
            {/* Assignee selector */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs font-semibold text-white mb-3 flex items-center gap-2"><Users className="w-3.5 h-3.5 text-zinc-400"/>Assignment</p>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1">
                  <p className="text-[10px] text-zinc-500 mb-0.5">Current Assignee</p>
                  <p className="text-xs text-zinc-200 font-medium">{c.assignee||<span className="text-zinc-600 italic">Unassigned</span>}</p>
                </div>
                {c.assignee&&<button onClick={()=>saveAssignee("")} disabled={savingAssignee} className="text-xs text-zinc-500 hover:text-red-400 cursor-pointer px-2 py-1 rounded hover:bg-zinc-800 transition-colors disabled:opacity-50">Unassign</button>}
              </div>
              <div className="flex gap-2">
                {allUsers.length>0
                  ?<>
                    <select value={assigneeInput} onChange={e=>setAssigneeInput(e.target.value)} className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white h-8 focus:outline-none focus:border-indigo-500">
                      <option value="">Select user…</option>
                      {allUsers.map(u=><option key={u.email} value={u.email}>{u.displayName||u.email}</option>)}
                    </select>
                    <Button onClick={()=>saveAssignee(assigneeInput)} disabled={savingAssignee||!assigneeInput} className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs px-3 shrink-0 disabled:opacity-50">
                      {savingAssignee?<Spinner/>:"Assign"}
                    </Button>
                  </>
                  :<>
                    <FIn value={assigneeInput} onChange={setAssigneeInput} placeholder="Enter name or email…"/>
                    <Button onClick={()=>saveAssignee(assigneeInput)} disabled={savingAssignee||!assigneeInput.trim()} className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs px-3 shrink-0 disabled:opacity-50">
                      {savingAssignee?<Spinner/>:"Assign"}
                    </Button>
                  </>
                }
              </div>
            </div>
            {c.resolution&&<div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4"><p className="text-xs font-semibold text-green-400 mb-1">Resolution</p><p className="text-zinc-300 text-xs">{c.resolution}</p></div>}
            {c.rejectReason&&<div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4"><p className="text-xs font-semibold text-red-400 mb-1">Rejection Reason</p><p className="text-zinc-300 text-xs">{c.rejectReason}</p></div>}
            {ctype&&ctype.fields.filter(f=>f.active).length>0&&<div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs font-semibold text-white mb-3">Custom Fields</p>
              <div className="space-y-1.5">{ctype.fields.filter(f=>f.active).map(f=><div key={f.key} className="flex items-start justify-between gap-4 py-1.5 border-b border-zinc-800/50 last:border-0">
                <span className="text-zinc-500 text-xs shrink-0">{f.label}</span>
                <span className="text-xs text-zinc-200 text-right font-mono">{String(c.customFields[f.key]||"—")}</span>
              </div>)}</div>
            </div>}
            <div className="rounded-xl border border-zinc-800 p-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
              {[["Case ID",c.id],["Type",c.typeName],["Initiation",c.initiation+(c.trigger?` (${c.trigger})`:"")],["Created",c.createdAt],["Updated",c.updatedAt],c.closedAt?["Closed",c.closedAt]:["SLA Due",c.sla],["Version",`v${ctype?.version||1}`]].map(([k,v])=><div key={k}><span className="text-zinc-500">{k}: </span><span className="text-zinc-200">{String(v)}</span></div>)}
            </div>
          </>}

          {tab==="activity"&&<ActivityFeed c={c} onCommentAdded={addComment}/>}

          {tab==="docs"&&<div className="space-y-2">
            <input ref={fileRef} type="file" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)handleFileUpload(f);}}/>
            {uploadError&&<ErrBox msg={uploadError}/>}
            {c.attachments.length===0&&!uploading&&<div className="rounded-xl border border-dashed border-zinc-700 p-8 text-center">
              <Upload className="w-8 h-8 text-zinc-600 mx-auto mb-2"/>
              <p className="text-zinc-500 text-xs mb-3">No documents attached to this case</p>
              <Button variant="outline" size="sm" className="border-zinc-600 text-zinc-400 h-7 text-xs" onClick={()=>fileRef.current?.click()}>
                <Paperclip className="w-3 h-3 mr-1.5"/>Upload First Document
              </Button>
            </div>}
            {c.attachments.map(a=><div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 hover:bg-zinc-800/30 group">
              <Paperclip className="w-4 h-4 text-zinc-500 shrink-0"/>
              <div className="flex-1 min-w-0">
                <p className="text-zinc-200 text-xs font-medium truncate">{a.name}</p>
                <p className="text-zinc-600 text-[10px]">{a.size}{a.size&&" · "}{a.uploadedBy} · {a.ts}{a.source==="upload"?"":" · "+a.source}</p>
                {a.tags.length>0&&<div className="flex gap-1 mt-1">{a.tags.map(t=><span key={t} className="text-[9px] bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded">{t}</span>)}</div>}
              </div>
              <a href={`/api/cases/${c.id}/attachments/${a.id}`} download={a.name} className="text-indigo-400 hover:text-indigo-300 cursor-pointer shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" title="Download">
                <Download className="w-3.5 h-3.5"/>
              </a>
            </div>)}
            {c.attachments.length>0&&<Button variant="outline" size="sm" className="border-zinc-700 text-zinc-400 h-7 text-xs w-full mt-1" onClick={()=>fileRef.current?.click()} disabled={uploading}>
              {uploading?<span className="flex items-center gap-1.5"><Spinner/>Uploading…</span>:<><Upload className="w-3 h-3 mr-1.5"/>Upload Document</>}
            </Button>}
          </div>}

          {tab==="approvals"&&<div className="space-y-3">
            {c.approvers.length===0&&<p className="text-zinc-500 text-xs text-center py-4">No approval required for this case.</p>}
            {c.approvers.map(a=><div key={a.id} className={`rounded-xl border p-4 ${a.status==="approved"?"border-green-500/30 bg-green-500/5":a.status==="rejected"?"border-red-500/30 bg-red-500/5":"border-zinc-700 bg-zinc-800/30"}`}>
              <div className="flex items-center justify-between mb-1">
                <div><p className="text-white text-xs font-semibold">{a.name}</p>{a.role&&<p className="text-zinc-500 text-[10px]">{a.role}</p>}</div>
                {a.status==="approved"?<span className="flex items-center gap-1 text-xs text-green-400"><Check className="w-3.5 h-3.5"/>Approved</span>
                :a.status==="rejected"?<span className="flex items-center gap-1 text-xs text-red-400"><XCircle className="w-3.5 h-3.5"/>Rejected</span>
                :<span className="text-xs text-zinc-500">Pending</span>}
              </div>
              {a.resolvedAt&&<p className="text-[10px] text-zinc-600">{a.resolvedAt}</p>}
              {a.status==="pending"&&<div className="flex gap-2 mt-3">
                <Button size="sm" className="bg-green-600 hover:bg-green-700 h-7 text-[11px] flex-1" onClick={async()=>{const r=await fetch(`/api/cases/${c.id}/approvals/${a.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({decision:"approved"})});if(r.ok)fetchCase();}}><Check className="w-3 h-3 mr-1"/>Approve</Button>
                <Button size="sm" variant="outline" className="border-red-500/40 text-red-400 h-7 text-[11px] flex-1" onClick={async()=>{const r=await fetch(`/api/cases/${c.id}/approvals/${a.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({decision:"rejected"})});if(r.ok)fetchCase();}}><XCircle className="w-3 h-3 mr-1"/>Reject</Button>
              </div>}
            </div>)}
            {c.status==="pending_approval"&&allApproved&&<Button className="w-full bg-green-600 hover:bg-green-700 h-8 text-xs mt-2" onClick={async()=>{const r=await fetch(`/api/cases/${c.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"closed"})});if(r.ok)fetchCase();}}><CheckCircle className="w-3.5 h-3.5 mr-1.5"/>All Approved — Close Case</Button>}
          </div>}
        </div>
      </div>
    </div>
    {showStatus&&<StatusModal c={c} onClose={()=>setShowStatus(false)} overrideTransitions={allowedTransitions??undefined} onUpdate={(id,patch)=>{handleUpdate(id,patch);setShowStatus(false);}}/>}
    {showHandoff&&<HandoffModal c={c} onClose={()=>setShowHandoff(false)} onUpdate={(id,patch)=>{handleUpdate(id,patch);setShowHandoff(false);}}/>}
    {showRfi&&<RfiModal c={c} onClose={()=>setShowRfi(false)} onUpdate={(id,patch)=>{handleUpdate(id,patch);setShowRfi(false);}}/>}
  </>;
}

function RoleBadge({name,color}:{name:string;color?:string|null}){
  const cls=COLOR_CLASSES[color??"indigo"]??COLOR_CLASSES.indigo;
  return <Badge variant="outline" className={`text-[10px] ${cls}`}>{name}</Badge>;
}

// ─── ROLES PANEL ──────────────────────────────────────────────────────────────
function RolesPanel(){
  const [roles,setRoles]=useState<Role[]>([]);
  const [loading,setLoading]=useState(true);
  const [expanded,setExpanded]=useState<string|null>(null);
  const [members,setMembers]=useState<Record<string,{email:string;assignedAt:string}[]>>({});
  const [showCreate,setShowCreate]=useState(false);
  const [editRole,setEditRole]=useState<Role|null>(null);
  const [deletingId,setDeletingId]=useState<string|null>(null);
  const [newEmail,setNewEmail]=useState("");
  const [addingTo,setAddingTo]=useState<string|null>(null);
  const [err,setErr]=useState("");

  // Create/Edit modal state
  const [name,setName]=useState("");
  const [desc,setDesc]=useState("");
  const [color,setColor]=useState("indigo");
  const [saving,setSaving]=useState(false);
  const [formErr,setFormErr]=useState("");

  const fetchRoles=useCallback(()=>{
    setLoading(true);
    fetch("/api/admin/roles").then(r=>r.json()).then(d=>setRoles(d.roles||[])).finally(()=>setLoading(false));
  },[]);

  useEffect(()=>{fetchRoles();},[fetchRoles]);

  function openCreate(){setName("");setDesc("");setColor("indigo");setFormErr("");setShowCreate(true);setEditRole(null);}
  function openEdit(r:Role){setName(r.name);setDesc(r.description);setColor(r.color);setFormErr("");setEditRole(r);setShowCreate(true);}

  async function saveRole(){
    if(!name.trim()){setFormErr("Name required.");return;}
    setSaving(true);setFormErr("");
    const url=editRole?`/api/admin/roles/${editRole.id}`:"/api/admin/roles";
    const method=editRole?"PUT":"POST";
    try{
      const r=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify({name:name.trim(),description:desc,color})});
      if(r.ok){setShowCreate(false);fetchRoles();}
      else{const d=await r.json();setFormErr(d.error||"Failed");}
    }catch(e){setFormErr(String(e));}
    setSaving(false);
  }

  async function deleteRole(id:string){
    await fetch(`/api/admin/roles/${id}`,{method:"DELETE"});
    setDeletingId(null);fetchRoles();
  }

  async function loadMembers(id:string){
    const r=await fetch(`/api/admin/roles/${id}/members`);
    const d=await r.json();
    setMembers(m=>({...m,[id]:d.members||[]}));
  }

  function toggleExpand(id:string){
    if(expanded===id){setExpanded(null);}
    else{setExpanded(id);loadMembers(id);}
  }

  async function addMember(roleId:string){
    if(!newEmail.trim())return;
    setErr("");
    const r=await fetch(`/api/admin/roles/${roleId}/members`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:newEmail.trim()})});
    if(r.ok){setNewEmail("");setAddingTo(null);loadMembers(roleId);}
    else{const d=await r.json();setErr(d.error||"Failed");}
  }

  async function removeMember(roleId:string,email:string){
    await fetch(`/api/admin/roles/${roleId}/members?email=${encodeURIComponent(email)}`,{method:"DELETE"});
    loadMembers(roleId);
  }

  if(loading)return <div className="flex justify-center py-12"><Spinner/></div>;

  return <>
    {showCreate&&<Modal title={editRole?"Edit Role":"New Role"} onClose={()=>setShowCreate(false)}>
      <div className="space-y-4">
        {formErr&&<ErrBox msg={formErr}/>}
        <FG label="Role Name" req><FIn value={name} onChange={setName} placeholder="e.g. MLRO"/></FG>
        <FG label="Description"><FTa value={desc} onChange={setDesc} placeholder="What this role can do…" rows={2}/></FG>
        <FG label="Color">
          <div className="flex gap-2 flex-wrap mt-1">
            {ROLE_COLORS.map(c=><button key={c} onClick={()=>setColor(c)} className={`w-6 h-6 rounded-full border-2 cursor-pointer transition-all ${color===c?"border-white scale-110":"border-transparent"} bg-${c}-500`}/>)}
          </div>
          <div className="mt-2"><RoleBadge name={name||"Preview"} color={color}/></div>
        </FG>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={()=>setShowCreate(false)} className="border-zinc-700 text-zinc-400 h-8 text-xs">Cancel</Button>
          <Button onClick={saveRole} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs flex-1 disabled:opacity-50">
            {saving?<Spinner/>:editRole?"Save Changes":"Create Role"}
          </Button>
        </div>
      </div>
    </Modal>}

    {deletingId&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <p className="text-white font-bold text-sm">Delete Role?</p>
        <p className="text-zinc-400 text-xs">Users with this role will lose it. Approver templates linked to this role will be unlinked.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={()=>setDeletingId(null)} className="border-zinc-700 text-zinc-400 h-8 text-xs flex-1">Cancel</Button>
          <Button onClick={()=>deleteRole(deletingId)} className="bg-red-600 hover:bg-red-700 h-8 text-xs flex-1">Delete</Button>
        </div>
      </div>
    </div>}

    <div className="flex items-center justify-between mb-4">
      <p className="text-xs text-zinc-500">{roles.length} roles configured</p>
      <Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs flex items-center gap-1.5"><Plus className="w-3.5 h-3.5"/>New Role</Button>
    </div>

    {roles.length===0&&<div className="text-zinc-600 text-xs text-center py-8 rounded-xl border border-dashed border-zinc-800">No roles yet. Create the first one.</div>}

    <div className="space-y-2">
      {roles.map(r=><div key={r.id} className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3.5">
          <div className={`w-2.5 h-2.5 rounded-full bg-${r.color}-400 shrink-0`}/>
          <div className="flex-1 min-w-0 cursor-pointer" onClick={()=>toggleExpand(r.id)}>
            <div className="flex items-center gap-2 flex-wrap">
              <RoleBadge name={r.name} color={r.color}/>
              <span className="text-zinc-500 text-[10px]">{r.userCount} user{r.userCount!==1?"s":""}</span>
              {r.description&&<span className="text-zinc-600 text-[10px] truncate max-w-xs">{r.description}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={()=>openEdit(r)} className="p-1.5 text-zinc-500 hover:text-indigo-400 cursor-pointer rounded-lg hover:bg-zinc-800"><FileText className="w-3.5 h-3.5"/></button>
            <button onClick={()=>setDeletingId(r.id)} className="p-1.5 text-zinc-500 hover:text-red-400 cursor-pointer rounded-lg hover:bg-zinc-800"><XCircle className="w-3.5 h-3.5"/></button>
            <button onClick={()=>toggleExpand(r.id)} className="p-1.5 text-zinc-500 cursor-pointer rounded-lg hover:bg-zinc-800">
              {expanded===r.id?<ChevronDown className="w-4 h-4"/>:<ChevronRight className="w-4 h-4"/>}
            </button>
          </div>
        </div>

        {expanded===r.id&&<div className="border-t border-zinc-800 px-5 pb-4">
          <p className="text-xs font-semibold text-zinc-300 mt-3 mb-2">Users with this role</p>
          {err&&<ErrBox msg={err}/>}
          {(members[r.id]||[]).length===0&&<p className="text-zinc-600 text-[10px] mb-2">No users assigned.</p>}
          <div className="space-y-1 mb-3">
            {(members[r.id]||[]).map(m=><div key={m.email} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-zinc-800/50 border border-zinc-800">
              <span className="text-xs text-zinc-200">{m.email}</span>
              <button onClick={()=>removeMember(r.id,m.email)} className="text-zinc-600 hover:text-red-400 cursor-pointer p-1"><X className="w-3 h-3"/></button>
            </div>)}
          </div>
          {addingTo===r.id
            ?<div className="flex gap-2">
              <FIn value={newEmail} onChange={setNewEmail} placeholder="user@example.com"/>
              <Button onClick={()=>addMember(r.id)} className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs px-3">Add</Button>
              <button onClick={()=>{setAddingTo(null);setNewEmail("");}} className="text-zinc-500 hover:text-white cursor-pointer"><X className="w-4 h-4"/></button>
            </div>
            :<button onClick={()=>setAddingTo(r.id)} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer px-2 py-1 rounded-lg hover:bg-indigo-500/10 transition-colors">
              <Plus className="w-3 h-3"/>Assign User
            </button>
          }
        </div>}
      </div>)}
    </div>
  </>;
}

// ─── DEPARTMENTS PANEL ────────────────────────────────────────────────────────
function DepartmentsPanel({allRoles}:{allRoles:Role[]}){
  const [depts,setDepts]=useState<OrgDept[]>([]);
  const [loading,setLoading]=useState(true);
  const [expanded,setExpanded]=useState<string|null>(null);
  const [showCreate,setShowCreate]=useState(false);
  const [editDept,setEditDept]=useState<OrgDept|null>(null);
  const [deletingId,setDeletingId]=useState<string|null>(null);
  const [name,setName]=useState("");
  const [desc,setDesc]=useState("");
  const [head,setHead]=useState("");
  const [saving,setSaving]=useState(false);
  const [formErr,setFormErr]=useState("");
  const [addType,setAddType]=useState<"user"|"role">("user");
  const [addRef,setAddRef]=useState("");
  const [addingTo,setAddingTo]=useState<string|null>(null);

  const fetchDepts=useCallback(()=>{
    setLoading(true);
    fetch("/api/admin/org-departments").then(r=>r.json()).then(d=>setDepts(d.departments||[])).finally(()=>setLoading(false));
  },[]);

  useEffect(()=>{fetchDepts();},[fetchDepts]);

  function openCreate(){setName("");setDesc("");setHead("");setFormErr("");setShowCreate(true);setEditDept(null);}
  function openEdit(d:OrgDept){setName(d.name);setDesc(d.description);setHead(d.headEmail);setFormErr("");setEditDept(d);setShowCreate(true);}

  async function saveDept(){
    if(!name.trim()){setFormErr("Name required.");return;}
    setSaving(true);setFormErr("");
    const url=editDept?`/api/admin/org-departments/${editDept.id}`:"/api/admin/org-departments";
    const method=editDept?"PUT":"POST";
    try{
      const r=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify({name:name.trim(),description:desc,headEmail:head})});
      if(r.ok){setShowCreate(false);fetchDepts();}
      else{const d=await r.json();setFormErr(d.error||"Failed");}
    }catch(e){setFormErr(String(e));}
    setSaving(false);
  }

  async function deleteDept(id:string){
    await fetch(`/api/admin/org-departments/${id}`,{method:"DELETE"});
    setDeletingId(null);fetchDepts();
  }

  async function addMember(deptId:string){
    if(!addRef.trim())return;
    await fetch(`/api/admin/org-departments/${deptId}/members`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:addType,ref:addRef.trim()})});
    setAddRef("");setAddingTo(null);fetchDepts();
  }

  async function removeMember(deptId:string,type:string,ref:string){
    await fetch(`/api/admin/org-departments/${deptId}/members?type=${type}&ref=${encodeURIComponent(ref)}`,{method:"DELETE"});
    fetchDepts();
  }

  if(loading)return <div className="flex justify-center py-12"><Spinner/></div>;

  return <>
    {showCreate&&<Modal title={editDept?"Edit Department":"New Department"} onClose={()=>setShowCreate(false)}>
      <div className="space-y-4">
        {formErr&&<ErrBox msg={formErr}/>}
        <FG label="Name" req><FIn value={name} onChange={setName} placeholder="e.g. AML Team"/></FG>
        <FG label="Description"><FTa value={desc} onChange={setDesc} placeholder="Responsibilities…" rows={2}/></FG>
        <FG label="Department Head (email)"><FIn value={head} onChange={setHead} placeholder="head@example.com (optional)"/></FG>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={()=>setShowCreate(false)} className="border-zinc-700 text-zinc-400 h-8 text-xs">Cancel</Button>
          <Button onClick={saveDept} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs flex-1 disabled:opacity-50">
            {saving?<Spinner/>:editDept?"Save Changes":"Create Department"}
          </Button>
        </div>
      </div>
    </Modal>}

    {deletingId&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <p className="text-white font-bold text-sm">Delete Department?</p>
        <p className="text-zinc-400 text-xs">This removes the department and all its member assignments. Case types with this department will retain their department label.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={()=>setDeletingId(null)} className="border-zinc-700 text-zinc-400 h-8 text-xs flex-1">Cancel</Button>
          <Button onClick={()=>deleteDept(deletingId)} className="bg-red-600 hover:bg-red-700 h-8 text-xs flex-1">Delete</Button>
        </div>
      </div>
    </div>}

    <div className="flex items-center justify-between mb-4">
      <p className="text-xs text-zinc-500">{depts.length} departments · members impact approval routing</p>
      <Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs flex items-center gap-1.5"><Plus className="w-3.5 h-3.5"/>New Department</Button>
    </div>

    {depts.length===0&&<div className="text-zinc-600 text-xs text-center py-8 rounded-xl border border-dashed border-zinc-800">No departments yet.</div>}

    <div className="space-y-2">
      {depts.map(d=>{
        const userMembers=d.members.filter(m=>m.type==="user");
        const roleMembers=d.members.filter(m=>m.type==="role");
        return <div key={d.id} className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3.5">
            <div className="flex-1 min-w-0 cursor-pointer" onClick={()=>setExpanded(expanded===d.id?null:d.id)}>
              <p className="text-white text-sm font-semibold">{d.name}</p>
              <div className="flex items-center gap-3 mt-0.5 text-[10px] text-zinc-500">
                {d.headEmail&&<span>Head: {d.headEmail}</span>}
                <span>{userMembers.length} user{userMembers.length!==1?"s":""}</span>
                <span>{roleMembers.length} role{roleMembers.length!==1?"s":""}</span>
                {d.description&&<span className="truncate max-w-xs">{d.description}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={()=>openEdit(d)} className="p-1.5 text-zinc-500 hover:text-indigo-400 cursor-pointer rounded-lg hover:bg-zinc-800"><FileText className="w-3.5 h-3.5"/></button>
              <button onClick={()=>setDeletingId(d.id)} className="p-1.5 text-zinc-500 hover:text-red-400 cursor-pointer rounded-lg hover:bg-zinc-800"><XCircle className="w-3.5 h-3.5"/></button>
              <button onClick={()=>setExpanded(expanded===d.id?null:d.id)} className="p-1.5 text-zinc-500 cursor-pointer rounded-lg hover:bg-zinc-800">
                {expanded===d.id?<ChevronDown className="w-4 h-4"/>:<ChevronRight className="w-4 h-4"/>}
              </button>
            </div>
          </div>

          {expanded===d.id&&<div className="border-t border-zinc-800 px-5 pb-4">
            <div className="grid sm:grid-cols-2 gap-4 mt-3">
              <div>
                <p className="text-[10px] font-semibold text-zinc-400 mb-2">Users</p>
                {userMembers.length===0&&<p className="text-zinc-600 text-[10px]">No users assigned.</p>}
                <div className="space-y-1">
                  {userMembers.map(m=><div key={m.ref} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-800">
                    <span className="text-xs text-zinc-200">{m.ref}</span>
                    <button onClick={()=>removeMember(d.id,"user",m.ref)} className="text-zinc-600 hover:text-red-400 cursor-pointer p-1"><X className="w-3 h-3"/></button>
                  </div>)}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-zinc-400 mb-2">Roles</p>
                {roleMembers.length===0&&<p className="text-zinc-600 text-[10px]">No roles assigned.</p>}
                <div className="space-y-1">
                  {roleMembers.map(m=>{
                    const role=allRoles.find(r=>r.id===m.ref);
                    return <div key={m.ref} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-800">
                      <RoleBadge name={role?.name??m.ref} color={role?.color}/>
                      <button onClick={()=>removeMember(d.id,"role",m.ref)} className="text-zinc-600 hover:text-red-400 cursor-pointer p-1"><X className="w-3 h-3"/></button>
                    </div>;
                  })}
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-zinc-800/60">
              {addingTo===d.id
                ?<div className="flex gap-2 items-center flex-wrap">
                  <select value={addType} onChange={e=>setAddType(e.target.value as "user"|"role")} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white h-8 focus:outline-none">
                    <option value="user">User</option><option value="role">Role</option>
                  </select>
                  {addType==="role"
                    ?<select value={addRef} onChange={e=>setAddRef(e.target.value)} className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white h-8 focus:outline-none">
                      <option value="">Select role…</option>
                      {allRoles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    :<FIn value={addRef} onChange={setAddRef} placeholder="user@example.com"/>
                  }
                  <Button onClick={()=>addMember(d.id)} className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs px-3">Add</Button>
                  <button onClick={()=>{setAddingTo(null);setAddRef("");}} className="text-zinc-500 hover:text-white cursor-pointer"><X className="w-4 h-4"/></button>
                </div>
                :<button onClick={()=>setAddingTo(d.id)} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer px-2 py-1 rounded-lg hover:bg-indigo-500/10">
                  <Plus className="w-3 h-3"/>Add Member
                </button>
              }
            </div>
          </div>}
        </div>;
      })}
    </div>
  </>;
}

// ─── ANALYTICS PANEL ──────────────────────────────────────────────────────────
function AnalyticsPanel(){
  const [data,setData]=useState<Record<string,unknown>|null>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{fetch("/api/cases/analytics").then(r=>r.json()).then(d=>setData(d)).catch(()=>setData(null)).finally(()=>setLoading(false));},[]);

  if(loading)return <div className="flex items-center justify-center py-16"><Spinner/></div>;
  if(!data||data.error)return <ErrBox msg="Failed to load analytics — ensure the DB migration has been run."/>;

  const byAssignee=(data.byAssignee as Array<{name:string;open:number;closed:number}>)||[];
  const byDept=(data.byDepartment as Array<{dept:string;total:number;open:number}>)||[];
  const maxOpen=Math.max(1,...byAssignee.map(b=>b.open));
  const maxTotal=Math.max(1,...byDept.map(d=>d.total));

  return <div className="space-y-5">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{[
      {label:"Open Cases",val:String(data.openCases??0),sub:"new + active + RFI",icon:Inbox,color:"text-blue-400"},
      {label:"Avg Time to Close",val:`${Number(data.avgDaysToClose??0).toFixed(1)}d`,sub:"calendar days",icon:Clock,color:"text-indigo-400"},
      {label:"SLA Met %",val:`${data.slaMetPct??100}%`,sub:"of closed cases",icon:CheckCircle,color:"text-green-400"},
      {label:"Pending Approval",val:String(data.pendingApproval??0),sub:"awaiting checker",icon:AlertCircle,color:"text-orange-400"},
    ].map(k=><div key={k.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <k.icon className={`w-4 h-4 ${k.color} mb-2`}/>
      <p className={`text-2xl font-bold ${k.color}`}>{k.val}</p>
      <p className="text-xs font-semibold text-white mt-0.5">{k.label}</p>
      <p className="text-[10px] text-zinc-600 mt-0.5">{k.sub}</p>
    </div>)}</div>
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="text-xs font-semibold text-white mb-3">Backlog by Assignee</p>
        <div className="space-y-2">{byAssignee.map(b=><div key={b.name} className="flex items-center gap-3"><span className="text-xs text-zinc-300 w-20 shrink-0">{b.name}</span><div className="flex-1 h-1.5 rounded-full bg-zinc-800"><div className="h-full rounded-full bg-indigo-500 transition-all" style={{width:`${(b.open/maxOpen)*100}%`}}/></div><span className="text-xs font-mono text-zinc-400 w-6 text-right">{b.open}</span></div>)}
        {byAssignee.length===0&&<p className="text-zinc-600 text-xs">No data</p>}</div>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="text-xs font-semibold text-white mb-3">Cases by Department</p>
        <div className="space-y-2">{byDept.map(d=><div key={d.dept} className="flex items-center gap-3"><DeptBadge dept={d.dept}/><div className="flex-1 h-1.5 rounded-full bg-zinc-800"><div className="h-full rounded-full bg-purple-500 transition-all" style={{width:`${(d.total/maxTotal)*100}%`}}/></div><span className="text-xs font-mono text-zinc-400 w-10 text-right">{d.open}/{d.total}</span></div>)}
        {byDept.length===0&&<p className="text-zinc-600 text-xs">No data</p>}</div>
      </div>
    </div>
  </div>;
}

// ─── FLOW BUILDER ─────────────────────────────────────────────────────────────
function FlowBuilder({caseTypeId}:{caseTypeId:string}){
  const [transitions,setTransitions]=useState<FlowTransition[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState("");
  const [saved,setSaved]=useState(false);

  useEffect(()=>{
    setLoading(true);
    fetch(`/api/admin/case-types/${caseTypeId}/transitions`)
      .then(r=>r.json())
      .then(d=>{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setTransitions((d.transitions||[]).map((t:any)=>({from:t.from as CaseStatus,to:t.to as CaseStatus,requiresReason:!!t.requiresReason})));
      })
      .catch(()=>{})
      .finally(()=>setLoading(false));
  },[caseTypeId]);

  function toggle(from:CaseStatus,to:CaseStatus){
    setTransitions(prev=>{
      const exists=prev.some(t=>t.from===from&&t.to===to);
      if(exists) return prev.filter(t=>!(t.from===from&&t.to===to));
      return [...prev,{from,to,requiresReason:false}];
    });
    setSaved(false);
  }

  function toggleReason(from:CaseStatus,to:CaseStatus,e:React.MouseEvent){
    e.stopPropagation();
    setTransitions(prev=>prev.map(t=>t.from===from&&t.to===to?{...t,requiresReason:!t.requiresReason}:t));
    setSaved(false);
  }

  function isEnabled(from:CaseStatus,to:CaseStatus){return transitions.some(t=>t.from===from&&t.to===to);}
  function needsReason(from:CaseStatus,to:CaseStatus){return transitions.find(t=>t.from===from&&t.to===to)?.requiresReason??false;}

  async function save(){
    setSaving(true); setErr(""); setSaved(false);
    try {
      const r=await fetch(`/api/admin/case-types/${caseTypeId}/transitions`,{
        method:"PUT",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({transitions}),
      });
      if(!r.ok){const d=await r.json();setErr(d.error||"Failed");}
      else setSaved(true);
    } catch(e){setErr(String(e));}
    setSaving(false);
  }

  if(loading) return <div className="py-4 flex justify-center"><Spinner/></div>;

  return <div>
    <div className="flex items-center justify-between mb-3">
      <div>
        <p className="text-[10px] text-zinc-600">Check each allowed transition. Click <span className="text-amber-400 font-mono">✱</span> on an enabled cell to require a reason.</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {err&&<span className="text-xs text-red-400">{err}</span>}
        {saved&&!saving&&<span className="text-xs text-green-400">Saved</span>}
        <Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 h-7 text-xs px-3 disabled:opacity-50">
          {saving?<Spinner/>:"Save Flow"}
        </Button>
      </div>
    </div>
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="text-[10px] w-full">
        <thead>
          <tr className="bg-zinc-950/60 border-b border-zinc-800">
            <th className="px-3 py-2 text-left text-zinc-500 font-medium w-28 whitespace-nowrap">From ↓ · To →</th>
            {ALL_STATUSES.map(s=><th key={s} className="px-2 py-2 text-center text-zinc-500 font-medium whitespace-nowrap">{STATUS_META[s]?.label??s}</th>)}
          </tr>
        </thead>
        <tbody>
          {ALL_STATUSES.map(from=><tr key={from} className="border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/20">
            <td className="px-3 py-2 text-zinc-300 font-medium whitespace-nowrap">{STATUS_META[from]?.label??from}</td>
            {ALL_STATUSES.map(to=><td key={to} className="px-2 py-1.5 text-center">
              {from===to
                ?<span className="text-zinc-800">—</span>
                :<div className="flex flex-col items-center gap-0.5">
                  <button
                    onClick={()=>toggle(from,to)}
                    className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${isEnabled(from,to)?"bg-indigo-500 border-indigo-400 text-white":"border-zinc-700 hover:border-zinc-500"}`}
                  >
                    {isEnabled(from,to)&&<Check className="w-2.5 h-2.5"/>}
                  </button>
                  {isEnabled(from,to)&&<button
                    onClick={e=>toggleReason(from,to,e)}
                    title="Toggle: requires reason"
                    className={`text-[9px] font-mono cursor-pointer leading-none transition-colors ${needsReason(from,to)?"text-amber-400":"text-zinc-700 hover:text-zinc-500"}`}
                  >✱</button>}
                </div>
              }
            </td>)}
          </tr>)}
        </tbody>
      </table>
    </div>
  </div>;
}

// ─── APPROVER TEMPLATES ───────────────────────────────────────────────────────
function ApproverTemplates({caseTypeId,approvalRequired,allRoles}:{caseTypeId:string;approvalRequired:boolean;allRoles:Role[]}){
  const [approvers,setApprovers]=useState<ApproverTemplate[]>([]);
  const [loading,setLoading]=useState(true);
  const [selectedRoleId,setSelectedRoleId]=useState("");
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState("");

  const fetchApprovers=useCallback(()=>{
    fetch(`/api/admin/case-types/${caseTypeId}/approvers`)
      .then(r=>r.json())
      .then(d=>setApprovers(d.approvers||[]))
      .catch(()=>{})
      .finally(()=>setLoading(false));
  },[caseTypeId]);

  useEffect(()=>{fetchApprovers();},[fetchApprovers]);

  async function addApprover(){
    if(!selectedRoleId) return;
    const role=allRoles.find(r=>r.id===selectedRoleId);
    if(!role) return;
    setSaving(true); setErr("");
    try {
      const r=await fetch(`/api/admin/case-types/${caseTypeId}/approvers`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({roleId:selectedRoleId,displayName:role.name,role:role.name}),
      });
      if(r.ok){setSelectedRoleId("");fetchApprovers();}
      else{const d=await r.json();setErr(d.error||"Failed");}
    } catch(e){setErr(String(e));}
    setSaving(false);
  }

  async function removeApprover(id:string){
    await fetch(`/api/admin/case-types/${caseTypeId}/approvers/${id}`,{method:"DELETE"});
    fetchApprovers();
  }

  const assignedRoleIds=new Set(approvers.map(a=>a.roleId).filter(Boolean));
  const availableRoles=allRoles.filter(r=>!assignedRoleIds.has(r.id));

  if(!approvalRequired) return <p className="text-[10px] text-zinc-600 mt-1">Enable "Approval Required" on this case type to configure approval levels.</p>;
  if(loading) return <div className="py-2 flex"><Spinner/></div>;

  return <div className="space-y-2">
    <p className="text-[10px] text-zinc-500">Each level is an ordered gate. All must approve before the case can close. Users with the linked role see the case highlighted in their queue.</p>
    {err&&<ErrBox msg={err}/>}
    {approvers.length===0&&<p className="text-[10px] text-zinc-600">No approval levels configured. Add roles below to define the approval chain.</p>}
    {approvers.map((a,i)=><div key={a.id} className="flex items-center gap-3 rounded-lg border border-zinc-800 px-3 py-2.5 bg-zinc-950/30">
      <span className="text-[10px] text-zinc-600 w-5 text-center font-mono font-bold">{i+1}</span>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <RoleBadge name={a.name} color={a.roleColor}/>
        {!a.roleId&&<span className="text-[10px] text-zinc-600">(legacy — no role linked)</span>}
      </div>
      <button onClick={()=>removeApprover(a.id)} className="text-zinc-600 hover:text-red-400 cursor-pointer p-1 rounded hover:bg-zinc-800 transition-colors">
        <X className="w-3 h-3"/>
      </button>
    </div>)}
    <div className="flex gap-2 mt-2 pt-2 border-t border-zinc-800/60">
      <select value={selectedRoleId} onChange={e=>setSelectedRoleId(e.target.value)} className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white h-8 focus:outline-none focus:border-indigo-500">
        <option value="">Select role for next approval level…</option>
        {availableRoles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <Button onClick={addApprover} disabled={saving||!selectedRoleId} className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs px-3 shrink-0 disabled:opacity-50">
        {saving?<Spinner/>:<Plus className="w-3.5 h-3.5"/>}
      </Button>
    </div>
  </div>;
}

// ─── FIELD FORM ───────────────────────────────────────────────────────────────
function FieldForm({caseTypeId,existing,allFields,onDone,onCancel}:{caseTypeId:string;existing?:CustomField;allFields:CustomField[];onDone:()=>void;onCancel:()=>void}){
  const [label,setLabel]=useState(existing?.label??"");
  const [key,setKey]=useState(existing?.key??"");
  const [type,setType]=useState(existing?.type??"text");
  const [requiredAt,setRequiredAt]=useState(existing?.requiredAt??"optional");
  const [optionsRaw,setOptionsRaw]=useState((existing?.options??[]).join(", "));
  const [condKey,setCondKey]=useState(existing?.conditionalOn?.key??"");
  const [condVal,setCondVal]=useState(existing?.conditionalOn?.value??"");
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState("");

  function derivedKey(lbl:string){return lbl.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");}

  async function save(){
    if(!label.trim()||!key.trim()){setErr("Label and key are required.");return;}
    setSaving(true); setErr("");
    const body:{label:string;key?:string;type:string;requiredAt:string;options:string[];conditionalOn:{key:string;value:string}|null}={
      label:label.trim(), type,
      requiredAt,
      options:type==="dropdown"?optionsRaw.split(",").map(s=>s.trim()).filter(Boolean):[],
      conditionalOn:condKey&&condVal?{key:condKey,value:condVal}:null,
    };
    try {
      let r;
      if(existing?.id){
        r=await fetch(`/api/admin/case-types/${caseTypeId}/fields/${existing.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      } else {
        r=await fetch(`/api/admin/case-types/${caseTypeId}/fields`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...body,key:key.trim()})});
      }
      if(!r.ok){const d=await r.json();setErr(d.error||"Failed");setSaving(false);return;}
      onDone();
    } catch(e){setErr(String(e));setSaving(false);}
  }

  return <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4 space-y-3 mt-2">
    <p className="text-xs font-semibold text-indigo-400">{existing?"Edit Field":"Add Field"}</p>
    {err&&<ErrBox msg={err}/>}
    <div className="grid grid-cols-2 gap-3">
      <FG label="Label" req><FIn value={label} onChange={v=>{setLabel(v);if(!existing)setKey(derivedKey(v));}} placeholder="e.g. Alert Type"/></FG>
      <FG label="Key (snake_case)" req><FIn value={key} onChange={setKey} placeholder="alert_type" disabled={!!existing}/></FG>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <FG label="Field Type">
        <select value={type} onChange={e=>setType(e.target.value as CustomField["type"])} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white h-8 focus:outline-none focus:border-indigo-500">
          {FIELD_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </FG>
      <FG label="Required At">
        <select value={requiredAt} onChange={e=>setRequiredAt(e.target.value as CustomField["requiredAt"])} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white h-8 focus:outline-none focus:border-indigo-500">
          {REQUIRED_AT_OPTS.map(o=><option key={o} value={o}>{o}</option>)}
        </select>
      </FG>
    </div>
    {type==="dropdown"&&<FG label="Options (comma-separated)"><FIn value={optionsRaw} onChange={setOptionsRaw} placeholder="Option A, Option B, Option C"/></FG>}
    <div className="grid grid-cols-2 gap-3">
      <FG label="Show only when field…">
        <select value={condKey} onChange={e=>setCondKey(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white h-8 focus:outline-none focus:border-indigo-500">
          <option value="">Always show</option>
          {allFields.filter(f=>f.key!==key).map(f=><option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
      </FG>
      {condKey&&<FG label="…equals"><FIn value={condVal} onChange={setCondVal} placeholder="value"/></FG>}
    </div>
    <div className="flex gap-2 pt-1">
      <Button variant="outline" onClick={onCancel} className="border-zinc-700 text-zinc-400 h-7 text-xs px-3">Cancel</Button>
      <Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 h-7 text-xs px-4 disabled:opacity-50">
        {saving?<span className="flex items-center gap-1.5"><Spinner/>{existing?"Saving…":"Adding…"}</span>:existing?"Save Changes":"Add Field"}
      </Button>
    </div>
  </div>;
}

// ─── CREATE / EDIT CASE TYPE MODAL ────────────────────────────────────────────
function CaseTypeModal({existing,allRoles,onClose,onSaved}:{existing?:CaseType|null;allRoles:Role[];onClose:()=>void;onSaved:()=>void}){
  const [step,setStep]=useState(1);
  // Step 1 – Identity
  const [name,setName]=useState(existing?.name??"");
  const [desc,setDesc]=useState(existing?.description??"");
  const [dept,setDept]=useState<Department>(existing?.department??"AML");
  const [priority,setPriority]=useState(existing?.priority??"medium");
  const [color,setColor]=useState(existing?.color??"indigo");
  const [trigger,setTrigger]=useState(existing?.triggerType??"manual");
  // Step 2 – Operations
  const [slaDays,setSlaDays]=useState(String(existing?.sla?.slaDays??5));
  const [escalationDays,setEscalationDays]=useState(String(existing?.sla?.escalationDays??""));
  const [escalateTo,setEscalateTo]=useState(existing?.sla?.escalateTo??"");
  const [approval,setApproval]=useState(existing?.approvalRequired??false);
  const [allowedRoles,setAllowedRoles]=useState<string[]>(existing?.allowedInitiatorRoles??[]);
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState("");

  function toggleAllowedRole(id:string){
    setAllowedRoles(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  }

  async function save(){
    if(!name.trim()){setErr("Name is required.");return;}
    setSaving(true); setErr("");
    const body={
      name:name.trim(),description:desc,department:dept,approvalRequired:approval,
      triggerType:trigger,slaDays:Number(slaDays)||5,
      escalationDays:escalationDays?Number(escalationDays):null,
      escalateTo:escalateTo||null,priority,color,allowedInitiatorRoles:allowedRoles,
    };
    try {
      const r=existing
        ? await fetch(`/api/admin/case-types/${existing.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
        : await fetch("/api/admin/case-types",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      if(!r.ok){const d=await r.json();setErr(d.error||"Failed");setSaving(false);return;}
      onSaved(); onClose();
    } catch(e){setErr(String(e));setSaving(false);}
  }

  return <Modal title={existing?"Edit Case Type":"New Case Type"} onClose={onClose} wide>
    <div className="flex gap-2 mb-5">{[1,2].map(s=><div key={s} className={`flex-1 h-1 rounded-full ${step>=s?"bg-indigo-500":"bg-zinc-700"}`}/>)}</div>
    {err&&<ErrBox msg={err}/>}

    {step===1&&<div className="space-y-4">
      <FG label="Name" req><FIn value={name} onChange={setName} placeholder="e.g. Sanctions Alert"/></FG>
      <FG label="Description / Purpose"><FTa value={desc} onChange={setDesc} placeholder="What this case type is used for…" rows={2}/></FG>
      <div className="grid grid-cols-2 gap-3">
        <FG label="Department"><FSel value={dept} onChange={v=>setDept(v as Department)} opts={[...DEPARTMENTS]}/></FG>
        <FG label="Trigger"><FSel value={trigger} onChange={setTrigger} opts={["manual","auto","api"]}/></FG>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FG label="Priority">
          <select value={priority} onChange={e=>setPriority(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white h-8 focus:outline-none focus:border-indigo-500">
            {PRIORITIES.map(p=><option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
          </select>
        </FG>
        <FG label="Color">
          <div className="flex gap-1.5 flex-wrap items-center h-8">
            {ROLE_COLORS.map(c=><button key={c} onClick={()=>setColor(c)} title={c} className={`w-5 h-5 rounded-full border-2 cursor-pointer transition-all bg-${c}-500 ${color===c?"border-white scale-110":"border-transparent"}`}/>)}
          </div>
        </FG>
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onClose} className="border-zinc-700 text-zinc-400 h-8 text-xs">Cancel</Button>
        <Button onClick={()=>setStep(2)} disabled={!name.trim()} className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs flex-1 disabled:opacity-50">Next — Operations</Button>
      </div>
    </div>}

    {step===2&&<div className="space-y-4">
      <div className="rounded-lg bg-zinc-800/50 p-3 text-xs flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full bg-${color}-400`}/>
        <span className="text-white font-medium">{name}</span>
        <DeptBadge dept={dept}/>
        <span className={`text-[10px] font-semibold ${PRIORITY_META[priority]?.color??""}`}>{PRIORITY_META[priority]?.label}</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <FG label="SLA (days)" req><FIn value={slaDays} onChange={setSlaDays} type="number"/></FG>
        <FG label="Escalation after (days)"><FIn value={escalationDays} onChange={setEscalationDays} type="number" placeholder="optional"/></FG>
        <FG label="Escalate to (dept)"><FIn value={escalateTo} onChange={setEscalateTo} placeholder="e.g. AML"/></FG>
      </div>
      <FG label="Approval Required">
        <label className="flex items-center gap-2 h-8 cursor-pointer">
          <input type="checkbox" checked={approval} onChange={e=>setApproval(e.target.checked)} className="accent-indigo-500 w-4 h-4"/>
          <span className="text-xs text-zinc-400">Requires maker/checker approval to close</span>
        </label>
      </FG>
      {allRoles.length>0&&<FG label="Allowed Initiator Roles (leave empty = anyone)">
        <div className="flex flex-wrap gap-2 mt-1">
          {allRoles.map(r=><button key={r.id} onClick={()=>toggleAllowedRole(r.id)} className={`px-2.5 py-1 rounded-full text-[10px] font-medium border cursor-pointer transition-colors ${allowedRoles.includes(r.id)?COLOR_CLASSES[r.color]??"bg-indigo-500/15 text-indigo-400 border-indigo-500/30":"border-zinc-700 text-zinc-500 hover:border-zinc-500"}`}>
            {r.name}
          </button>)}
        </div>
      </FG>}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={()=>setStep(1)} className="border-zinc-700 text-zinc-400 h-8 text-xs">Back</Button>
        <Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs flex-1 disabled:opacity-50">
          {saving?<span className="flex items-center gap-2"><Spinner/>{existing?"Saving…":"Creating…"}</span>:existing?"Save Changes":"Create Case Type"}
        </Button>
      </div>
    </div>}
  </Modal>;
}

// ─── CASE TYPES PANEL ─────────────────────────────────────────────────────────
function CaseTypesPanel({caseTypes,allRoles,onRefresh}:{caseTypes:CaseType[];allRoles:Role[];onRefresh:()=>void}){
  const [exp,setExp]=useState<string|null>(null);
  const [expSection,setExpSection]=useState<"fields"|"flow"|"approvers">("fields");
  const [showCreate,setShowCreate]=useState(false);
  const [editing,setEditing]=useState<CaseType|null>(null);
  const [deletingId,setDeletingId]=useState<string|null>(null);
  const [deleteMsg,setDeleteMsg]=useState("");
  const [addFieldFor,setAddFieldFor]=useState<string|null>(null);
  const [editField,setEditField]=useState<{typeId:string;field:CustomField}|null>(null);
  const [deleting,setDeleting]=useState(false);

  async function deleteType(id:string){
    setDeleting(true);
    try {
      const r=await fetch(`/api/admin/case-types/${id}`,{method:"DELETE"});
      const d=await r.json();
      if(d.deactivated) setDeleteMsg("Case type deactivated (cases exist using it).");
      else setDeleteMsg("Case type deleted.");
      setDeletingId(null);
      onRefresh();
    } catch(e){setDeleteMsg(String(e));}
    setDeleting(false);
  }

  async function deleteField(typeId:string,fieldId:string){
    await fetch(`/api/admin/case-types/${typeId}/fields/${fieldId}`,{method:"DELETE"});
    onRefresh();
  }

  async function moveField(typeId:string,fieldId:string,dir:"up"|"down"){
    await fetch(`/api/admin/case-types/${typeId}/fields/${fieldId}`,{
      method:"PATCH",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({direction:dir}),
    });
    onRefresh();
  }

  function expand(id:string){
    if(exp===id){setExp(null);}
    else{setExp(id);setExpSection("fields");setAddFieldFor(null);setEditField(null);}
  }

  if(caseTypes.length===0) return <div className="text-zinc-600 text-xs text-center py-8">Loading case types…</div>;

  return <>
    {showCreate&&<CaseTypeModal allRoles={allRoles} onClose={()=>setShowCreate(false)} onSaved={onRefresh}/>}
    {editing&&<CaseTypeModal existing={editing} allRoles={allRoles} onClose={()=>setEditing(null)} onSaved={onRefresh}/>}

    {deletingId&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <p className="text-white font-bold text-sm">Delete Case Type?</p>
        <p className="text-zinc-400 text-xs">If any cases exist for this type, it will be deactivated instead of deleted.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={()=>setDeletingId(null)} className="border-zinc-700 text-zinc-400 h-8 text-xs flex-1">Cancel</Button>
          <Button onClick={()=>deleteType(deletingId)} disabled={deleting} className="bg-red-600 hover:bg-red-700 h-8 text-xs flex-1 disabled:opacity-50">
            {deleting?<span className="flex items-center gap-1.5"><Spinner/>Deleting…</span>:"Delete"}
          </Button>
        </div>
        {deleteMsg&&<p className="text-xs text-zinc-400">{deleteMsg}</p>}
      </div>
    </div>}

    <div className="flex items-center justify-between mb-4">
      <p className="text-xs text-zinc-500">{caseTypes.length} case types configured</p>
      <Button onClick={()=>setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs flex items-center gap-1.5">
        <Plus className="w-3.5 h-3.5"/>New Case Type
      </Button>
    </div>

    <div className="space-y-3">
      {caseTypes.map(t=><div key={t.id} className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">

        {/* Header row */}
        <div className="flex items-center gap-2 px-5 py-3.5">
          <div className={`w-2 h-2 rounded-full shrink-0 ${t.active?"bg-green-400":"bg-zinc-600"}`}/>
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0 cursor-pointer" onClick={()=>expand(t.id)}>
            <div className={`w-2 h-2 rounded-full bg-${t.color??"indigo"}-400 shrink-0`}/>
            <p className="text-white text-sm font-semibold">{t.name}</p>
            <DeptBadge dept={t.department}/>
            {t.priority&&t.priority!=="medium"&&<span className={`text-[10px] font-semibold ${PRIORITY_META[t.priority]?.color??""}`}>{PRIORITY_META[t.priority]?.label}</span>}
            {t.approvalRequired&&<Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-400">Approval Required</Badge>}
            <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">v{t.version}</Badge>
            {t.triggerType!=="manual"&&<Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400 capitalize">{t.triggerType}</Badge>}
            {!t.active&&<Badge variant="outline" className="text-[10px] border-red-500/30 text-red-400">Inactive</Badge>}
            <span className="text-zinc-600 text-[10px]">{t.fields.filter(f=>f.active!==false).length} fields · {t.sla?.slaDays??5}d SLA</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={()=>setEditing(t)} className="p-1.5 text-zinc-500 hover:text-indigo-400 cursor-pointer rounded-lg hover:bg-zinc-800 transition-colors" title="Edit">
              <FileText className="w-3.5 h-3.5"/>
            </button>
            <button onClick={()=>{setDeletingId(t.id);setDeleteMsg("");}} className="p-1.5 text-zinc-500 hover:text-red-400 cursor-pointer rounded-lg hover:bg-zinc-800 transition-colors" title="Delete">
              <XCircle className="w-3.5 h-3.5"/>
            </button>
            <button onClick={()=>expand(t.id)} className="p-1.5 text-zinc-500 cursor-pointer rounded-lg hover:bg-zinc-800">
              {exp===t.id?<ChevronDown className="w-4 h-4"/>:<ChevronRight className="w-4 h-4"/>}
            </button>
          </div>
        </div>

        {/* Expanded body */}
        {exp===t.id&&<div className="border-t border-zinc-800 px-5 pb-5">

          {/* Info strip */}
          <div className="flex flex-wrap gap-4 py-3 border-b border-zinc-800/60 text-[10px] text-zinc-500">
            <span>ID: <span className="font-mono text-zinc-400">{t.id}</span></span>
            <span>Trigger: <span className="text-zinc-400">{t.triggerType}</span></span>
            <span>SLA: <span className="text-zinc-400">{t.sla?.slaDays??5} days</span></span>
            <span>Approval: <span className="text-zinc-400">{t.approvalRequired?"Yes":"No"}</span></span>
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-0 border-b border-zinc-800/60 mt-3">
            {[["fields","Fields"],["flow","Status Flow"],["approvers","Approval Levels"]].map(([id,label])=>(
              <button key={id} onClick={()=>{setExpSection(id as "fields"|"flow"|"approvers");setAddFieldFor(null);setEditField(null);}} className={`px-4 py-2 text-[11px] font-medium border-b-2 cursor-pointer transition-colors ${expSection===id?"border-indigo-500 text-indigo-400":"border-transparent text-zinc-500 hover:text-zinc-300"}`}>{label}</button>
            ))}
          </div>

          {/* Fields section */}
          {expSection==="fields"&&<div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-zinc-300">Fields ({t.fields.filter(f=>f.active!==false).length})</p>
              <button
                onClick={()=>{setAddFieldFor(addFieldFor===t.id?null:t.id);setEditField(null);}}
                className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 cursor-pointer px-2 py-1 rounded-lg hover:bg-indigo-500/10 transition-colors"
              >
                <Plus className="w-3 h-3"/>{addFieldFor===t.id?"Cancel":"Add Field"}
              </button>
            </div>
            {addFieldFor===t.id&&<FieldForm caseTypeId={t.id} allFields={t.fields} onDone={()=>{setAddFieldFor(null);onRefresh();}} onCancel={()=>setAddFieldFor(null)}/>}
            {editField?.typeId===t.id&&<FieldForm caseTypeId={t.id} existing={editField.field} allFields={t.fields} onDone={()=>{setEditField(null);onRefresh();}} onCancel={()=>setEditField(null)}/>}
            {t.fields.length===0&&!addFieldFor&&<p className="text-zinc-600 text-xs py-2">No fields yet. Add the first one above.</p>}
            {t.fields.length>0&&<div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[600px] mt-1">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {["","Key","Label","Type","Required At","Options / Condition",""].map((h,i)=><th key={i} className={`pb-2 text-left text-zinc-500 font-medium ${i===0?"w-10":i===6?"w-20 text-right":"pr-3"}`}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {t.fields.map((f,idx)=><tr key={f.key} className={`border-b border-zinc-800/40 last:border-0 ${f.active===false?"opacity-40":""}`}>
                    <td className="py-1.5 pr-1">
                      <div className="flex flex-col gap-0.5">
                        <button disabled={idx===0} onClick={()=>f.id&&moveField(t.id,f.id,"up")} className="text-zinc-600 hover:text-zinc-400 disabled:opacity-20 cursor-pointer leading-none">▲</button>
                        <button disabled={idx===t.fields.length-1} onClick={()=>f.id&&moveField(t.id,f.id,"down")} className="text-zinc-600 hover:text-zinc-400 disabled:opacity-20 cursor-pointer leading-none">▼</button>
                      </div>
                    </td>
                    <td className="py-1.5 pr-3 font-mono text-indigo-300 text-[10px]">{f.key}</td>
                    <td className="py-1.5 pr-3 text-zinc-200">{f.label}</td>
                    <td className="py-1.5 pr-3 text-zinc-400">{FIELD_TYPES.find(ft=>ft.value===f.type)?.label??f.type}</td>
                    <td className="py-1.5 pr-3">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${f.requiredAt==="create"?"bg-red-500/15 text-red-300":f.requiredAt==="complete"?"bg-amber-500/15 text-amber-300":f.requiredAt==="close"?"bg-orange-500/15 text-orange-300":"bg-zinc-800 text-zinc-500"}`}>{f.requiredAt}</span>
                    </td>
                    <td className="py-1.5 pr-3 text-zinc-500 text-[10px]">
                      {f.type==="dropdown"&&f.options?.length?(f.options.slice(0,3).join(", ")+(f.options.length>3?` +${f.options.length-3}`:"")):""}
                      {f.conditionalOn&&<span className="text-zinc-600"> if {f.conditionalOn.key}={f.conditionalOn.value}</span>}
                    </td>
                    <td className="py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={()=>{setEditField({typeId:t.id,field:f});setAddFieldFor(null);}} className="p-1 text-zinc-600 hover:text-indigo-400 cursor-pointer rounded hover:bg-zinc-800" title="Edit field"><FileText className="w-3 h-3"/></button>
                        <button onClick={()=>f.id&&deleteField(t.id,f.id)} className="p-1 text-zinc-600 hover:text-red-400 cursor-pointer rounded hover:bg-zinc-800" title="Delete field"><X className="w-3 h-3"/></button>
                      </div>
                    </td>
                  </tr>)}
                </tbody>
              </table>
            </div>}
          </div>}

          {/* Status Flow section */}
          {expSection==="flow"&&<div className="mt-4">
            <FlowBuilder caseTypeId={t.id}/>
          </div>}

          {/* Approval Levels section */}
          {expSection==="approvers"&&<div className="mt-4">
            <ApproverTemplates caseTypeId={t.id} approvalRequired={t.approvalRequired} allRoles={allRoles}/>
          </div>}

        </div>}
      </div>)}
    </div>
  </>;
}

// ─── MAIN PAGE INNER ──────────────────────────────────────────────────────────
function CasesInner(){
  const router=useRouter();
  const params=useSearchParams();
  const [user,setUser]=useState<Record<string,unknown>|null>(null);
  const [cases,setCases]=useState<Case[]>([]);
  const [caseTypes,setCaseTypes]=useState<CaseType[]>([]);
  const [allRoles,setAllRoles]=useState<Role[]>([]);
  const [myRoleIds,setMyRoleIds]=useState<string[]>([]);
  const [allUsers,setAllUsers]=useState<UserInfo[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [tab,setTab]=useState("cases");
  const [selected,setSelected]=useState<string[]>([]);
  const [search,setSearch]=useState("");
  const [filterDept,setFilterDept]=useState("");
  const [filterType,setFilterType]=useState("");
  const [filterStatus,setFilterStatus]=useState("");
  const [filterLic,setFilterLic]=useState("");
  const [filterAssignee,setFilterAssignee]=useState("");
  const [detailCaseId,setDetailCaseId]=useState<string|null>(null);
  const [showCreate,setShowCreate]=useState(false);

  const defaultTxn=params?.get("transaction_id")||undefined;

  const fetchCases=useCallback(async()=>{
    setLoading(true); setError("");
    try {
      const qs=new URLSearchParams();
      if(filterDept)qs.set("department",filterDept);
      if(filterStatus)qs.set("status",filterStatus);
      if(filterType){const ct=caseTypes.find(t=>t.name===filterType);if(ct)qs.set("typeId",ct.id);}
      if(filterLic)qs.set("license",filterLic);
      if(filterAssignee)qs.set("assignee",filterAssignee);
      if(search)qs.set("search",search);
      const r=await fetch(`/api/cases?${qs}`);
      if(r.status===401){router.push("/login");return;}
      if(!r.ok){setError("Failed to load cases.");setLoading(false);return;}
      const data=await r.json();
      setCases(data.cases||[]);
    } catch(e){setError(String(e));}
    setLoading(false);
  },[filterDept,filterStatus,filterType,filterLic,filterAssignee,search,router,caseTypes]);

  const fetchCaseTypes=useCallback(()=>{
    fetch("/api/case-types").then(async r=>{if(r.ok){const d=await r.json();setCaseTypes(d.caseTypes||[]);}}).catch(()=>{});
  },[]);

  const fetchRoles=useCallback(()=>{
    fetch("/api/admin/roles").then(async r=>{if(r.ok){const d=await r.json();setAllRoles(d.roles||[]);}}).catch(()=>{});
    fetch("/api/admin/roles?mine=true").then(async r=>{if(r.ok){const d=await r.json();setMyRoleIds((d.roles||[]).map((x:{id:string})=>x.id));}}).catch(()=>{});
  },[]);

  useEffect(()=>{
    fetch("/api/auth/me").then(async r=>{if(r.status===401){router.push("/login");return;}const d=await r.json();setUser(d.user);});
    fetchCaseTypes();
    fetchRoles();
    // load users for assignee picker
    fetch("/api/admin/users").then(async r=>{if(r.ok){const d=await r.json();setAllUsers((d.users||[]).map((u:{id:string;email:string;display_name?:string})=>({id:u.id,email:u.email,displayName:u.display_name||u.email})));}}).catch(()=>{});
    if(params?.get("create")==="true")setShowCreate(true);
  },[router,params,fetchCaseTypes,fetchRoles]);

  useEffect(()=>{fetchCases();},[fetchCases]);

  function updateCase(id:string,patch:Partial<Case>){setCases(prev=>prev.map(c=>c.id===id?{...c,...patch}:c));}
  function toggleSelect(id:string){setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);}

  const openCount=cases.filter(c=>["new","active","rfi"].includes(c.status)).length;
  const myApprovalCount=cases.filter(c=>c.status==="pending_approval"&&caseTypes.find(t=>t.id===c.typeId)?.approverTemplates?.some(at=>at.roleId&&myRoleIds.includes(at.roleId))).length;

  function needsMyApproval(c:Case):boolean{
    if(c.status!=="pending_approval")return false;
    const ct=caseTypes.find(t=>t.id===c.typeId);
    return ct?.approverTemplates?.some(at=>at.roleId&&myRoleIds.includes(at.roleId))??false;
  }

  return <div className="min-h-screen bg-zinc-950 text-white">
    <DashNav user={user}/>

    {/* Page header */}
    <div className="border-b border-zinc-800 bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-lg font-bold text-white">Case Management</h1>
            <span className="bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{openCount} open</span>
          </div>
          <p className="text-xs text-zinc-500">All cases · KYB · AML · Fraud · Recall · Compliance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchCases} className="border-zinc-700 text-zinc-400 h-8 text-xs">Refresh</Button>
          <Button onClick={()=>setShowCreate(true)} data-testid="new-case-btn" className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs shrink-0"><Plus className="w-3.5 h-3.5 mr-1.5"/>New Case</Button>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-0 overflow-x-auto" style={{scrollbarWidth:"none"}}>
        {([["cases","Cases"],["analytics","Analytics"],["types","Case Types"],["roles","Roles"],["departments","Departments"]] as [string,string][]).map(([id,label])=>
          <button key={id} onClick={()=>setTab(id)} data-testid={`tab-${id}`} className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 cursor-pointer transition-colors relative ${tab===id?"border-indigo-500 text-indigo-400":"border-transparent text-zinc-500 hover:text-zinc-300"}`}>
            {label}
            {id==="cases"&&myApprovalCount>0&&<span className="ml-1.5 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{myApprovalCount}</span>}
          </button>
        )}
      </div>
    </div>

    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {tab==="analytics"&&<AnalyticsPanel/>}
      {tab==="types"&&<CaseTypesPanel caseTypes={caseTypes} allRoles={allRoles} onRefresh={()=>{fetchCaseTypes();fetchCases();}}/>}
      {tab==="roles"&&<RolesPanel/>}
      {tab==="departments"&&<DepartmentsPanel allRoles={allRoles}/>}
      {tab==="cases"&&<>
        {/* Filter bar */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600"/>
            <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search cases, clients, custom fields…" className="bg-zinc-900 border-zinc-800 text-white text-xs h-8 pl-8" data-testid="search-input"/>
          </div>
          <select value={filterDept} onChange={e=>setFilterDept(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 text-xs text-zinc-300 h-8 focus:outline-none" data-testid="filter-dept"><option value="">All Departments</option>{DEPARTMENTS.map(d=><option key={d}>{d}</option>)}</select>
          <select value={filterType} onChange={e=>setFilterType(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 text-xs text-zinc-300 h-8 focus:outline-none" data-testid="filter-type"><option value="">All Types</option>{caseTypes.map(t=><option key={t.id}>{t.name}</option>)}</select>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 text-xs text-zinc-300 h-8 focus:outline-none" data-testid="filter-status"><option value="">All Statuses</option>{Object.entries(STATUS_META).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
          <select value={filterLic} onChange={e=>setFilterLic(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 text-xs text-zinc-300 h-8 focus:outline-none"><option value="">All Licenses</option>{["UK","CA","MT"].map(l=><option key={l}>{l}</option>)}</select>
          <select value={filterAssignee} onChange={e=>setFilterAssignee(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 text-xs text-zinc-300 h-8 focus:outline-none"><option value="">All Assignees</option>{ASSIGNEES.map(a=><option key={a}>{a}</option>)}</select>
          <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-400 h-8 text-xs"><Download className="w-3.5 h-3.5 mr-1.5"/>Export</Button>
        </div>

        {error&&<ErrBox msg={error} onRetry={fetchCases}/>}

        {/* Table */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-testid="cases-table">
              <thead><tr className="border-b border-zinc-800 bg-zinc-950/40">
                <th className="px-3 py-2.5 w-8"><input type="checkbox" className="accent-indigo-500" onChange={e=>setSelected(e.target.checked?cases.map(c=>c.id):[])}/></th>
                {["ID","Type","Client","Dept","Status","Assignee","Lic","SLA","Created",""].map(h=><th key={h} className="px-3 py-2.5 text-left text-zinc-500 font-medium whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {loading&&<tr><td colSpan={11} className="px-3 py-10 text-center"><div className="flex items-center justify-center gap-2 text-zinc-500 text-xs"><Spinner/>Loading cases…</div></td></tr>}
                {!loading&&cases.map(c=>{const highlight=needsMyApproval(c);return <tr key={c.id} data-testid={`case-row-${c.id}`} className={`border-b cursor-pointer transition-colors ${highlight?"border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10":"border-zinc-800/50 hover:bg-zinc-800/30"}`} onClick={()=>setDetailCaseId(c.id)}>
                  <td className="px-3 py-2.5" onClick={e=>{e.stopPropagation();toggleSelect(c.id);}}><input type="checkbox" className="accent-indigo-500" checked={selected.includes(c.id)} onChange={()=>toggleSelect(c.id)}/></td>
                  <td className="px-3 py-2.5 font-mono text-indigo-400 text-[11px] font-semibold">{c.id}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap"><p className="text-zinc-200 font-medium">{c.typeName}</p>{c.transactionId&&<p className="text-[9px] text-blue-400 font-mono">{c.transactionId}</p>}</td>
                  <td className="px-3 py-2.5"><p className="text-zinc-300 whitespace-nowrap">{c.clientName}</p><p className="text-zinc-600 text-[10px] font-mono">{c.clientId}</p></td>
                  <td className="px-3 py-2.5"><DeptBadge dept={c.department}/></td>
                  <td className="px-3 py-2.5"><StatusBadge status={c.status}/></td>
                  <td className="px-3 py-2.5 text-zinc-400 whitespace-nowrap">{c.assignee||<span className="text-zinc-600 italic">Unassigned</span>}</td>
                  <td className="px-3 py-2.5"><LicBadge lic={c.license}/></td>
                  <td className="px-3 py-2.5">{c.sla&&<SlaChip due={c.sla} breached={c.slaBreached}/>}</td>
                  <td className="px-3 py-2.5 text-zinc-600 whitespace-nowrap">{c.createdAt.slice(0,10)}</td>
                  <td className="px-3 py-2.5 relative">
                    {highlight&&<span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-orange-400 rounded-r" title="Awaiting your approval"/>}
                    <button className="text-indigo-400 hover:text-indigo-300 cursor-pointer" onClick={e=>{e.stopPropagation();setDetailCaseId(c.id);}}><Eye className="w-3.5 h-3.5"/></button>
                  </td>
                </tr>;})}
                {!loading&&cases.length===0&&!error&&<tr><td colSpan={11} className="px-3 py-10 text-center text-zinc-600 text-xs">No cases match the current filters</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-[10px] text-zinc-600 mt-2">{cases.length} cases loaded</p>
      </>}
    </div>

    {selected.length>0&&tab==="cases"&&<BulkPanel selected={selected} onClear={()=>setSelected([])} onBulkDone={()=>{setSelected([]);fetchCases();}}/>}
    {showCreate&&<CreateCaseModal onClose={()=>setShowCreate(false)} onCreate={id=>{fetchCases();setDetailCaseId(id);}} defaultTransactionId={defaultTxn} caseTypes={caseTypes}/>}
    {detailCaseId&&<CaseDetail caseId={detailCaseId} onClose={()=>setDetailCaseId(null)} onUpdate={updateCase} caseTypes={caseTypes} allUsers={allUsers}/>}
  </div>;
}

export default function CasesPage(){
  return <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-6 h-6 border-2 border-white/20 border-t-indigo-500 rounded-full animate-spin"/></div>}><CasesInner/></Suspense>;
}
