"use client";
import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus, Search, X, Download, Clock, CheckCircle, AlertTriangle,
  ArrowRight, Paperclip, Send, Eye, FileText, AlertCircle, Check,
  XCircle, ArrowLeftRight, ChevronDown, ChevronRight, Inbox,
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
}
interface CustomField {
  key: string; label: string; type: "text"|"textarea"|"dropdown"|"date"|"boolean"|"number";
  required: boolean; requiredAt: "create"|"complete"|"close"|"optional";
  options?: string[]; active: boolean; conditionalOn?: {key:string;value:string};
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
const TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  new:["active"], active:["rfi","complete","reject","handoff"], rfi:["active"], handoff:["active"],
  complete:["pending_approval","closed"], reject:["pending_approval","closed"],
  pending_approval:["closed","active"], closed:["active"],
};
const DEPARTMENTS: Department[] = ["AML","Onboarding","Compliance","Settlements","Fraud"];
const ASSIGNEES = ["Sarah K.","Tom B.","Maria L.","Anna W.","James R.","Lisa M."];

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

// ─── CREATE CASE MODAL ────────────────────────────────────────────────────────
function CreateCaseModal({onClose,onCreate,defaultTransactionId,caseTypes}:{onClose:()=>void;onCreate:(id:string)=>void;defaultTransactionId?:string;caseTypes:CaseType[]}){
  const [step,setStep]=useState(1);
  const [typeId,setTypeId]=useState("");
  const [clientId,setClientId]=useState("");
  const [clientName,setClientName]=useState("");
  const [description,setDescription]=useState("");
  const [license,setLicense]=useState("");
  const [fields,setFields]=useState<Record<string,string>>({});
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const ctype=caseTypes.find(t=>t.id===typeId);

  useEffect(()=>{
    if(defaultTransactionId) setFields(f=>({...f,transaction_id:defaultTransactionId,review_reason:"Manual Trigger"}));
  },[defaultTransactionId]);

  async function submit(){
    if(!typeId||!description||!license){setError("All required fields missing.");return;}
    setSaving(true); setError("");
    try {
      const r=await fetch("/api/cases",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({typeId,clientId:clientId||null,clientName:clientName||null,department:ctype?.department,description,license,customFields:fields,transactionId:defaultTransactionId||null,reporter:"Sarah K."})});
      const data=await r.json();
      if(!r.ok){setError(data.error||"Failed to create case.");setSaving(false);return;}
      onCreate(data.id); onClose();
    } catch(e){setError(String(e)); setSaving(false);}
  }

  return <Modal title="Create New Case" onClose={onClose} wide>
    <div className="flex gap-2 mb-6">{[1,2,3].map(s=><div key={s} className={`flex-1 h-1 rounded-full transition-colors ${step>=s?"bg-indigo-500":"bg-zinc-700"}`}/>)}</div>
    {error&&<ErrBox msg={error}/>}

    {step===1&&<div className="space-y-4 mt-3">
      <p className="text-xs text-zinc-400">Select the case type to proceed.</p>
      <div className="grid gap-2">{caseTypes.filter(t=>t.active).map(t=><button data-testid={`type-opt-${t.id}`} key={t.id} onClick={()=>{setTypeId(t.id);setStep(2);}} className={`flex items-center gap-4 p-4 rounded-xl border text-left cursor-pointer transition-all ${typeId===t.id?"border-indigo-500 bg-indigo-500/10":"border-zinc-700 hover:border-zinc-600 bg-zinc-800/30"}`}>
        <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center shrink-0"><FileText className="w-4 h-4 text-indigo-400"/></div>
        <div className="flex-1 min-w-0"><p className="text-white text-xs font-semibold">{t.name}</p><p className="text-zinc-500 text-[10px]">{t.department} · v{t.version} · {t.approvalRequired?"Approval required":"No approval"}</p></div>
        <DeptBadge dept={t.department}/>
      </button>)}</div>
    </div>}

    {step===2&&<div className="space-y-4 mt-3">
      <p className="text-xs text-zinc-500">Type: <span className="text-indigo-400 font-medium">{ctype?.name}</span></p>
      <FG label="Client ID"><FIn value={clientId} onChange={v=>{setClientId(v);setClientName(v?`Client ${v}`:"");}} placeholder="MCH-XXXX (optional for precheck)"/></FG>
      <FG label="Client Name"><FIn value={clientName} onChange={setClientName} placeholder="Resolved from ID"/></FG>
      <FG label="License" req><FSel value={license} onChange={setLicense} opts={["UK","CA","MT"]}/></FG>
      <FG label="Description" req><FTa value={description} onChange={setDescription} placeholder="Describe the case…" rows={3}/></FG>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={()=>setStep(1)} className="border-zinc-700 text-zinc-400 h-8 text-xs">Back</Button>
        <Button data-testid="next-to-fields" onClick={()=>setStep(3)} disabled={!description||!license} className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs flex-1 disabled:opacity-50">Next — Custom Fields</Button>
      </div>
    </div>}

    {step===3&&ctype&&<div className="space-y-4 mt-3">
      <p className="text-xs text-zinc-500">Custom fields for <span className="text-indigo-400">{ctype.name}</span></p>
      {ctype.fields.filter(f=>f.active&&(f.requiredAt==="create"||f.requiredAt==="optional")).map(f=>{
        if(f.conditionalOn&&fields[f.conditionalOn.key]!==f.conditionalOn.value) return null;
        return <FG key={f.key} label={f.label} req={f.requiredAt==="create"}>
          {f.type==="dropdown"?<FSel value={fields[f.key]||""} onChange={v=>setFields(p=>({...p,[f.key]:v}))} opts={f.options||[]}/>
          :f.type==="textarea"?<FTa value={fields[f.key]||""} onChange={v=>setFields(p=>({...p,[f.key]:v}))}/>
          :f.type==="boolean"?<label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!fields[f.key]} onChange={e=>setFields(p=>({...p,[f.key]:String(e.target.checked)}))} className="accent-indigo-500"/><span className="text-xs text-zinc-400">{f.label}</span></label>
          :<FIn value={fields[f.key]||""} onChange={v=>setFields(p=>({...p,[f.key]:v}))} type={f.type==="number"?"number":"text"}/>}
        </FG>;
      })}
      {defaultTransactionId&&<div className="rounded-lg bg-indigo-500/10 border border-indigo-500/30 p-3 text-xs text-indigo-300">Linked to transaction <span className="font-mono font-semibold">{defaultTransactionId}</span></div>}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={()=>setStep(2)} className="border-zinc-700 text-zinc-400 h-8 text-xs">Back</Button>
        <Button data-testid="submit-case" onClick={submit} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs flex-1 disabled:opacity-50">
          {saving?<span className="flex items-center gap-2"><Spinner/>Creating…</span>:"Create Case"}
        </Button>
      </div>
    </div>}
  </Modal>;
}

// ─── STATUS CHANGE MODAL ──────────────────────────────────────────────────────
function StatusModal({c,onClose,onUpdate}:{c:Case;onClose:()=>void;onUpdate:(id:string,patch:Partial<Case>)=>void}){
  const [newStatus,setNewStatus]=useState<CaseStatus|"">("");
  const [reason,setReason]=useState("");
  const [assignee,setAssignee]=useState(c.assignee||"");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const allowed=TRANSITIONS[c.status]||[];

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
      <div className="grid gap-2" data-testid="status-options">{allowed.map(s=><button key={s} onClick={()=>setNewStatus(s)} className={`flex items-center gap-3 p-3 rounded-xl border text-left cursor-pointer transition-all text-xs ${newStatus===s?"border-indigo-500 bg-indigo-500/10":"border-zinc-700 hover:border-zinc-600"}`}><span className="font-medium text-white">{STATUS_META[s].label}</span></button>)}</div>
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
function CaseDetail({caseId,onClose,onUpdate,caseTypes}:{caseId:string;onClose:()=>void;onUpdate:(id:string,patch:Partial<Case>)=>void;caseTypes:CaseType[]}){
  const [c,setC]=useState<Case|null>(null);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState("details");
  const [showStatus,setShowStatus]=useState(false);
  const [showHandoff,setShowHandoff]=useState(false);
  const [showRfi,setShowRfi]=useState(false);

  const fetchCase=useCallback(async()=>{
    setLoading(true);
    try{const r=await fetch(`/api/cases/${caseId}`);if(r.ok){const d=await r.json();setC(d.case);}}catch{}
    setLoading(false);
  },[caseId]);

  useEffect(()=>{fetchCase();},[fetchCase]);

  function handleUpdate(id:string,patch:Partial<Case>){setC(prev=>prev?{...prev,...patch}:null);onUpdate(id,patch);}
  function addComment(comment:Comment){setC(prev=>prev?{...prev,comments:[...prev.comments,comment]}:null);}

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
          {[["details","Details"],["activity","Activity"],["docs","Documentation"],["approvals","Approvals"]].map(([id,label])=>
            <button key={id} onClick={()=>setTab(id)} data-testid={`drawer-tab-${id}`} className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 cursor-pointer transition-colors ${tab===id?"border-indigo-500 text-indigo-400":"border-transparent text-zinc-500 hover:text-zinc-300"}`}>
              {label}{id==="approvals"&&c.approvers.length>0&&<span className="ml-1 text-[9px] bg-zinc-700 px-1 rounded-full">{approvedCount}/{c.approvers.length}</span>}
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
            {c.attachments.map(a=><div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 hover:bg-zinc-800/30">
              <Paperclip className="w-4 h-4 text-zinc-500 shrink-0"/>
              <div className="flex-1 min-w-0">
                <p className="text-zinc-200 text-xs font-medium truncate">{a.name}</p>
                <p className="text-zinc-600 text-[10px]">{a.size} · {a.uploadedBy} · {a.ts} · {a.source}</p>
                {a.tags.length>0&&<div className="flex gap-1 mt-1">{a.tags.map(t=><span key={t} className="text-[9px] bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded">{t}</span>)}</div>}
              </div>
              <button className="text-indigo-400 hover:text-indigo-300 cursor-pointer shrink-0"><Download className="w-3.5 h-3.5"/></button>
            </div>)}
            {c.attachments.length===0&&<p className="text-zinc-600 text-xs text-center py-6">No attachments</p>}
            <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-400 h-7 text-xs w-full mt-2"><Paperclip className="w-3 h-3 mr-1"/>Upload</Button>
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
    {showStatus&&<StatusModal c={c} onClose={()=>setShowStatus(false)} onUpdate={(id,patch)=>{handleUpdate(id,patch);setShowStatus(false);}}/>}
    {showHandoff&&<HandoffModal c={c} onClose={()=>setShowHandoff(false)} onUpdate={(id,patch)=>{handleUpdate(id,patch);setShowHandoff(false);}}/>}
    {showRfi&&<RfiModal c={c} onClose={()=>setShowRfi(false)} onUpdate={(id,patch)=>{handleUpdate(id,patch);setShowRfi(false);}}/>}
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

// ─── CASE TYPES PANEL ─────────────────────────────────────────────────────────
function CaseTypesPanel({caseTypes}:{caseTypes:CaseType[]}){
  const [exp,setExp]=useState<string|null>(null);
  if(caseTypes.length===0)return <div className="text-zinc-600 text-xs text-center py-8">Loading case types… (ensure migration has been run)</div>;
  return <div className="space-y-3">{caseTypes.map(t=><div key={t.id} className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
    <div className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-zinc-800/30" onClick={()=>setExp(exp===t.id?null:t.id)}>
      <div className="flex items-center gap-3 flex-wrap">
        <div className={`w-2 h-2 rounded-full ${t.active?"bg-green-400":"bg-zinc-600"}`}/>
        <p className="text-white text-sm font-semibold">{t.name}</p>
        <DeptBadge dept={t.department}/>
        {t.approvalRequired&&<Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-400">Approval Required</Badge>}
        <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">v{t.version}</Badge>
        {t.triggerType==="auto"&&<Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400">Auto</Badge>}
      </div>
      {exp===t.id?<ChevronDown className="w-4 h-4 text-zinc-500 shrink-0"/>:<ChevronRight className="w-4 h-4 text-zinc-500 shrink-0"/>}
    </div>
    {exp===t.id&&<div className="px-5 pb-5 border-t border-zinc-800">
      <div className="overflow-x-auto mt-3">
        <table className="w-full text-xs min-w-[520px]">
          <thead><tr className="border-b border-zinc-800">{["Key","Label","Type","Required At","Options"].map(h=><th key={h} className="pb-2 pr-4 text-left text-zinc-500 font-medium">{h}</th>)}</tr></thead>
          <tbody>{t.fields.map(f=><tr key={f.key} className="border-b border-zinc-800/40 last:border-0">
            <td className="py-2 pr-4 font-mono text-indigo-300 text-[10px]">{f.key}</td>
            <td className="py-2 pr-4 text-zinc-200">{f.label}{f.conditionalOn&&<span className="ml-1 text-[9px] text-zinc-600">if {f.conditionalOn.key}={f.conditionalOn.value}</span>}</td>
            <td className="py-2 pr-4 text-zinc-400">{f.type}</td>
            <td className="py-2 pr-4 text-zinc-400">{f.requiredAt}</td>
            <td className="py-2 pr-4 text-zinc-500">{f.options?.join(", ")||"—"}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>}
  </div>)}</div>;
}

// ─── MAIN PAGE INNER ──────────────────────────────────────────────────────────
function CasesInner(){
  const router=useRouter();
  const params=useSearchParams();
  const [user,setUser]=useState<Record<string,unknown>|null>(null);
  const [cases,setCases]=useState<Case[]>([]);
  const [caseTypes,setCaseTypes]=useState<CaseType[]>([]);
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

  useEffect(()=>{
    fetch("/api/auth/me").then(async r=>{if(r.status===401){router.push("/login");return;}const d=await r.json();setUser(d.user);});
    fetch("/api/case-types").then(async r=>{if(r.ok){const d=await r.json();setCaseTypes(d.caseTypes||[]);}}).catch(()=>{});
    if(params?.get("create")==="true")setShowCreate(true);
  },[router,params]);

  useEffect(()=>{fetchCases();},[fetchCases]);

  function updateCase(id:string,patch:Partial<Case>){setCases(prev=>prev.map(c=>c.id===id?{...c,...patch}:c));}
  function toggleSelect(id:string){setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);}

  const openCount=cases.filter(c=>["new","active","rfi"].includes(c.status)).length;

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
        {[["cases","Cases"],["analytics","Analytics"],["types","Case Types (Admin)"]].map(([id,label])=>
          <button key={id} onClick={()=>setTab(id)} data-testid={`tab-${id}`} className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 cursor-pointer transition-colors ${tab===id?"border-indigo-500 text-indigo-400":"border-transparent text-zinc-500 hover:text-zinc-300"}`}>{label}</button>
        )}
      </div>
    </div>

    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {tab==="analytics"&&<AnalyticsPanel/>}
      {tab==="types"&&<CaseTypesPanel caseTypes={caseTypes}/>}
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
                {!loading&&cases.map(c=><tr key={c.id} data-testid={`case-row-${c.id}`} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer" onClick={()=>setDetailCaseId(c.id)}>
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
                  <td className="px-3 py-2.5"><button className="text-indigo-400 hover:text-indigo-300 cursor-pointer" onClick={e=>{e.stopPropagation();setDetailCaseId(c.id);}}><Eye className="w-3.5 h-3.5"/></button></td>
                </tr>)}
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
    {detailCaseId&&<CaseDetail caseId={detailCaseId} onClose={()=>setDetailCaseId(null)} onUpdate={updateCase} caseTypes={caseTypes}/>}
  </div>;
}

// Suspense boundary required for useSearchParams in Next.js App Router
export default function CasesPage(){
  return <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-6 h-6 border-2 border-white/20 border-t-indigo-500 rounded-full animate-spin"/></div>}><CasesInner/></Suspense>;
}
