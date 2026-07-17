"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Shield, AlertTriangle, CheckCircle, Clock, Building2,
  ChevronDown, ChevronRight, Plus, X, ExternalLink,
  RefreshCw, Eye, Download, Flag, AlertCircle, Info,
  Search, Edit2, Link2, CheckCircle2, TrendingUp, TrendingDown, Trash2, Bell,
  History, FileText, User, Globe, DollarSign,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashNav } from "@/components/dash-nav";

// ─── TYPES ────────────────────────────────────────────────────────────────────
type RiskLevel = "Low" | "Medium" | "High";
type LicenceStatus = "Valid"|"Expiring"|"Expired"|"Suspended"|"Revoked"|"Unverified"|"Not Required";
type EvidenceStatus = "Pending"|"Accepted"|"Rejected"|"Requires Review";

interface CountryPct { country: string; pct: number }
interface MerchantState {
  id: string; verificationId: string; email: string; name: string;
  registrationNumber: string; incorporationDate: string; incorporationCountry: string;
  headOfficeCountry: string; registeredAddress: string; industry: string; mcc: string;
  website: string; activityDescription: string; licenceRequired: boolean; licenceType: string;
  products: string; currency: string; monthlyTurnover: number;
  countriesOfOperation: CountryPct[]; repFirstName: string; repLastName: string;
  repDob: string; repCountry: string; repAddress: string; repRelationship: string;
  nomineeOwnership: boolean; status: string; operatedBy: string;
  openNotifications: number; riskPolicyVersion: string;
}
interface Party {
  id: string; type: string; roles: string[]; name: string; country: string;
  ownership: number; voting: number; parent: string|null;
  pepStatus: string; screeningStatus: string; active: boolean;
}
interface Licence {
  id: string; type: string; regulator: string; regulatorCountry: string;
  number: string; status: LicenceStatus; issueDate: string; expiryDate: string;
  lastVerified: string; verifiedBy: string; registryUrl: string; note: string;
}
interface Evidence {
  id: string; evidenceType: string; party: string; category: string;
  description: string; amount: number; currency: string; dateIssued: string;
  status: EvidenceStatus; reviewer: string; reviewDate: string;
  reviewNotes: string; inconsistencyFlag: boolean;
}
interface RiskFactor {
  factor: string; sourceValue: string; factorRisk: RiskLevel;
  weight: number; contribution: number; source: string;
}
interface RiskResult { score: number; level: RiskLevel; factors: RiskFactor[]; overrides: string[] }
interface SaveMsg { msg: string; kind: "neutral"|"warn"|"good" }

// ─── RISK ENGINE ─────────────────────────────────────────────────────────────
const HIGH_INC = new Set(["Russia","Belarus","Iran","North Korea","Myanmar","Cuba","Sudan","Syria","Afghanistan"]);
const MED_INC  = new Set(["China","UAE","Turkey","Brazil","India","Nigeria","Pakistan","Ukraine","Serbia"]);
const HIGH_IND = new Set(["Financial Services","Cryptocurrency","Crypto Exchange","Gambling","Adult Entertainment","Money Transfer","Arms","Weapons"]);
const MED_IND  = new Set(["Insurance","Real Estate","Precious Metals","Legal Services","Accountancy","Trust Services"]);

function calculateRisk(m: MerchantState, licences: Licence[], parties: Party[]): RiskResult {
  const f: RiskFactor[] = []; let total = 0;
  const add = (factor: string, val: string, r: RiskLevel, w: number, c: number, src: string) => { total+=c; f.push({factor,sourceValue:val,factorRisk:r,weight:w,contribution:c,source:src}); };
  const incR: RiskLevel = HIGH_INC.has(m.incorporationCountry)?"High":MED_INC.has(m.incorporationCountry)?"Medium":"Low";
  add("Country of Incorporation",m.incorporationCountry,incR,10,incR==="High"?10:incR==="Medium"?5:2,"Pre-check");
  const yrs=Math.max(0,Math.floor((Date.now()-new Date(m.incorporationDate||"2020-01-01").getTime())/(365.25*24*3600*1000)));
  const ageR: RiskLevel=yrs<1?"High":yrs<3?"Medium":"Low";
  add("Company Age",`${yrs}yr`,ageR,5,ageR==="High"?5:ageR==="Medium"?3:1,"Pre-check");
  const les=parties.filter(p=>p.type==="Legal Entity"&&p.active).length;
  const owR: RiskLevel=les>=3?"High":les>=1?"Medium":"Low";
  add("Ownership Structure",`${parties.filter(p=>p.active).length} parties, ${les} LEs`,owR,10,owR==="High"?10:owR==="Medium"?6:2,"Shareholders");
  const ubos=parties.filter(p=>p.roles.includes("UBO")&&p.active);
  const uboR: RiskLevel=ubos.some(u=>HIGH_INC.has(u.country))?"High":ubos.some(u=>MED_INC.has(u.country))?"Medium":"Low";
  add("UBO Residence",ubos.map(u=>u.country).join(",")||"—",uboR,5,uboR==="High"?5:uboR==="Medium"?3:1,"Beneficiaries");
  const dirR: RiskLevel=HIGH_INC.has(m.repCountry)?"High":MED_INC.has(m.repCountry)?"Medium":"Low";
  add("Director Residence",m.repCountry||"—",dirR,5,dirR==="High"?5:dirR==="Medium"?3:1,"Representative");
  const indR: RiskLevel=HIGH_IND.has(m.industry)?"High":MED_IND.has(m.industry)?"Medium":"Low";
  add("Industry/MCC",`${m.industry}(${m.mcc})`,indR,15,indR==="High"?15:indR==="Medium"?8:3,"Company Activity");
  add("AML Regulated",m.licenceRequired?"Yes":"No",m.licenceRequired?"High":"Low",15,m.licenceRequired?15:0,"Company Activity");
  const pstr=(m.products||"").toLowerCase();
  const pR: RiskLevel=pstr.includes("crypto")||pstr.includes("cash")?"High":pstr.includes("fx")||pstr.includes("card")?"Medium":"Low";
  add("Product Needed",m.products||"—",pR,10,pR==="High"?10:pR==="Medium"?5:2,"Products");
  const nC=m.countriesOfOperation.length;
  const gR: RiskLevel=nC>10?"High":nC>5?"Medium":"Low";
  add("Geography",`${nC} countries`,gR,5,gR==="High"?5:gR==="Medium"?3:1,"Countries");
  const ann=m.monthlyTurnover*12;
  const tvR: RiskLevel=ann>5_000_000?"High":ann>500_000?"Medium":"Low";
  add("Annual Turnover",`${m.currency} ${ann.toLocaleString()}`,tvR,10,tvR==="High"?10:tvR==="Medium"?5:1,"Pre-check×12");
  add("Nominee Ownership",m.nomineeOwnership?"Yes":"No",m.nomineeOwnership?"High":"Low",5,m.nomineeOwnership?5:0,"KYB Controls");
  add("PEP/RCA","No match","Low",5,2,"Screening");
  const score=Math.min(85,total);
  const overrides: string[]=[];
  if(m.licenceRequired) overrides.push("Licence Required");
  if(m.nomineeOwnership) overrides.push("Nominee Ownership");
  if(ubos.some(u=>u.pepStatus==="PEP")) overrides.push("Confirmed PEP/RCA");
  if(m.countriesOfOperation.some(c=>HIGH_INC.has(c.country))) overrides.push("Prohibited Country");
  const level: RiskLevel = overrides.length>0?"High":score>=50?"High":score>=25?"Medium":"Low";
  return {score,level,factors:f,overrides};
}

function buildSaveMsg(oScore: number, oLevel: RiskLevel, nScore: number, nLevel: RiskLevel): SaveMsg {
  if(nLevel!==oLevel) return {msg:`KYB data saved. Risk level changed from ${oLevel} to ${nLevel}.`,kind:nLevel==="High"?"warn":nLevel==="Low"?"good":"neutral"};
  if(Math.abs(nScore-oScore)>=2) return {msg:`KYB data saved. Score changed from ${oScore}% to ${nScore}%. Risk level remains ${nLevel}.`,kind:"neutral"};
  return {msg:`KYB data saved. Risk level remains ${nLevel}.`,kind:"neutral"};
}

// ─── INITIAL DATA ─────────────────────────────────────────────────────────────
const INIT_M: MerchantState = {
  id:"MCH-2847",verificationId:"VER-9341",email:"compliance@fintechsolutions.com",name:"FinTech Solutions Ltd",
  registrationNumber:"EE102847291",incorporationDate:"2019-03-15",incorporationCountry:"Estonia",
  headOfficeCountry:"Estonia",registeredAddress:"Tallinn, Maakri 19, 10145",
  industry:"Financial Services",mcc:"6099",website:"https://fintechsolutions.ee",
  activityDescription:"Payment services and e-money issuance for B2B clients",
  licenceRequired:true,licenceType:"Payment Institution — Full",
  products:"SEPA Transfers, Card Acquiring, FX",currency:"EUR",monthlyTurnover:125000,
  countriesOfOperation:[{country:"Estonia",pct:40},{country:"Latvia",pct:30},{country:"Lithuania",pct:20},{country:"Germany",pct:10}],
  repFirstName:"Karl",repLastName:"Mägi",repDob:"1982-07-14",
  repCountry:"Estonia",repAddress:"Tallinn, Narva mnt 5-12",repRelationship:"Director & UBO (35%)",
  nomineeOwnership:false,status:"Pending",operatedBy:"Sarah K.",openNotifications:2,riskPolicyVersion:"v2.3.1",
};
const INIT_PARTIES: Party[] = [
  {id:"p1",type:"Natural Person",roles:["Director","UBO"],name:"Karl Mägi",country:"Estonia",ownership:35,voting:35,parent:null,pepStatus:"Clear",screeningStatus:"Clear",active:true},
  {id:"p2",type:"Legal Entity",roles:["Shareholder"],name:"Baltic Holding OÜ",country:"Estonia",ownership:40,voting:40,parent:null,pepStatus:"N/A",screeningStatus:"Clear",active:true},
  {id:"p3",type:"Natural Person",roles:["UBO"],name:"Anna Schulz",country:"Germany",ownership:25,voting:25,parent:"p2",pepStatus:"Clear",screeningStatus:"Clear",active:true},
  {id:"p4",type:"Natural Person",roles:["Representative"],name:"Mart Tamm",country:"Estonia",ownership:0,voting:0,parent:null,pepStatus:"Clear",screeningStatus:"Clear",active:true},
];
const INIT_LICENCES: Licence[] = [
  {id:"lic1",type:"Payment Institution Licence",regulator:"Finantsinspektsioon",regulatorCountry:"Estonia",number:"4.00-1/2020/042",status:"Valid",issueDate:"2020-06-01",expiryDate:"2027-06-01",lastVerified:"2026-01-15",verifiedBy:"Maria L.",registryUrl:"https://www.fi.ee",note:"Full payment institution licence"},
];
const INIT_EVIDENCE: Evidence[] = [
  {id:"s1",evidenceType:"SoF",party:"Company",category:"Profits Generated from Activities",description:"Annual accounts 2024 and 2025 showing operating profit",amount:380000,currency:"EUR",dateIssued:"2026-01-31",status:"Accepted",reviewer:"Maria L.",reviewDate:"2026-03-15",reviewNotes:"Consistent with stated business activity",inconsistencyFlag:false},
  {id:"s2",evidenceType:"SoW",party:"Karl Mägi (UBO)",category:"Salary",description:"Employment contract and payslips for 24 months",amount:96000,currency:"EUR",dateIssued:"2025-12-01",status:"Accepted",reviewer:"Maria L.",reviewDate:"2026-03-15",reviewNotes:"Salary consistent with director role",inconsistencyFlag:false},
];
const MOCK_SCREENING = [
  {id:"sc1",subject:"FinTech Solutions Ltd",type:"Company",monitoring:"Active",match:"No Match",pep:"N/A",updated:"2026-06-25",source:"ComplyAdvantage"},
  {id:"sc2",subject:"Karl Mägi",type:"Director/UBO",monitoring:"Active",match:"No Match",pep:"Clear",updated:"2026-06-25",source:"ComplyAdvantage"},
  {id:"sc3",subject:"Anna Schulz",type:"UBO",monitoring:"Active",match:"No Match",pep:"Clear",updated:"2026-06-25",source:"ComplyAdvantage"},
  {id:"sc4",subject:"Baltic Holding OÜ",type:"Shareholder",monitoring:"Active",match:"No Match",pep:"N/A",updated:"2026-06-25",source:"ComplyAdvantage"},
];
const MOCK_HISTORY = [
  {id:"h1",date:"2026-07-01 14:31",operator:"Sarah K.",action:"Risk Assessment",tab:"Risk Summary",field:"Final Risk Level",oldVal:"Medium",newVal:"High",reason:"Licence Required override — payment institution licence detected"},
  {id:"h2",date:"2026-06-28 10:15",operator:"Maria L.",action:"Data Edit",tab:"Licence & Regulatory",field:"Licence Status",oldVal:"Unverified",newVal:"Valid",reason:"Registry check confirmed active licence"},
  {id:"h3",date:"2026-06-25 16:44",operator:"Tom B.",action:"Screening Update",tab:"Screening",field:"Match Status",oldVal:"Pending",newVal:"No Match",reason:"ComplyAdvantage automated update"},
  {id:"h4",date:"2026-06-20 09:02",operator:"Sarah K.",action:"Data Edit",tab:"Pre-check",field:"Monthly Turnover",oldVal:"EUR 80,000",newVal:"EUR 125,000",reason:"Updated per latest bank statement"},
  {id:"h5",date:"2026-06-15 11:30",operator:"Maria L.",action:"Party Added",tab:"Ownership",field:"Anna Schulz (UBO)",oldVal:"—",newVal:"25% UBO via Baltic Holding OÜ",reason:"Ownership structure clarification"},
  {id:"h6",date:"2026-06-10 08:55",operator:"Tom B.",action:"SoF Accepted",tab:"SoF/SoW",field:"Annual Accounts 2024–2025",oldVal:"Pending",newVal:"Accepted",reason:"Documents reviewed — consistent with activity"},
  {id:"h7",date:"2026-06-01 15:20",operator:"System",action:"Verification Created",tab:"—",field:"VER-9341",oldVal:"—",newVal:"Pending",reason:"New merchant onboarding"},
];
const MOCK_ALERTS = [
  {id:"a1",priority:"High",type:"Expiry",subject:"Licence expiry approaching",message:"Payment Institution Licence 4.00-1/2020/042 expires on 01 June 2027 — re-verification required by 01 April 2027.",created:"2026-07-01",assignee:"Sarah K.",status:"Open"},
  {id:"a2",priority:"Medium",type:"Data",subject:"Country of operations update needed",message:"Merchant has indicated expansion to new markets. Countries of operation require update.",created:"2026-06-28",assignee:"Maria L.",status:"Open"},
];
const VERIF_LIST = [
  {id:"VER-9341",merchant:"FinTech Solutions Ltd",email:"compliance@fintechsolutions.com",status:"Pending",risk:"High" as RiskLevel,score:64,basis:"Licence Required",assessDate:"2026-07-01",revDate:"2027-07-01",licStatus:"Valid" as LicenceStatus,alerts:2,op:"Sarah K."},
  {id:"VER-9289",merchant:"CryptoExchange GmbH",email:"kyb@cryptoex.de",status:"Accepted",risk:"High" as RiskLevel,score:78,basis:"Industry",assessDate:"2026-06-18",revDate:"2027-06-18",licStatus:"Expiring" as LicenceStatus,alerts:1,op:"Maria L."},
  {id:"VER-9201",merchant:"NordShop AB",email:"legal@nordshop.se",status:"Accepted",risk:"Low" as RiskLevel,score:22,basis:"—",assessDate:"2026-05-30",revDate:"2029-05-30",licStatus:"Not Required" as LicenceStatus,alerts:0,op:"Tom B."},
  {id:"VER-9155",merchant:"PayDirect Sp. z o.o.",email:"compliance@paydirect.pl",status:"Pending",risk:"Medium" as RiskLevel,score:45,basis:"Turnover",assessDate:"2026-06-10",revDate:"2028-06-10",licStatus:"Valid" as LicenceStatus,alerts:0,op:"Sarah K."},
  {id:"VER-9100",merchant:"RetailHub Ltd",email:"admin@retailhub.ie",status:"Accepted",risk:"Low" as RiskLevel,score:18,basis:"—",assessDate:"2026-04-22",revDate:"2029-04-22",licStatus:"Not Required" as LicenceStatus,alerts:0,op:"Tom B."},
];

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const ALL_COUNTRIES=["Afghanistan","Albania","Algeria","Armenia","Australia","Austria","Azerbaijan","Bangladesh","Belarus","Belgium","Brazil","Bulgaria","Cambodia","Canada","China","Colombia","Croatia","Cuba","Cyprus","Czech Republic","Denmark","Egypt","Estonia","Finland","France","Georgia","Germany","Ghana","Greece","Hungary","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Japan","Jordan","Kazakhstan","Kenya","Latvia","Lebanon","Lithuania","Luxembourg","Malaysia","Malta","Mexico","Moldova","Montenegro","Morocco","Myanmar","Netherlands","Nigeria","North Korea","Norway","Pakistan","Panama","Poland","Portugal","Romania","Russia","Serbia","Singapore","Slovakia","Slovenia","South Korea","Spain","Sudan","Sweden","Switzerland","Syria","Turkey","UAE","Ukraine","United Kingdom","United States","Uzbekistan","Vietnam","Zimbabwe"];
const INDUSTRIES=["Financial Services","Banking","Insurance","Real Estate","Cryptocurrency","Crypto Exchange","Gambling","Adult Entertainment","Money Transfer","Arms","Weapons","Retail","E-Commerce","Technology","Healthcare","Legal Services","Accountancy","Trust Services","Logistics","Manufacturing","Education","Media","Hospitality","Other"];
const LICENCE_TYPES=["Payment Institution Licence","E-Money Institution Licence","Investment Firm Licence","Banking Licence","Crypto Asset Service Provider","Money Transmitter Licence","Other Regulated Activity"];
const LICENCE_STATUSES: LicenceStatus[]=["Valid","Expiring","Expired","Suspended","Revoked","Unverified"];
const EVIDENCE_STATUSES: EvidenceStatus[]=["Pending","Accepted","Rejected","Requires Review"];
const SOF_CATS=["Beneficial Owners' Funds","Shareholders' Funds","Initial Capital","Loan","Equity Instrument","Profits Generated from Activities","Sale of Goods","Sale of Property","Sale of Shares","Investment","Other"];
const SOW_CATS=["Salary","Company Profit / Dividends","Forex / Crypto Trading","Savings / Deposits","Gift / Donation","Inheritance","Scholarship","Retirement Income","Grants","Sale of Business","Other"];
const OVERRIDE_REASONS=["Additional Documents Reviewed","Complex Ownership Structure","Licence Verification Concern","PEP/RCA Review Outcome","SoF/SoW Inconsistency","Jurisdiction Concern","Adverse Information","Senior Compliance Decision","Other"];

// ─── SHARED BADGES ────────────────────────────────────────────────────────────
function RiskBadge({level,override}:{level:RiskLevel;override?:string}){
  const m={Low:"bg-green-500/15 text-green-400 border-green-500/30",Medium:"bg-amber-500/15 text-amber-400 border-amber-500/30",High:"bg-red-500/15 text-red-400 border-red-500/30"};
  return <span className="inline-flex items-center gap-1"><Badge variant="outline" className={`text-xs font-semibold ${m[level]}`}>{level}</Badge>{override&&<Badge variant="outline" className="text-[10px] border-red-500/20 text-red-500/70">Override</Badge>}</span>;
}
function LicBadge({status}:{status:LicenceStatus}){
  const m={Valid:"bg-green-500/15 text-green-400 border-green-500/30",Expiring:"bg-amber-500/15 text-amber-400 border-amber-500/30",Expired:"bg-red-500/15 text-red-400 border-red-500/30",Suspended:"bg-red-500/15 text-red-400 border-red-500/30",Revoked:"bg-red-800/30 text-red-300 border-red-500/40",Unverified:"bg-zinc-500/15 text-zinc-400 border-zinc-600","Not Required":"bg-zinc-800 text-zinc-500 border-zinc-700"};
  return <Badge variant="outline" className={`text-[10px] ${m[status]}`}>{status}</Badge>;
}
function EvBadge({status}:{status:EvidenceStatus}){
  const m={Accepted:"bg-green-500/15 text-green-400 border-green-500/30",Pending:"bg-zinc-500/15 text-zinc-400 border-zinc-600",Rejected:"bg-red-500/15 text-red-400 border-red-500/30","Requires Review":"bg-amber-500/15 text-amber-400 border-amber-500/30"};
  return <Badge variant="outline" className={`text-[10px] ${m[status]}`}>{status}</Badge>;
}
function StatusBadge({status}:{status:string}){
  const cls=status==="Accepted"?"bg-green-500/15 text-green-400 border-green-500/30":status==="Rejected"?"bg-red-500/15 text-red-400 border-red-500/30":"bg-zinc-500/15 text-zinc-400 border-zinc-600";
  return <Badge variant="outline" className={`text-[10px] ${cls}`}>{status}</Badge>;
}
function RiskDot({level}:{level:RiskLevel}){
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ml-1 ${level==="High"?"bg-red-400":level==="Medium"?"bg-amber-400":"bg-green-400"}`}/>;
}

// ─── SHARED FORM HELPERS ──────────────────────────────────────────────────────
function KV({label,value}:{label:string;value:React.ReactNode}){
  return <div className="flex items-start justify-between gap-4 py-1.5 border-b border-zinc-800/50 last:border-0"><span className="text-zinc-500 text-xs shrink-0">{label}</span><span className="text-xs text-right text-zinc-200">{value}</span></div>;
}
function SCard({title,children,action,accent}:{title:string;children:React.ReactNode;action?:React.ReactNode;accent?:string}){
  return <div className={`rounded-xl border ${accent||"border-zinc-800"} bg-zinc-900 overflow-hidden`}><div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800"><h3 className="text-sm font-semibold text-white">{title}</h3>{action&&<div>{action}</div>}</div><div className="p-5">{children}</div></div>;
}
function FG({label,children,span2,req}:{label:string;children:React.ReactNode;span2?:boolean;req?:boolean}){
  return <div className={span2?"col-span-2":undefined}><Label className="text-zinc-400 text-[10px] mb-1 block">{label}{req&&<span className="text-red-400 ml-0.5">*</span>}</Label>{children}</div>;
}
function FIn({value,onChange,type,placeholder}:{value:string|number;onChange:(v:string)=>void;type?:string;placeholder?:string}){
  return <Input type={type||"text"} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="bg-zinc-800 border-zinc-700 text-white text-xs h-8"/>;
}
function FSel({value,onChange,opts}:{value:string;onChange:(v:string)=>void;opts:string[]}){
  return <select value={value} onChange={e=>onChange(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white h-8 focus:outline-none focus:border-indigo-500">{opts.map(o=><option key={o} value={o}>{o}</option>)}</select>;
}
function FTa({value,onChange,placeholder,rows}:{value:string;onChange:(v:string)=>void;placeholder?:string;rows?:number}){
  return <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows||3} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"/>;
}
function ReasonField({value,onChange}:{value:string;onChange:(v:string)=>void}){
  return <div className="border-t border-zinc-800 pt-4"><FG label="Change Reason (required — min 10 chars)" req><FTa value={value} onChange={onChange} placeholder="Reason for this change…" rows={2}/></FG></div>;
}

// ─── MODAL SHELL ─────────────────────────────────────────────────────────────
function Modal({title,onClose,onSave,saving,canSave,children}:{title:string;onClose:()=>void;onSave:()=>void;saving:boolean;canSave?:boolean;children:React.ReactNode}){
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh]"><div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0"><h3 className="text-white font-bold text-sm">{title}</h3><button onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer"><X className="w-4 h-4"/></button></div><div className="overflow-y-auto p-6 space-y-4 flex-1">{children}</div><div className="px-6 py-4 border-t border-zinc-800 flex gap-3 justify-end shrink-0"><Button variant="outline" onClick={onClose} className="border-zinc-700 text-zinc-400 h-8 text-xs">Cancel</Button><Button onClick={onSave} disabled={saving||(canSave===false)} className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs disabled:opacity-50">{saving?"Saving…":"Save changes"}</Button></div></div></div>;
}
function ConfirmDelete({subject,onConfirm,onClose}:{subject:string;onConfirm:()=>void;onClose:()=>void}){
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="bg-zinc-900 border border-red-500/40 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center"><Trash2 className="w-8 h-8 text-red-400 mx-auto mb-3"/><p className="text-white font-semibold mb-1">Delete record?</p><p className="text-zinc-400 text-xs mb-5">This will permanently remove <span className="text-white font-medium">{subject}</span>. Risk will be recalculated.</p><div className="flex gap-3"><Button variant="outline" onClick={onClose} className="flex-1 border-zinc-700 text-zinc-400 h-8 text-xs">Cancel</Button><Button onClick={onConfirm} className="flex-1 bg-red-600 hover:bg-red-700 h-8 text-xs">Delete</Button></div></div></div>;
}

// ─── SAVE BANNER ─────────────────────────────────────────────────────────────
function SaveBanner({msg,kind,onClose}:{msg:string;kind:"neutral"|"warn"|"good";onClose:()=>void}){
  const cls=kind==="warn"?"bg-red-500/15 border-red-500/40 text-red-300":kind==="good"?"bg-green-500/15 border-green-500/40 text-green-300":"bg-indigo-500/15 border-indigo-500/40 text-indigo-300";
  const Icon=kind==="warn"?TrendingUp:kind==="good"?TrendingDown:CheckCircle2;
  return <div className={`rounded-lg border p-3 flex items-center gap-3 mb-4 ${cls}`}><Icon className="w-4 h-4 shrink-0"/><span className="text-xs flex-1">{msg}</span><button onClick={onClose} className="cursor-pointer opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5"/></button></div>;
}

// ─── HISTORY MODAL ────────────────────────────────────────────────────────────
function HistoryModal({onClose}:{onClose:()=>void}){
  return <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4"><div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-3xl shadow-2xl max-h-[85vh] flex flex-col"><div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0"><h3 className="text-white font-bold flex items-center gap-2"><History className="w-4 h-4 text-indigo-400"/>Audit History</h3><button onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer"><X className="w-4 h-4"/></button></div><div className="overflow-y-auto flex-1"><table className="w-full text-xs"><thead><tr className="border-b border-zinc-800 sticky top-0 bg-zinc-900">{["Date","Operator","Action","Tab","Field","Old Value","New Value","Reason"].map(h=><th key={h} className="px-4 py-2.5 text-left text-zinc-500 font-medium whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{MOCK_HISTORY.map(h=><tr key={h.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/30"><td className="px-4 py-2.5 text-zinc-500 whitespace-nowrap">{h.date}</td><td className="px-4 py-2.5 text-zinc-300">{h.operator}</td><td className="px-4 py-2.5 text-indigo-400">{h.action}</td><td className="px-4 py-2.5 text-zinc-400">{h.tab}</td><td className="px-4 py-2.5 text-zinc-200 font-medium">{h.field}</td><td className="px-4 py-2.5 text-zinc-500">{h.oldVal}</td><td className="px-4 py-2.5 text-green-400">{h.newVal}</td><td className="px-4 py-2.5 text-zinc-500 max-w-[180px] truncate" title={h.reason}>{h.reason}</td></tr>)}</tbody></table></div><div className="px-6 py-4 border-t border-zinc-800 flex justify-between items-center shrink-0"><span className="text-xs text-zinc-500">{MOCK_HISTORY.length} entries · Full audit trail</span><Button variant="outline" size="sm" className="border-zinc-700 text-zinc-400 h-7 text-xs"><Download className="w-3 h-3 mr-1"/>Export</Button></div></div></div>;
}

// ─── ALERTS MODAL ─────────────────────────────────────────────────────────────
function AlertsModal({count,onClose}:{count:number;onClose:()=>void}){
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-xl shadow-2xl max-h-[85vh] flex flex-col"><div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0"><h3 className="text-white font-bold flex items-center gap-2"><Bell className="w-4 h-4 text-red-400"/>Open Alerts <span className="ml-1 bg-red-500/20 text-red-400 text-xs px-1.5 py-0.5 rounded-full font-bold">{count}</span></h3><button onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer"><X className="w-4 h-4"/></button></div><div className="overflow-y-auto flex-1 p-6 space-y-3">{MOCK_ALERTS.map(a=><div key={a.id} className={`rounded-xl border p-4 ${a.priority==="High"?"border-red-500/30 bg-red-500/10":"border-amber-500/30 bg-amber-500/10"}`}><div className="flex items-start justify-between gap-3 mb-1"><div><span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${a.priority==="High"?"bg-red-500/20 text-red-400":"bg-amber-500/20 text-amber-400"}`}>{a.priority}</span><span className="text-[10px] text-zinc-500 ml-2">{a.type}</span></div><span className="text-[10px] text-zinc-600">{a.created}</span></div><p className="text-sm font-semibold text-white mb-1">{a.subject}</p><p className="text-xs text-zinc-400 mb-3">{a.message}</p><div className="flex items-center justify-between"><span className="text-[10px] text-zinc-500">Assigned: {a.assignee}</span><div className="flex gap-2"><Button size="sm" className="h-6 text-[10px] bg-indigo-600 hover:bg-indigo-700">Resolve</Button><Button variant="outline" size="sm" className="h-6 text-[10px] border-zinc-700 text-zinc-400">Dismiss</Button></div></div></div>)}</div></div></div>;
}

// ─── MANUAL OVERRIDE MODAL ────────────────────────────────────────────────────
function OverrideModal({risk,onClose,onSaved}:{risk:RiskResult;onClose:()=>void;onSaved:(msg:SaveMsg)=>void}){
  const [newRisk,setNewRisk]=useState<RiskLevel>(risk.level);
  const [cat,setCat]=useState("");const [detail,setDetail]=useState("");const [confirmed,setConfirmed]=useState(false);const [saving,setSaving]=useState(false);
  const ok=newRisk&&cat&&detail.length>=20&&confirmed;
  async function save(){setSaving(true);await new Promise(r=>setTimeout(r,1000));setSaving(false);onSaved({msg:`Manual risk override applied. Final Risk set to ${newRisk}.`,kind:newRisk==="High"?"warn":newRisk==="Low"?"good":"neutral"});onClose();}
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl"><div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800"><h3 className="text-white font-bold flex items-center gap-2"><Flag className="w-4 h-4 text-amber-400"/>Manual Risk Override</h3><button onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer"><X className="w-4 h-4"/></button></div><div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto"><div className="grid grid-cols-2 gap-3"><div className="p-3 rounded-lg bg-zinc-800/50"><p className="text-[10px] text-zinc-500 mb-1">Calculated Risk</p><RiskBadge level={risk.level}/></div><div className="p-3 rounded-lg bg-zinc-800/50"><p className="text-[10px] text-zinc-500 mb-1">Weighted Score</p><span className="text-white font-mono font-bold">{risk.score}%</span></div></div><div><Label className="text-zinc-400 text-xs mb-2 block">New Final Risk *</Label><div className="flex gap-2">{(["Low","Medium","High"] as RiskLevel[]).map(r=><button key={r} onClick={()=>setNewRisk(r)} className={`flex-1 py-2 rounded-lg border text-xs font-semibold cursor-pointer ${newRisk===r?(r==="High"?"border-red-500 bg-red-500/15 text-red-400":r==="Medium"?"border-amber-500 bg-amber-500/15 text-amber-400":"border-green-500 bg-green-500/15 text-green-400"):"border-zinc-700 text-zinc-500 hover:border-zinc-600"}`}>{r}</button>)}</div></div><FG label="Override Reason Category" req><FSel value={cat} onChange={setCat} opts={["",...OVERRIDE_REASONS]}/></FG><FG label="Detailed Justification (min 20 chars)" req><FTa value={detail} onChange={setDetail} placeholder="Provide detailed justification…" rows={3}/><p className="text-[10px] text-zinc-600 text-right mt-0.5">{detail.length} chars</p></FG><label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="accent-indigo-500 mt-0.5"/><span className="text-xs text-zinc-400">I confirm this override is authorised and will be recorded in the audit trail.</span></label></div><div className="px-6 py-4 border-t border-zinc-800 flex gap-3 justify-end"><Button variant="outline" onClick={onClose} className="border-zinc-700 text-zinc-400 h-8 text-xs">Cancel</Button><Button onClick={save} disabled={!ok||saving} className="bg-amber-500 hover:bg-amber-600 text-white h-8 text-xs disabled:opacity-50">{saving?"Saving…":"Apply Override"}</Button></div></div></div>;
}

// ─── RISK SUMMARY TAB ─────────────────────────────────────────────────────────
function RiskSummaryTab({risk,prevRisk,merchant,onOverride,onHistory,onAlerts}:{risk:RiskResult;prevRisk:RiskResult|null;merchant:MerchantState;onOverride:()=>void;onHistory:()=>void;onAlerts:()=>void}){
  const [recalc,setRecalc]=useState(false);
  return <div className="space-y-5">
    {prevRisk&&prevRisk.score!==risk.score&&<div className={`rounded-lg border p-3 flex items-center gap-3 text-xs ${risk.score>prevRisk.score?"bg-red-500/10 border-red-500/30 text-red-300":"bg-green-500/10 border-green-500/30 text-green-300"}`}>{risk.score>prevRisk.score?<TrendingUp className="w-4 h-4"/>:<TrendingDown className="w-4 h-4"/>}Score {risk.score>prevRisk.score?"increased":"decreased"} from <strong>{prevRisk.score}%</strong> to <strong>{risk.score}%</strong>{risk.level!==prevRisk.level&&<> · Level changed from <strong>{prevRisk.level}</strong> to <strong>{risk.level}</strong></>}</div>}
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-950/40"><h3 className="text-sm font-semibold text-white flex items-center gap-2"><Shield className="w-4 h-4 text-indigo-400"/>KYB Risk Summary</h3></div>
      <div className="grid sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-800">
        <div className="p-4"><p className="text-[10px] text-zinc-500 uppercase mb-1">Risk Level</p><RiskBadge level={risk.level} override={risk.overrides[0]}/></div>
        <div className="p-4"><p className="text-[10px] text-zinc-500 uppercase mb-1">Weighted Score</p><div className="flex items-baseline gap-1"><span className="text-xl font-bold text-white">{risk.score}%</span><span className="text-xs text-zinc-500">/ 85%</span></div><div className="mt-2 h-1.5 rounded-full bg-zinc-800"><div className={`h-full rounded-full transition-all duration-700 ${risk.level==="High"?"bg-red-500":risk.level==="Medium"?"bg-amber-500":"bg-green-500"}`} style={{width:`${(risk.score/85)*100}%`}}/></div></div>
        <div className="p-4"><p className="text-[10px] text-zinc-500 uppercase mb-1">Risk Basis</p>{risk.overrides.length>0?<p className="text-sm font-medium text-amber-400">{risk.overrides[0]}</p>:<p className="text-sm text-zinc-500">Score-based</p>}</div>
        <div className="p-4"><p className="text-[10px] text-zinc-500 uppercase mb-1">Open Alerts</p><div className="flex items-center gap-2"><span className="text-xl font-bold text-red-400">{merchant.openNotifications}</span><AlertCircle className="w-4 h-4 text-red-400/60"/></div></div>
      </div>
      <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-800 border-t border-zinc-800">
        <div className="p-4"><p className="text-[10px] text-zinc-500 mb-0.5">Last Assessment</p><p className="text-xs text-zinc-300">01 July 2026, 14:31</p></div>
        <div className="p-4"><p className="text-[10px] text-zinc-500 mb-0.5">Next Re-verification</p><p className="text-xs text-zinc-300">01 July 2027</p></div>
        <div className="p-4"><p className="text-[10px] text-zinc-500 mb-0.5">Risk Policy</p><p className="text-xs font-mono text-zinc-400">{merchant.riskPolicyVersion}</p></div>
      </div>
      <div className="px-5 py-3.5 border-t border-zinc-800 flex items-center gap-2 flex-wrap">
        <Button onClick={()=>{setRecalc(true);setTimeout(()=>setRecalc(false),1800);}} disabled={recalc} variant="outline" size="sm" className="border-zinc-700 text-zinc-400 hover:text-white text-xs h-8"><RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${recalc?"animate-spin":""}`}/>{recalc?"Recalculating…":"Recalculate"}</Button>
        <Button onClick={onOverride} variant="outline" size="sm" className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 text-xs h-8"><Flag className="w-3.5 h-3.5 mr-1.5"/>Manual Override</Button>
        <Button onClick={onHistory} variant="outline" size="sm" className="border-zinc-700 text-zinc-400 hover:text-white text-xs h-8 ml-auto"><History className="w-3.5 h-3.5 mr-1.5"/>View History</Button>
        <Button onClick={onAlerts} variant="outline" size="sm" className={`text-xs h-8 ${merchant.openNotifications>0?"border-red-500/40 text-red-400 hover:bg-red-500/10":"border-zinc-700 text-zinc-400 hover:text-white"}`}><Bell className="w-3.5 h-3.5 mr-1.5"/>View Alerts {merchant.openNotifications>0&&<span className="ml-1 bg-red-500/20 text-red-400 text-[10px] px-1 rounded-full">{merchant.openNotifications}</span>}</Button>
      </div>
    </div>
    <SCard title="About Merchant — Risk Summary">
      <KV label="Final Risk" value={<RiskBadge level={risk.level} override={risk.overrides[0]}/>}/>
      <KV label="Weighted Score" value={<span className="font-mono text-white font-semibold">{risk.score}%</span>}/>
      <KV label="Override" value={risk.overrides.length>0?<span className="text-amber-400">{risk.overrides.join(", ")}</span>:<span className="text-zinc-600">None</span>}/>
      <KV label="Next Re-verification" value="01 July 2027"/>
      <KV label="Open Notifications" value={<span className="text-red-400 font-semibold">{merchant.openNotifications}</span>}/>
    </SCard>
  </div>;
}

// ─── RISK ASSESSMENT TAB ──────────────────────────────────────────────────────
function RiskAssessmentTab({risk}:{risk:RiskResult}){
  return <div className="space-y-5">
    <SCard title="Assessment Summary">
      <div className="grid sm:grid-cols-2 gap-x-8">
        <div><KV label="Assessment ID" value={<span className="font-mono">ASS-2026-0847</span>}/><KV label="Type" value="Final (Live)"/><KV label="Trigger" value="Data change / recalculation"/><KV label="Policy Version" value="v2.3.1"/></div>
        <div><KV label="Calculated Risk" value={<RiskBadge level={risk.level}/>}/><KV label="Final Risk" value={<RiskBadge level={risk.level} override={risk.overrides[0]}/>}/><KV label="Weighted Score" value={<span className="font-mono text-white font-semibold">{risk.score}%</span>}/><KV label="Override" value={risk.overrides.length>0?<span className="text-amber-400">Yes — {risk.overrides.join(", ")}</span>:<span className="text-zinc-500">No</span>}/></div>
      </div>
    </SCard>
    <SCard title="Factor Breakdown">
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-xs min-w-[700px]">
          <thead><tr className="border-b border-zinc-800">{["Factor","Source Value","Source","Factor Risk","Weight","Contribution"].map(h=><th key={h} className="pb-2.5 pr-4 text-left text-zinc-500 font-medium">{h}</th>)}</tr></thead>
          <tbody>{risk.factors.map((f,i)=><tr key={i} className="border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/30"><td className="py-2.5 pr-4 text-zinc-200 font-medium">{f.factor}</td><td className="py-2.5 pr-4 text-zinc-400 max-w-[140px] truncate" title={f.sourceValue}>{f.sourceValue}</td><td className="py-2.5 pr-4 text-zinc-500">{f.source}</td><td className="py-2.5 pr-4"><RiskBadge level={f.factorRisk}/></td><td className="py-2.5 pr-4 font-mono text-zinc-300">{f.weight}%</td><td className={`py-2.5 pr-4 font-mono font-semibold ${f.contribution>=10?"text-red-400":f.contribution>=5?"text-amber-400":"text-green-400"}`}>{f.contribution}%</td></tr>)}<tr className="border-t-2 border-zinc-700 bg-zinc-800/30"><td className="py-2.5 pr-4 text-white font-semibold" colSpan={4}>Total</td><td className="py-2.5 pr-4 font-mono text-zinc-300">85%</td><td className={`py-2.5 pr-4 font-mono font-bold text-sm ${risk.level==="High"?"text-red-400":risk.level==="Medium"?"text-amber-400":"text-green-400"}`}>{risk.score}%</td></tr></tbody>
        </table>
      </div>
    </SCard>
    <SCard title="High-risk Overrides" accent="border-red-500/30">
      <div className="space-y-2">{[{t:"Licence Required",a:risk.overrides.includes("Licence Required"),d:"AML-regulated activity — automatic High"},
        {t:"PEP/RCA",a:risk.overrides.includes("Confirmed PEP/RCA"),d:"Confirmed PEP/RCA match triggers automatic High"},
        {t:"Nominee Ownership",a:risk.overrides.includes("Nominee Ownership"),d:"Nominee structure detected"},
        {t:"Prohibited Country",a:risk.overrides.includes("Prohibited Country"),d:"Operations in prohibited jurisdiction"}].map((o,i)=><div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${o.a?"bg-red-500/10 border border-red-500/30":"bg-zinc-800/30 border border-zinc-800"}`}>{o.a?<AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5"/>:<CheckCircle className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5"/>}<div><p className={`text-xs font-semibold ${o.a?"text-red-300":"text-zinc-500"}`}>{o.t}</p><p className="text-[10px] text-zinc-600 mt-0.5">{o.d}</p></div></div>)}</div>
    </SCard>
  </div>;
}

// ─── OWNERSHIP TAB ────────────────────────────────────────────────────────────
function OwnershipTab({parties,onChange,risk}:{parties:Party[];onChange:(p:Party[],msg:SaveMsg)=>void;risk:RiskResult}){
  const [form,setForm]=useState<Party|null>(null);const [isNew,setIsNew]=useState(false);const [reason,setReason]=useState("");const [saving,setSaving]=useState(false);const [delTarget,setDelTarget]=useState<Party|null>(null);
  const blank: Party={id:`p${Date.now()}`,type:"Natural Person",roles:["UBO"],name:"",country:"Estonia",ownership:0,voting:0,parent:null,pepStatus:"Clear",screeningStatus:"Clear",active:true};
  function openEdit(p:Party){setForm({...p});setIsNew(false);setReason("");}
  function openNew(){setForm({...blank,id:`p${Date.now()}`});setIsNew(true);setReason("");}
  function setF<K extends keyof Party>(k:K,v:Party[K]){setForm(f=>f?{...f,[k]:v}:f);}
  async function handleSave(){if(!form||reason.length<10)return;setSaving(true);await new Promise(r=>setTimeout(r,700));const updated=isNew?[...parties,form]:parties.map(p=>p.id===form.id?form:p);const msg:SaveMsg={msg:"KYB data saved. Ownership structure updated.",kind:"neutral"};onChange(updated,msg);setSaving(false);setForm(null);}
  function handleDelete(){if(!delTarget)return;const updated=parties.filter(p=>p.id!==delTarget.id&&p.parent!==delTarget.id);onChange(updated,{msg:`Party "${delTarget.name}" removed. Risk recalculated.`,kind:"neutral"});setDelTarget(null);}

  return <div className="space-y-5">
    <SCard title="Party List" action={<Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-7 text-xs" onClick={openNew}><Plus className="w-3 h-3 mr-1"/>Add party</Button>}>
      <div className="grid grid-cols-4 gap-3 mb-4">{[["Parties",String(parties.length)],["Natural Persons",String(parties.filter(p=>p.type==="Natural Person").length)],["Legal Entities",String(parties.filter(p=>p.type==="Legal Entity").length)],["Structure Risk",risk.level]].map(([k,v])=><div key={k} className="text-center p-3 rounded-lg bg-zinc-800/50"><p className={`text-xl font-bold ${k==="Structure Risk"?(v==="High"?"text-red-400":v==="Medium"?"text-amber-400":"text-green-400"):"text-white"}`}>{v}</p><p className="text-[10px] text-zinc-500 mt-0.5">{k}</p></div>)}</div>
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-xs min-w-[700px]">
          <thead><tr className="border-b border-zinc-800">{["Name","Type","Roles","Country","Own%","PEP/RCA","Screening","Active","Actions"].map(h=><th key={h} className="pb-2.5 pr-3 text-left text-zinc-500 font-medium">{h}</th>)}</tr></thead>
          <tbody>{parties.map(p=><tr key={p.id} className="border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/30">
            <td className="py-2.5 pr-3 text-zinc-200 font-medium">{p.name}</td>
            <td className="py-2.5 pr-3 text-zinc-400">{p.type}</td>
            <td className="py-2.5 pr-3 text-zinc-400">{p.roles.join(", ")}</td>
            <td className="py-2.5 pr-3 text-zinc-400">{p.country}</td>
            <td className="py-2.5 pr-3 font-mono text-zinc-300">{p.ownership>0?`${p.ownership}%`:"—"}</td>
            <td className="py-2.5 pr-3"><span className={`text-[10px] ${p.pepStatus==="Clear"||p.pepStatus==="N/A"?"text-zinc-400":"text-red-400 font-semibold"}`}>{p.pepStatus}</span></td>
            <td className="py-2.5 pr-3"><span className={`text-[10px] ${p.screeningStatus==="Clear"?"text-green-400":"text-red-400"}`}>{p.screeningStatus}</span></td>
            <td className="py-2.5 pr-3"><span className={`text-[10px] ${p.active?"text-green-400":"text-zinc-600"}`}>{p.active?"Yes":"No"}</span></td>
            <td className="py-2.5"><div className="flex gap-2"><button onClick={()=>openEdit(p)} className="text-indigo-400 hover:text-indigo-300 cursor-pointer" title="Edit"><Edit2 className="w-3.5 h-3.5"/></button><button onClick={()=>setDelTarget(p)} className="text-red-400/60 hover:text-red-400 cursor-pointer" title="Delete"><Trash2 className="w-3.5 h-3.5"/></button></div></td>
          </tr>)}</tbody>
        </table>
      </div>
    </SCard>

    {form&&<Modal title={isNew?"Add Party":`Edit — ${form.name||"Party"}`} onClose={()=>setForm(null)} onSave={handleSave} saving={saving} canSave={reason.length>=10}>
      <div className="grid grid-cols-2 gap-3">
        <FG label="Full Name / Legal Name" span2><FIn value={form.name} onChange={v=>setF("name",v)}/></FG>
        <FG label="Party Type"><FSel value={form.type} onChange={v=>setF("type",v)} opts={["Natural Person","Legal Entity"]}/></FG>
        <FG label="Country"><FSel value={form.country} onChange={v=>setF("country",v)} opts={ALL_COUNTRIES}/></FG>
        <FG label="Ownership %"><FIn value={form.ownership} onChange={v=>setF("ownership",Number(v))} type="number"/></FG>
        <FG label="Voting Rights %"><FIn value={form.voting} onChange={v=>setF("voting",Number(v))} type="number"/></FG>
        <FG label="Roles (comma-separated)" span2><FIn value={form.roles.join(", ")} onChange={v=>setF("roles",v.split(",").map(s=>s.trim()).filter(Boolean))}/></FG>
        <FG label="PEP/RCA Status"><FSel value={form.pepStatus} onChange={v=>setF("pepStatus",v)} opts={["Clear","PEP","RCA","N/A","Unknown"]}/></FG>
        <FG label="Active"><FSel value={form.active?"Yes":"No"} onChange={v=>setF("active",v==="Yes")} opts={["Yes","No"]}/></FG>
      </div>
      <ReasonField value={reason} onChange={setReason}/>
    </Modal>}
    {delTarget&&<ConfirmDelete subject={delTarget.name} onClose={()=>setDelTarget(null)} onConfirm={handleDelete}/>}
  </div>;
}

// ─── LICENCE TAB ──────────────────────────────────────────────────────────────
function LicenceTab({licences,onChange}:{licences:Licence[];onChange:(l:Licence[],msg:SaveMsg)=>void}){
  const [form,setForm]=useState<Licence|null>(null);const [isNew,setIsNew]=useState(false);const [reason,setReason]=useState("");const [saving,setSaving]=useState(false);const [del,setDel]=useState<Licence|null>(null);
  const blank: Licence={id:`lic${Date.now()}`,type:"Payment Institution Licence",regulator:"",regulatorCountry:"Estonia",number:"",status:"Unverified",issueDate:"",expiryDate:"",lastVerified:"",verifiedBy:"",registryUrl:"",note:""};
  function openEdit(l:Licence){setForm({...l});setIsNew(false);setReason("");}
  function openNew(){setForm({...blank,id:`lic${Date.now()}`});setIsNew(true);setReason("");}
  function setF<K extends keyof Licence>(k:K,v:Licence[K]){setForm(f=>f?{...f,[k]:v}:f);}
  async function handleSave(){if(!form||reason.length<5)return;setSaving(true);await new Promise(r=>setTimeout(r,700));const updated=isNew?[...licences,form]:licences.map(l=>l.id===form.id?form:l);onChange(updated,{msg:"KYB data saved. Licence updated — risk recalculated.",kind:"neutral"});setSaving(false);setForm(null);}
  function handleDelete(){if(!del)return;onChange(licences.filter(l=>l.id!==del.id),{msg:`Licence "${del.type}" removed.`,kind:"neutral"});setDel(null);}
  return <div className="space-y-5">
    <SCard title="Licence & Regulatory" action={<Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-7 text-xs" onClick={openNew}><Plus className="w-3 h-3 mr-1"/>Add Licence</Button>}>
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-xs min-w-[850px]">
          <thead><tr className="border-b border-zinc-800">{["Type","Regulator","Country","Number","Status","Issue","Expiry","Last Verified","Verified By","Actions"].map(h=><th key={h} className="pb-2.5 pr-3 text-left text-zinc-500 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>{licences.map(l=><tr key={l.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/30">
            <td className="py-2.5 pr-3 text-zinc-200 font-medium">{l.type}</td>
            <td className="py-2.5 pr-3 text-zinc-400">{l.regulator}</td>
            <td className="py-2.5 pr-3 text-zinc-400">{l.regulatorCountry}</td>
            <td className="py-2.5 pr-3 font-mono text-zinc-300 text-[10px]">{l.number}</td>
            <td className="py-2.5 pr-3"><LicBadge status={l.status}/></td>
            <td className="py-2.5 pr-3 text-zinc-400 whitespace-nowrap">{l.issueDate}</td>
            <td className="py-2.5 pr-3 text-zinc-400 whitespace-nowrap">{l.expiryDate}</td>
            <td className="py-2.5 pr-3 text-zinc-400 whitespace-nowrap">{l.lastVerified}</td>
            <td className="py-2.5 pr-3 text-zinc-500">{l.verifiedBy}</td>
            <td className="py-2.5"><div className="flex gap-2 items-center">{l.registryUrl&&<a href={l.registryUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300"><ExternalLink className="w-3.5 h-3.5"/></a>}<button onClick={()=>openEdit(l)} className="text-indigo-400 hover:text-indigo-300 cursor-pointer"><Edit2 className="w-3.5 h-3.5"/></button><button onClick={()=>setDel(l)} className="text-red-400/60 hover:text-red-400 cursor-pointer"><Trash2 className="w-3.5 h-3.5"/></button></div></td>
          </tr>)}{licences.length===0&&<tr><td colSpan={10} className="py-8 text-center text-zinc-600 text-xs">No licences on file — add one above</td></tr>}</tbody>
        </table>
      </div>
    </SCard>
    {form&&<Modal title={isNew?"Add Licence":`Edit Licence — ${form.type}`} onClose={()=>setForm(null)} onSave={handleSave} saving={saving} canSave={reason.length>=5}>
      <div className="grid grid-cols-2 gap-3">
        <FG label="Licence Type" span2><FSel value={form.type} onChange={v=>setF("type",v)} opts={LICENCE_TYPES}/></FG>
        <FG label="Regulator"><FIn value={form.regulator} onChange={v=>setF("regulator",v)}/></FG>
        <FG label="Regulator Country"><FSel value={form.regulatorCountry} onChange={v=>setF("regulatorCountry",v)} opts={ALL_COUNTRIES}/></FG>
        <FG label="Licence Number"><FIn value={form.number} onChange={v=>setF("number",v)}/></FG>
        <FG label="Status"><FSel value={form.status} onChange={v=>setF("status",v as LicenceStatus)} opts={LICENCE_STATUSES}/></FG>
        <FG label="Issue Date"><FIn value={form.issueDate} onChange={v=>setF("issueDate",v)} type="date"/></FG>
        <FG label="Expiry Date"><FIn value={form.expiryDate} onChange={v=>setF("expiryDate",v)} type="date"/></FG>
        <FG label="Verified By"><FIn value={form.verifiedBy} onChange={v=>setF("verifiedBy",v)}/></FG>
        <FG label="Registry URL" span2><FIn value={form.registryUrl} onChange={v=>setF("registryUrl",v)} placeholder="https://…"/></FG>
        <FG label="Note" span2><FTa value={form.note} onChange={v=>setF("note",v)}/></FG>
      </div>
      <ReasonField value={reason} onChange={setReason}/>
    </Modal>}
    {del&&<ConfirmDelete subject={del.type} onClose={()=>setDel(null)} onConfirm={handleDelete}/>}
  </div>;
}

// ─── SOF/SOW TAB ──────────────────────────────────────────────────────────────
function SoFSoWTab({evidence,onChange}:{evidence:Evidence[];onChange:(e:Evidence[],msg:SaveMsg)=>void}){
  const [form,setForm]=useState<Evidence|null>(null);const [isNew,setIsNew]=useState(false);const [reason,setReason]=useState("");const [saving,setSaving]=useState(false);const [del,setDel]=useState<Evidence|null>(null);
  const blank: Evidence={id:`ev${Date.now()}`,evidenceType:"SoF",party:"Company",category:"",description:"",amount:0,currency:"EUR",dateIssued:"",status:"Pending",reviewer:"",reviewDate:"",reviewNotes:"",inconsistencyFlag:false};
  function openEdit(e:Evidence){setForm({...e});setIsNew(false);setReason("");}
  function openNew(){setForm({...blank,id:`ev${Date.now()}`});setIsNew(true);setReason("");}
  function setF<K extends keyof Evidence>(k:K,v:Evidence[K]){setForm(f=>f?{...f,[k]:v}:f);}
  async function handleSave(){if(!form||reason.length<5)return;setSaving(true);await new Promise(r=>setTimeout(r,700));const updated=isNew?[...evidence,form]:evidence.map(e=>e.id===form.id?form:e);onChange(updated,{msg:"KYB data saved. SoF/SoW evidence updated.",kind:"neutral"});setSaving(false);setForm(null);}
  function handleDelete(){if(!del)return;onChange(evidence.filter(e=>e.id!==del.id),{msg:`Evidence "${del.category}" removed.`,kind:"neutral"});setDel(null);}
  return <div className="space-y-5">
    <SCard title="Source of Funds / Source of Wealth" action={<Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-7 text-xs" onClick={openNew}><Plus className="w-3 h-3 mr-1"/>Add Evidence</Button>}>
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-xs min-w-[850px]">
          <thead><tr className="border-b border-zinc-800">{["Type","Party","Category","Description","Amount","Status","Flag","Reviewer","Review Date","Actions"].map(h=><th key={h} className="pb-2.5 pr-3 text-left text-zinc-500 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>{evidence.map(ev=><tr key={ev.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/30">
            <td className="py-2.5 pr-3"><Badge variant="outline" className="text-[10px] border-indigo-500/30 text-indigo-400">{ev.evidenceType}</Badge></td>
            <td className="py-2.5 pr-3 text-zinc-300">{ev.party}</td>
            <td className="py-2.5 pr-3 text-zinc-400 whitespace-nowrap">{ev.category}</td>
            <td className="py-2.5 pr-3 text-zinc-500 max-w-[140px] truncate" title={ev.description}>{ev.description}</td>
            <td className="py-2.5 pr-3 font-mono text-zinc-300 whitespace-nowrap">{ev.currency} {ev.amount.toLocaleString()}</td>
            <td className="py-2.5 pr-3"><EvBadge status={ev.status}/></td>
            <td className="py-2.5 pr-3"><span className={`text-[10px] ${ev.inconsistencyFlag?"text-red-400":"text-zinc-600"}`}>{ev.inconsistencyFlag?"⚑ Flagged":"—"}</span></td>
            <td className="py-2.5 pr-3 text-zinc-500">{ev.reviewer||"—"}</td>
            <td className="py-2.5 pr-3 text-zinc-500 whitespace-nowrap">{ev.reviewDate||"—"}</td>
            <td className="py-2.5"><div className="flex gap-2"><button onClick={()=>openEdit(ev)} className="text-indigo-400 hover:text-indigo-300 cursor-pointer"><Edit2 className="w-3.5 h-3.5"/></button><button onClick={()=>setDel(ev)} className="text-red-400/60 hover:text-red-400 cursor-pointer"><Trash2 className="w-3.5 h-3.5"/></button></div></td>
          </tr>)}{evidence.length===0&&<tr><td colSpan={10} className="py-8 text-center text-zinc-600 text-xs">No evidence on file — add one above</td></tr>}</tbody>
        </table>
      </div>
    </SCard>
    {form&&<Modal title={isNew?"Add Evidence":`Edit Evidence — ${form.category||form.evidenceType}`} onClose={()=>setForm(null)} onSave={handleSave} saving={saving} canSave={reason.length>=5}>
      <div className="grid grid-cols-2 gap-3">
        <FG label="Evidence Type"><FSel value={form.evidenceType} onChange={v=>setF("evidenceType",v)} opts={["SoF","SoW"]}/></FG>
        <FG label="Related Party"><FIn value={form.party} onChange={v=>setF("party",v)}/></FG>
        <FG label="Category" span2><FSel value={form.category} onChange={v=>setF("category",v)} opts={["",  ...(form.evidenceType==="SoF"?SOF_CATS:SOW_CATS)]}/></FG>
        <FG label="Description" span2><FTa value={form.description} onChange={v=>setF("description",v)}/></FG>
        <FG label="Amount"><FIn value={form.amount} onChange={v=>setF("amount",Number(v))} type="number"/></FG>
        <FG label="Currency"><FSel value={form.currency} onChange={v=>setF("currency",v)} opts={["EUR","USD","GBP","CHF","PLN","SEK"]}/></FG>
        <FG label="Date Issued"><FIn value={form.dateIssued} onChange={v=>setF("dateIssued",v)} type="date"/></FG>
        <FG label="Status"><FSel value={form.status} onChange={v=>setF("status",v as EvidenceStatus)} opts={EVIDENCE_STATUSES}/></FG>
        <FG label="Reviewer"><FIn value={form.reviewer} onChange={v=>setF("reviewer",v)}/></FG>
        <FG label="Review Date"><FIn value={form.reviewDate} onChange={v=>setF("reviewDate",v)} type="date"/></FG>
        <FG label="Review Notes" span2><FTa value={form.reviewNotes} onChange={v=>setF("reviewNotes",v)}/></FG>
        <FG label="Inconsistency Flag" span2><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.inconsistencyFlag} onChange={e=>setF("inconsistencyFlag",e.target.checked)} className="accent-red-500"/><span className="text-xs text-zinc-400">Flag inconsistency with expected business activity</span></label></FG>
      </div>
      <ReasonField value={reason} onChange={setReason}/>
    </Modal>}
    {del&&<ConfirmDelete subject={del.category||del.evidenceType} onClose={()=>setDel(null)} onConfirm={handleDelete}/>}
  </div>;
}

// ─── SCREENING TAB ────────────────────────────────────────────────────────────
function ScreeningTab(){
  return <div className="space-y-5">
    <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3 flex items-start gap-2"><Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5"/><p className="text-xs text-blue-300">Screening data is sourced from the screening provider (ComplyAdvantage). PEP/RCA results are read-only — a confirmed PEP/RCA match automatically sets Final Risk to High.</p></div>
    <SCard title="Screening Check">
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-xs min-w-[650px]">
          <thead><tr className="border-b border-zinc-800">{["Subject","Type","Monitoring","Match Status","PEP/RCA","Risk Impact","Last Updated","Source"].map(h=><th key={h} className="pb-2.5 pr-4 text-left text-zinc-500 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>{MOCK_SCREENING.map(sc=><tr key={sc.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/30">
            <td className="py-2.5 pr-4 text-zinc-200 font-medium">{sc.subject}</td>
            <td className="py-2.5 pr-4 text-zinc-400">{sc.type}</td>
            <td className="py-2.5 pr-4"><span className={`text-[10px] ${sc.monitoring==="Active"?"text-green-400":"text-zinc-500"}`}>{sc.monitoring}</span></td>
            <td className="py-2.5 pr-4"><span className={`text-[10px] font-medium ${sc.match==="No Match"?"text-green-400":"text-red-400"}`}>{sc.match}</span></td>
            <td className="py-2.5 pr-4"><span className={`text-[10px] ${sc.pep==="Clear"||sc.pep==="N/A"?"text-zinc-400":"text-red-400 font-semibold"}`}>{sc.pep}</span></td>
            <td className="py-2.5 pr-4 text-[10px] text-zinc-600">Triggers High if confirmed</td>
            <td className="py-2.5 pr-4 text-zinc-500 whitespace-nowrap">{sc.updated}</td>
            <td className="py-2.5 pr-4 text-zinc-500">{sc.source}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </SCard>
  </div>;
}

// ─── PRE-CHECK TAB ────────────────────────────────────────────────────────────
function PreCheckTab({merchant,onChange}:{merchant:MerchantState;onChange:(m:MerchantState,msg:SaveMsg)=>void}){
  const [editing,setEditing]=useState<string|null>(null);
  const [form,setForm]=useState<MerchantState>(merchant);
  const [reason,setReason]=useState("");const [saving,setSaving]=useState(false);
  function open(s:string){setForm({...merchant});setEditing(s);setReason("");}
  function setF<K extends keyof MerchantState>(k:K,v:MerchantState[K]){setForm(f=>({...f,[k]:v}));}
  async function save(section:string){if(reason.length<10)return;setSaving(true);await new Promise(r=>setTimeout(r,700));onChange({...form},{msg:`KYB data saved (${section}). Risk recalculated.`,kind:"neutral"});setSaving(false);setEditing(null);}
  const ann=merchant.monthlyTurnover*12;
  const totalPct=merchant.countriesOfOperation.reduce((s,c)=>s+c.pct,0);
  function EditBtn({s}:{s:string}){return <Button variant="outline" size="sm" className="border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 h-7 text-xs" onClick={()=>open(s)}><Edit2 className="w-3 h-3 mr-1"/>Edit</Button>;}
  return <div className="space-y-5">
    <SCard title="Company Information" action={<EditBtn s="Company Information"/>}>
      <div className="grid sm:grid-cols-2 gap-x-8">
        <div><KV label="Company Legal Name" value={merchant.name}/><KV label="Registration No." value={<span className="font-mono">{merchant.registrationNumber}</span>}/><KV label="Date of Incorporation" value={<span className="flex items-center gap-1">{merchant.incorporationDate}<RiskDot level={merchant.incorporationDate<"2022-01-01"?"Low":"Medium"}/></span>}/><KV label="Country of Incorporation" value={<span className="flex items-center gap-1">{merchant.incorporationCountry}<RiskDot level={HIGH_INC.has(merchant.incorporationCountry)?"High":MED_INC.has(merchant.incorporationCountry)?"Medium":"Low"}/></span>}/></div>
        <div><KV label="Head Office Country" value={merchant.headOfficeCountry}/><KV label="Registered Address" value={merchant.registeredAddress}/><KV label="Merchant ID" value={<span className="font-mono text-zinc-400">{merchant.id}</span>}/><KV label="Email" value={<span className="text-zinc-400">{merchant.email}</span>}/></div>
      </div>
    </SCard>
    <SCard title="Company Activity" action={<EditBtn s="Company Activity"/>}>
      <div className="grid sm:grid-cols-2 gap-x-8">
        <div><KV label="Industry" value={<span className="flex items-center gap-1">{merchant.industry}<RiskDot level={HIGH_IND.has(merchant.industry)?"High":MED_IND.has(merchant.industry)?"Medium":"Low"}/></span>}/><KV label="MCC" value={<span className="font-mono">{merchant.mcc}</span>}/><KV label="Description" value={merchant.activityDescription}/><KV label="Website" value={<span className="text-indigo-400">{merchant.website}</span>}/></div>
        <div><KV label="Licence Required?" value={<span className={`flex items-center gap-1 ${merchant.licenceRequired?"text-amber-400 font-semibold":"text-green-400"}`}>{merchant.licenceRequired?"Yes":"No"}<RiskDot level={merchant.licenceRequired?"High":"Low"}/></span>}/>{merchant.licenceRequired&&<KV label="Licence Type" value={merchant.licenceType}/>}</div>
      </div>
    </SCard>
    <SCard title="Products and Operations" action={<EditBtn s="Products"/>}>
      <div className="grid sm:grid-cols-2 gap-x-8">
        <div><KV label="Products" value={merchant.products}/><KV label="Currency" value={merchant.currency}/><KV label="Monthly Turnover" value={<span className="font-mono">{merchant.currency} {merchant.monthlyTurnover.toLocaleString()}</span>}/><KV label="Annual Turnover (×12)" value={<span className="font-mono text-white font-semibold flex items-center gap-1">{merchant.currency} {ann.toLocaleString()}<RiskDot level={ann>5_000_000?"High":ann>500_000?"Medium":"Low"}/></span>}/><KV label="Nominee Ownership" value={<span className={merchant.nomineeOwnership?"text-red-400 font-semibold":"text-zinc-400"}>{merchant.nomineeOwnership?"Yes — Override Active":"No"}</span>}/></div>
        <div><p className="text-[10px] text-zinc-500 mb-2">Countries of Operations</p><div className="space-y-1">{merchant.countriesOfOperation.map(c=><div key={c.country} className="flex items-center gap-3"><span className="text-xs text-zinc-300 w-24">{c.country}</span><div className="flex-1 h-1.5 rounded-full bg-zinc-800"><div className="h-full rounded-full bg-indigo-500" style={{width:`${c.pct}%`}}/></div><span className="text-xs font-mono text-zinc-400 w-8 text-right">{c.pct}%</span></div>)}<div className="flex items-center gap-3 pt-1 border-t border-zinc-800 mt-1"><span className="text-xs text-zinc-500 w-24">Total</span><div className="flex-1"/><span className={`text-xs font-mono font-bold w-8 text-right ${totalPct===100?"text-green-400":"text-red-400"}`}>{totalPct}%</span></div></div></div>
      </div>
    </SCard>
    <SCard title="Representative / Director" action={<EditBtn s="Representative"/>}>
      <div className="grid sm:grid-cols-2 gap-x-8">
        <div><KV label="First Name" value={merchant.repFirstName}/><KV label="Last Name" value={merchant.repLastName}/><KV label="Date of Birth" value={merchant.repDob}/></div>
        <div><KV label="Country of Residence" value={<span className="flex items-center gap-1">{merchant.repCountry}<RiskDot level={HIGH_INC.has(merchant.repCountry)?"High":MED_INC.has(merchant.repCountry)?"Medium":"Low"}/></span>}/><KV label="Address" value={merchant.repAddress}/><KV label="Relationship" value={merchant.repRelationship}/></div>
      </div>
    </SCard>

    {editing==="Company Information"&&<Modal title="Edit — Company Information" onClose={()=>setEditing(null)} onSave={()=>save("Company Information")} saving={saving} canSave={reason.length>=10}>
      <div className="grid grid-cols-2 gap-3">
        <FG label="Company Legal Name" span2><FIn value={form.name} onChange={v=>setF("name",v)}/></FG>
        <FG label="Registration Number"><FIn value={form.registrationNumber} onChange={v=>setF("registrationNumber",v)}/></FG>
        <FG label="Date of Incorporation"><FIn value={form.incorporationDate} onChange={v=>setF("incorporationDate",v)} type="date"/></FG>
        <FG label="Country of Incorporation"><FSel value={form.incorporationCountry} onChange={v=>setF("incorporationCountry",v)} opts={ALL_COUNTRIES}/></FG>
        <FG label="Head Office Country"><FSel value={form.headOfficeCountry} onChange={v=>setF("headOfficeCountry",v)} opts={ALL_COUNTRIES}/></FG>
        <FG label="Registered Address" span2><FIn value={form.registeredAddress} onChange={v=>setF("registeredAddress",v)}/></FG>
        <FG label="Email" span2><FIn value={form.email} onChange={v=>setF("email",v)}/></FG>
      </div>
      <ReasonField value={reason} onChange={setReason}/>
    </Modal>}
    {editing==="Company Activity"&&<Modal title="Edit — Company Activity" onClose={()=>setEditing(null)} onSave={()=>save("Company Activity")} saving={saving} canSave={reason.length>=10}>
      <div className="grid grid-cols-2 gap-3">
        <FG label="Industry" span2><FSel value={form.industry} onChange={v=>setF("industry",v)} opts={INDUSTRIES}/></FG>
        <FG label="MCC"><FIn value={form.mcc} onChange={v=>setF("mcc",v)}/></FG>
        <FG label="Website"><FIn value={form.website} onChange={v=>setF("website",v)}/></FG>
        <FG label="Description" span2><FTa value={form.activityDescription} onChange={v=>setF("activityDescription",v)}/></FG>
        <FG label="Licence Required?" span2>
          <div className="flex gap-3">{["Yes","No"].map(opt=><label key={opt} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs ${(form.licenceRequired?"Yes":"No")===opt?"border-indigo-500 bg-indigo-500/10 text-white":"border-zinc-700 text-zinc-400"}`}><input type="radio" name="licReq" checked={(form.licenceRequired?"Yes":"No")===opt} onChange={()=>setF("licenceRequired",opt==="Yes")} className="accent-indigo-500"/>{opt}</label>)}</div>
        </FG>
        {form.licenceRequired&&<FG label="Licence Type" span2><FSel value={form.licenceType} onChange={v=>setF("licenceType",v)} opts={LICENCE_TYPES}/></FG>}
      </div>
      <ReasonField value={reason} onChange={setReason}/>
    </Modal>}
    {editing==="Products"&&<Modal title="Edit — Products and Operations" onClose={()=>setEditing(null)} onSave={()=>save("Products")} saving={saving} canSave={reason.length>=10}>
      <div className="grid grid-cols-2 gap-3">
        <FG label="Products" span2><FIn value={form.products} onChange={v=>setF("products",v)} placeholder="SEPA, Cards, FX…"/></FG>
        <FG label="Currency"><FSel value={form.currency} onChange={v=>setF("currency",v)} opts={["EUR","USD","GBP","CHF","PLN","SEK"]}/></FG>
        <FG label="Monthly Turnover"><FIn value={form.monthlyTurnover} onChange={v=>setF("monthlyTurnover",Number(v))} type="number"/></FG>
        <FG label="Nominee Ownership?" span2><div className="flex gap-3">{["Yes","No"].map(opt=><label key={opt} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs ${(form.nomineeOwnership?"Yes":"No")===opt?(opt==="Yes"?"border-red-500 bg-red-500/10 text-red-300":"border-indigo-500 bg-indigo-500/10 text-white"):"border-zinc-700 text-zinc-400"}`}><input type="radio" name="nomOwn" checked={(form.nomineeOwnership?"Yes":"No")===opt} onChange={()=>setF("nomineeOwnership",opt==="Yes")} className="accent-indigo-500"/>{opt}</label>)}</div></FG>
      </div>
      <div className="mt-2">
        <Label className="text-zinc-400 text-[10px] mb-2 block">Countries of Operation (must total 100%)</Label>
        <div className="space-y-2">{form.countriesOfOperation.map((c,i)=><div key={i} className="flex items-center gap-2"><select value={c.country} onChange={e=>{const u=[...form.countriesOfOperation];u[i]={...u[i],country:e.target.value};setF("countriesOfOperation",u);}} className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none">{ALL_COUNTRIES.map(cn=><option key={cn} value={cn}>{cn}</option>)}</select><input type="number" min={0} max={100} value={c.pct} onChange={e=>{const u=[...form.countriesOfOperation];u[i]={...u[i],pct:Number(e.target.value)};setF("countriesOfOperation",u);}} className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white text-right focus:outline-none"/><span className="text-xs text-zinc-500">%</span><button onClick={()=>setF("countriesOfOperation",form.countriesOfOperation.filter((_,j)=>j!==i))} className="text-zinc-600 hover:text-red-400 cursor-pointer"><X className="w-3.5 h-3.5"/></button></div>)}<button onClick={()=>setF("countriesOfOperation",[...form.countriesOfOperation,{country:"Germany",pct:0}])} className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer flex items-center gap-1"><Plus className="w-3 h-3"/>Add country</button><div className="flex justify-between text-xs pt-1 border-t border-zinc-800"><span className="text-zinc-500">Total</span><span className={`font-mono font-bold ${form.countriesOfOperation.reduce((s,c)=>s+c.pct,0)===100?"text-green-400":"text-red-400"}`}>{form.countriesOfOperation.reduce((s,c)=>s+c.pct,0)}%</span></div></div>
      </div>
      <ReasonField value={reason} onChange={setReason}/>
    </Modal>}
    {editing==="Representative"&&<Modal title="Edit — Representative / Director" onClose={()=>setEditing(null)} onSave={()=>save("Representative")} saving={saving} canSave={reason.length>=10}>
      <div className="grid grid-cols-2 gap-3">
        <FG label="First Name"><FIn value={form.repFirstName} onChange={v=>setF("repFirstName",v)}/></FG>
        <FG label="Last Name"><FIn value={form.repLastName} onChange={v=>setF("repLastName",v)}/></FG>
        <FG label="Date of Birth"><FIn value={form.repDob} onChange={v=>setF("repDob",v)} type="date"/></FG>
        <FG label="Country of Residence"><FSel value={form.repCountry} onChange={v=>setF("repCountry",v)} opts={ALL_COUNTRIES}/></FG>
        <FG label="Address" span2><FIn value={form.repAddress} onChange={v=>setF("repAddress",v)}/></FG>
        <FG label="Relationship / Ownership" span2><FIn value={form.repRelationship} onChange={v=>setF("repRelationship",v)}/></FG>
      </div>
      <ReasonField value={reason} onChange={setReason}/>
    </Modal>}
  </div>;
}

// ─── VERIFICATION DETAIL PANEL ────────────────────────────────────────────────
function VerifDetail({v,onClose}:{v:typeof VERIF_LIST[0];onClose:()=>void}){
  const [dtab,setDtab]=useState("risk-summary");
  const mockRisk: RiskResult={score:v.score,level:v.risk,overrides:v.basis!=="—"?[v.basis]:[],factors:[
    {factor:"Country of Incorporation",sourceValue:"Estonia",factorRisk:"Low",weight:10,contribution:2,source:"Pre-check"},
    {factor:"Industry/MCC",sourceValue:`${v.merchant} industry`,factorRisk:v.risk,weight:15,contribution:v.risk==="High"?15:v.risk==="Medium"?8:3,source:"Company Activity"},
    {factor:"AML Regulated",sourceValue:v.basis==="Licence Required"?"Yes":"No",factorRisk:v.basis==="Licence Required"?"High":"Low",weight:15,contribution:v.basis==="Licence Required"?15:0,source:"Activity"},
    {factor:"Annual Turnover",sourceValue:"As declared",factorRisk:v.risk,weight:10,contribution:v.risk==="High"?10:v.risk==="Medium"?5:1,source:"Pre-check"},
  ]};
  return <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/60"><div className="bg-zinc-900 border-l border-zinc-800 w-full max-w-2xl h-full overflow-y-auto shadow-2xl flex flex-col">
    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10 shrink-0">
      <div><p className="text-white font-bold">{v.merchant}</p><p className="text-xs text-zinc-500">{v.id} · {v.email}</p></div>
      <button onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer"><X className="w-4 h-4"/></button>
    </div>
    <div className="flex gap-0 px-6 border-b border-zinc-800 shrink-0 overflow-x-auto" style={{scrollbarWidth:"none"}}>
      {[["risk-summary","Risk Summary"],["risk-assessment","Risk Assessment"],["details","Details"]].map(([id,label])=><button key={id} onClick={()=>setDtab(id)} className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 cursor-pointer transition-colors ${dtab===id?"border-indigo-500 text-indigo-400":"border-transparent text-zinc-500 hover:text-zinc-300"}`}>{label}</button>)}
    </div>
    <div className="p-6 flex-1 space-y-5">
      {dtab==="risk-summary"&&<>
        <div className="rounded-xl border border-zinc-700 bg-zinc-950/40 p-5 space-y-0">
          <KV label="Final Risk" value={<RiskBadge level={v.risk} override={v.basis!=="—"?v.basis:undefined}/>}/>
          <KV label="Weighted Score" value={<span className="font-mono text-white font-semibold">{v.score}%</span>}/>
          <KV label="Risk Basis" value={v.basis}/>
          <KV label="Licence Status" value={<LicBadge status={v.licStatus}/>}/>
          <KV label="Status" value={<StatusBadge status={v.status}/>}/>
          <KV label="Assessment Date" value={v.assessDate}/>
          <KV label="Next Re-verify" value={v.revDate}/>
          <KV label="Open Alerts" value={v.alerts>0?<span className="text-red-400 font-semibold">{v.alerts}</span>:<span className="text-zinc-600">0</span>}/>
          <KV label="Operator" value={v.op}/>
        </div>
        <div className="h-2 rounded-full bg-zinc-800"><div className={`h-full rounded-full transition-all ${v.risk==="High"?"bg-red-500":v.risk==="Medium"?"bg-amber-500":"bg-green-500"}`} style={{width:`${(v.score/85)*100}%`}}/></div>
        <p className="text-[10px] text-zinc-600">{v.score}% of 85% max weighted score · {v.risk} risk level</p>
      </>}
      {dtab==="risk-assessment"&&<RiskAssessmentTab risk={mockRisk}/>}
      {dtab==="details"&&<div className="space-y-3">
        <div className="rounded-lg bg-zinc-800/50 border border-zinc-700 p-4 space-y-0">
          <KV label="Verification ID" value={<span className="font-mono text-zinc-300">{v.id}</span>}/>
          <KV label="Merchant" value={v.merchant}/>
          <KV label="Email" value={v.email}/>
          <KV label="Status" value={<StatusBadge status={v.status}/>}/>
          <KV label="Assessment Date" value={v.assessDate}/>
          <KV label="Assigned Operator" value={v.op}/>
        </div>
      </div>}
    </div>
    <div className="px-6 py-4 border-t border-zinc-800 flex gap-2 shrink-0">
      <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8 text-xs flex-1">Accept</Button>
      <Button variant="outline" size="sm" className="border-red-500/40 text-red-400 hover:bg-red-500/10 h-8 text-xs flex-1">Reject</Button>
      <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-400 h-8 text-xs"><Download className="w-3.5 h-3.5"/></Button>
    </div>
  </div></div>;
}

// ─── VERIFICATIONS TAB ────────────────────────────────────────────────────────
function VerificationsTab(){
  const [search,setSearch]=useState("");const [riskF,setRiskF]=useState("");const [detail,setDetail]=useState<typeof VERIF_LIST[0]|null>(null);
  const filtered=VERIF_LIST.filter(v=>(!search||v.merchant.toLowerCase().includes(search.toLowerCase())||v.id.includes(search))&&(!riskF||v.risk===riskF));
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-3">
      <div className="flex-1 min-w-48 relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600"/><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" className="bg-zinc-900 border-zinc-800 text-white text-xs h-8 pl-8"/></div>
      <select value={riskF} onChange={e=>setRiskF(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 text-xs text-zinc-300 h-8 focus:outline-none"><option value="">All Risk Levels</option><option>Low</option><option>Medium</option><option>High</option></select>
      <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-400 h-8 text-xs ml-auto"><Download className="w-3.5 h-3.5 mr-1.5"/>Export</Button>
    </div>
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <table className="w-full text-xs">
        <thead><tr className="border-b border-zinc-800 bg-zinc-950/40">{["Verification ID","Merchant","Status","Final Risk","Score","Risk Basis","Assessment Date","Re-verify","Licence","Alerts","Operator",""].map(h=><th key={h} className="px-3 py-2.5 text-left text-zinc-500 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>{filtered.map(v=><tr key={v.id} onClick={()=>setDetail(v)} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer">
          <td className="px-3 py-2.5 font-mono text-zinc-400 text-[10px]">{v.id}</td>
          <td className="px-3 py-2.5"><p className="text-zinc-200 font-medium">{v.merchant}</p><p className="text-zinc-600 text-[10px]">{v.email}</p></td>
          <td className="px-3 py-2.5"><StatusBadge status={v.status}/></td>
          <td className="px-3 py-2.5"><RiskBadge level={v.risk}/></td>
          <td className="px-3 py-2.5 font-mono text-zinc-300">{v.score}%</td>
          <td className="px-3 py-2.5 text-zinc-400">{v.basis}</td>
          <td className="px-3 py-2.5 text-zinc-500 whitespace-nowrap">{v.assessDate}</td>
          <td className="px-3 py-2.5 text-zinc-500 whitespace-nowrap">{v.revDate}</td>
          <td className="px-3 py-2.5"><LicBadge status={v.licStatus}/></td>
          <td className="px-3 py-2.5">{v.alerts>0?<span className="bg-red-500/15 text-red-400 border border-red-500/30 text-[10px] px-1.5 py-0.5 rounded-full font-semibold">{v.alerts}</span>:<span className="text-zinc-600">—</span>}</td>
          <td className="px-3 py-2.5 text-zinc-500">{v.op}</td>
          <td className="px-3 py-2.5"><button className="text-indigo-400 hover:text-indigo-300 text-[10px] cursor-pointer flex items-center gap-1" onClick={e=>{e.stopPropagation();setDetail(v);}}><Eye className="w-3 h-3"/>Details</button></td>
        </tr>)}</tbody>
      </table>
    </div>
    {detail&&<VerifDetail v={detail} onClose={()=>setDetail(null)}/>}
  </div>;
}

// ─── MERCHANTS TAB ────────────────────────────────────────────────────────────
function MerchantsTab(){
  const [search,setSearch]=useState("");const [detail,setDetail]=useState<typeof VERIF_LIST[0]|null>(null);
  const filtered=VERIF_LIST.filter(v=>!search||v.merchant.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-3">
      <div className="flex-1 min-w-48 relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600"/><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search merchants…" className="bg-zinc-900 border-zinc-800 text-white text-xs h-8 pl-8"/></div>
      <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-400 h-8 text-xs ml-auto"><Download className="w-3.5 h-3.5 mr-1.5"/>Export CSV</Button>
    </div>
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <table className="w-full text-xs">
        <thead><tr className="border-b border-zinc-800 bg-zinc-950/40">{["Merchant ID","Name","Email","Verif. Status","Risk Level","Score","Alerts","Licence","Operator",""].map(h=><th key={h} className="px-3 py-2.5 text-left text-zinc-500 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>{filtered.map(v=><tr key={v.id} onClick={()=>setDetail(v)} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer">
          <td className="px-3 py-2.5 font-mono text-zinc-400 text-[10px]">MCH-{v.id.slice(-4)}</td>
          <td className="px-3 py-2.5 text-zinc-200 font-medium">{v.merchant}</td>
          <td className="px-3 py-2.5 text-zinc-500">{v.email}</td>
          <td className="px-3 py-2.5"><StatusBadge status={v.status}/></td>
          <td className="px-3 py-2.5"><RiskBadge level={v.risk}/></td>
          <td className="px-3 py-2.5 font-mono text-zinc-300">{v.score}%</td>
          <td className="px-3 py-2.5">{v.alerts>0?<span className="bg-red-500/15 text-red-400 border border-red-500/30 text-[10px] px-1.5 py-0.5 rounded-full font-semibold">{v.alerts}</span>:<span className="text-zinc-600">—</span>}</td>
          <td className="px-3 py-2.5"><LicBadge status={v.licStatus}/></td>
          <td className="px-3 py-2.5 text-zinc-500">{v.op}</td>
          <td className="px-3 py-2.5"><button className="text-indigo-400 hover:text-indigo-300 text-[10px] cursor-pointer flex items-center gap-1" onClick={e=>{e.stopPropagation();setDetail(v);}}><Eye className="w-3 h-3"/>Details</button></td>
        </tr>)}</tbody>
      </table>
    </div>
    {detail&&<VerifDetail v={detail} onClose={()=>setDetail(null)}/>}
  </div>;
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
const TABS=[
  {id:"risk-summary",label:"Risk Summary"},{id:"risk-assessment",label:"Risk Assessment"},
  {id:"ownership",label:"Ownership & Parties"},{id:"licence",label:"Licence & Regulatory"},
  {id:"sof-sow",label:"SoF / SoW"},{id:"screening",label:"Screening"},
  {id:"pre-check",label:"Pre-check"},{id:"verifications",label:"Verifications"},
  {id:"merchants",label:"Merchants"},
];

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function CDDPage(){
  const router=useRouter();
  const [user,setUser]=useState<any>(null);
  const [tab,setTab]=useState("risk-summary");
  const [merchant,setMerchant]=useState<MerchantState>(INIT_M);
  const [parties,setParties]=useState<Party[]>(INIT_PARTIES);
  const [licences,setLicences]=useState<Licence[]>(INIT_LICENCES);
  const [evidence,setEvidence]=useState<Evidence[]>(INIT_EVIDENCE);
  const [prevRisk,setPrevRisk]=useState<RiskResult|null>(null);
  const [saveMsg,setSaveMsg]=useState<SaveMsg|null>(null);
  const [showOverride,setShowOverride]=useState(false);
  const [showHistory,setShowHistory]=useState(false);
  const [showAlerts,setShowAlerts]=useState(false);

  const risk=useMemo(()=>calculateRisk(merchant,licences,parties),[merchant,licences,parties]);

  useEffect(()=>{fetch("/api/auth/me").then(async r=>{if(r.status===401){router.push("/login");return;}setUser((await r.json()).user);});},[router]);

  function onDataChange(updater:()=>void, msg:SaveMsg){
    setPrevRisk(risk);
    updater();
    setSaveMsg(msg);
  }

  return <div className="min-h-screen bg-zinc-950 text-white">
    <DashNav user={user}/>
    <div className="border-b border-zinc-800 bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1"><span>Merchants</span><ChevronRight className="w-3 h-3"/><span className="text-zinc-300">{merchant.name}</span></div>
            <div className="flex items-center gap-3"><h1 className="text-lg font-bold text-white">{merchant.name}</h1><RiskBadge level={risk.level} override={risk.overrides[0]}/><StatusBadge status={merchant.status}/></div>
            <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500"><span className="font-mono">{merchant.id}</span><span>·</span><span>{merchant.verificationId}</span><span>·</span><span>{merchant.email}</span><span>·</span><span>{merchant.operatedBy}</span></div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-400 h-8 text-xs"><Download className="w-3.5 h-3.5 mr-1.5"/>Download all</Button>
            <Button variant="outline" size="sm" className="border-green-500/40 text-green-400 hover:bg-green-500/10 h-8 text-xs">Accept</Button>
            <Button variant="outline" size="sm" className="border-red-500/40 text-red-400 hover:bg-red-500/10 h-8 text-xs">Reject</Button>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6"><div className="flex gap-0 overflow-x-auto" style={{scrollbarWidth:"none"}}>{TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer ${tab===t.id?"border-indigo-500 text-indigo-400":"border-transparent text-zinc-500 hover:text-zinc-300"}`}>{t.label}</button>)}</div></div>
    </div>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {saveMsg&&<SaveBanner msg={saveMsg.msg} kind={saveMsg.kind} onClose={()=>setSaveMsg(null)}/>}
      {tab==="risk-summary"&&<RiskSummaryTab risk={risk} prevRisk={prevRisk} merchant={merchant} onOverride={()=>setShowOverride(true)} onHistory={()=>setShowHistory(true)} onAlerts={()=>setShowAlerts(true)}/>}
      {tab==="risk-assessment"&&<RiskAssessmentTab risk={risk}/>}
      {tab==="ownership"&&<OwnershipTab parties={parties} risk={risk} onChange={(p,msg)=>onDataChange(()=>setParties(p),msg)}/>}
      {tab==="licence"&&<LicenceTab licences={licences} onChange={(l,msg)=>onDataChange(()=>setLicences(l),msg)}/>}
      {tab==="sof-sow"&&<SoFSoWTab evidence={evidence} onChange={(e,msg)=>onDataChange(()=>setEvidence(e),msg)}/>}
      {tab==="screening"&&<ScreeningTab/>}
      {tab==="pre-check"&&<PreCheckTab merchant={merchant} onChange={(m,msg)=>onDataChange(()=>setMerchant(m),msg)}/>}
      {tab==="verifications"&&<VerificationsTab/>}
      {tab==="merchants"&&<MerchantsTab/>}
    </div>
    {showOverride&&<OverrideModal risk={risk} onClose={()=>setShowOverride(false)} onSaved={msg=>{setSaveMsg(msg);}}/>}
    {showHistory&&<HistoryModal onClose={()=>setShowHistory(false)}/>}
    {showAlerts&&<AlertsModal count={merchant.openNotifications} onClose={()=>setShowAlerts(false)}/>}
  </div>;
}
