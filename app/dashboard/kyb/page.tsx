"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2, ChevronRight, Plus, Search, Trash2, Edit, X,
  AlertTriangle, CheckCircle, Clock, FileText, Globe,
  ChevronLeft, Copy, Check, RefreshCw
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DashNav } from "@/components/dash-nav";

// ── Reference dictionaries ───────────────────────────────────────────────────
const COUNTRY_RISK: Record<string, "Low" | "Medium" | "High" | "Prohibited"> = {
  "Austria": "Low", "Belgium": "Low", "Bulgaria": "Low", "Croatia": "Low", "Cyprus": "Low",
  "Czech Republic": "Low", "Denmark": "Low", "Estonia": "Low", "Finland": "Low", "France": "Low",
  "Germany": "Low", "Greece": "Low", "Hungary": "Low", "Ireland": "Low", "Italy": "Low",
  "Latvia": "Low", "Lithuania": "Low", "Luxembourg": "Low", "Malta": "Low", "Netherlands": "Low",
  "Poland": "Low", "Portugal": "Low", "Romania": "Low", "Slovakia": "Low", "Slovenia": "Low",
  "Spain": "Low", "Sweden": "Low", "Iceland": "Low", "Liechtenstein": "Low", "Norway": "Low",
  "Australia": "Low", "Canada": "Low", "Japan": "Low", "New Zealand": "Low", "Switzerland": "Low",
  "United Kingdom": "Medium", "Gibraltar": "Medium", "United States": "Low",
  "Albania": "Medium", "Argentina": "Medium", "Brazil": "Medium", "China": "Medium",
  "Georgia": "Medium", "India": "Medium", "Indonesia": "Medium", "Israel": "Medium",
  "Kazakhstan": "Medium", "Malaysia": "Medium", "Mexico": "Medium", "Morocco": "Medium",
  "Philippines": "Medium", "Saudi Arabia": "Medium", "Serbia": "Medium", "South Africa": "Medium",
  "Thailand": "Medium", "Turkey": "Medium", "Ukraine": "Medium", "United Arab Emirates": "Medium",
  "Vietnam": "Medium", "Hong Kong": "Medium", "Singapore": "Medium",
  "Afghanistan": "Prohibited", "Belarus": "Prohibited", "Burundi": "Prohibited",
  "Central African Republic": "Prohibited", "Democratic Republic of Congo": "Prohibited",
  "Cuba": "Prohibited", "Guinea": "Prohibited", "Guinea-Bissau": "Prohibited", "Haiti": "Prohibited",
  "Iran": "Prohibited", "Iraq": "Prohibited", "Lebanon": "Prohibited", "Libya": "Prohibited",
  "Mali": "Prohibited", "Myanmar": "Prohibited", "Nicaragua": "Prohibited", "North Korea": "Prohibited",
  "Russia": "Prohibited", "Somalia": "Prohibited", "South Sudan": "Prohibited", "Sudan": "Prohibited",
  "Syria": "Prohibited", "Venezuela": "Prohibited", "Yemen": "Prohibited", "Zimbabwe": "Prohibited",
  "Algeria": "High", "Angola": "High", "Azerbaijan": "High", "Bangladesh": "High",
  "Bolivia": "High", "Cambodia": "High", "Cameroon": "High", "Colombia": "High", "Ecuador": "High",
  "Egypt": "High", "Ethiopia": "High", "Ghana": "High", "Kenya": "High", "Kyrgyzstan": "High",
  "Laos": "High", "Madagascar": "High", "Mauritius": "High", "Mongolia": "High", "Mozambique": "High",
  "Namibia": "High", "Nepal": "High", "Nigeria": "High", "Pakistan": "High", "Panama": "High",
  "Paraguay": "High", "Peru": "High", "Rwanda": "High", "Senegal": "High", "Sri Lanka": "High",
  "Tajikistan": "High", "Tanzania": "High", "Trinidad and Tobago": "High", "Tunisia": "High",
  "Turkmenistan": "High", "Uganda": "High", "Uzbekistan": "High", "Zambia": "High",
};
// Mutable overlay so editors can override or add countries at runtime and persist to localStorage.
const COUNTRY_RISK_OVERRIDES_KEY = "kyb_country_risk_v1";
let _countryOverrides: Record<string, "Low" | "Medium" | "High" | "Prohibited"> = {};

function loadCountryOverrides(): Record<string, "Low" | "Medium" | "High" | "Prohibited"> {
  if (typeof window === "undefined") return {};
  try { const r = localStorage.getItem(COUNTRY_RISK_OVERRIDES_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; }
}
function saveCountryOverrides(o: Record<string, "Low" | "Medium" | "High" | "Prohibited">) {
  try { localStorage.setItem(COUNTRY_RISK_OVERRIDES_KEY, JSON.stringify(o)); } catch {}
}
function applyCountryOverride(country: string, risk: "Low" | "Medium" | "High" | "Prohibited") {
  _countryOverrides = { ..._countryOverrides, [country]: risk };
  saveCountryOverrides(_countryOverrides);
}
function removeCountryOverride(country: string) {
  const o = { ..._countryOverrides }; delete o[country];
  _countryOverrides = o; saveCountryOverrides(o);
}
function getCountryRiskMap(): Record<string, "Low" | "Medium" | "High" | "Prohibited"> {
  return { ...COUNTRY_RISK, ..._countryOverrides };
}
function getCountryList(): string[] { return Object.keys(getCountryRiskMap()).sort(); }

function countryRisk(c: string): "Low" | "Medium" | "High" {
  const r = getCountryRiskMap()[c] ?? "High";
  return r === "Prohibited" ? "High" : r;
}
function isProhibited(c: string) { return getCountryRiskMap()[c] === "Prohibited"; }

const INDUSTRY_RISK: Record<string, "Low" | "Medium" | "High"> = {
  "E-commerce – Physical Goods": "Low",
  "IT / Software Development": "Medium", "Logistics": "Medium", "Construction": "Medium",
  "Manufacturing": "Medium", "E-commerce – Digital Goods (excl. games)": "Medium",
  "In-Game Items": "Medium", "Video Game Publishers": "Medium",
  "Marketplace – Physical Goods": "Medium", "Marketplace – Digital Goods": "Medium",
  "Marketing": "Medium", "ESports": "Medium", "Affiliate Program Partner": "Medium",
  "Import / Export": "High", "E-commerce – Supplements / Cosmetics": "High",
  "E-commerce – Subscription Services": "High", "Gift and Activation Cards": "High",
  "Affiliate Marketing": "High", "Legal and Consulting Services": "High",
  "Payment Gateways / ISO": "High", "Forex": "High", "Crypto and Blockchain": "High",
  "iGaming": "High", "Gambling Billing/Payment Agent": "High", "Skill Games": "High",
  "Games of Chance": "High", "Financial Services": "High", "Payment Services Providers": "High",
  "Holding Companies": "High", "Online Dating": "High",
};

const PRODUCT_RISK: Record<string, "Low" | "Medium" | "High"> = {
  "IBAN / vIBAN / Mass Payments": "Low",
  "Virtual Cards": "Medium", "Plastic Cards": "Medium",
  "Pay-by-Bank / Open Banking": "Medium", "Merchant Services / Checkout": "Medium",
  "Acquiring Solutions": "High",
};

// ── Risk engine — per official spec ──────────────────────────────────────────
// Factor Contribution = (RiskValue/3 * 100%) * Weight ; Low=1, Medium=2, High=3
// Max ordinary weighted score = 85%. Thresholds: <50 Low, 50–80 Medium, >80 High.
const RV: Record<"Low" | "Medium" | "High", number> = { Low: 1, Medium: 2, High: 3 };

interface RiskFactorsInput {
  countryOfIncorporation: string;
  companyAgeYears: number;
  ownershipRecords: number;
  nomineeOwnership: boolean;
  trustOrLP: boolean;
  uboResidenceCountry: string;
  directorResidenceCountry: string;
  industry: string;
  licenceRequired: boolean;
  product: string;
  geographyZone: "EEA" | "UK_GIB" | "REST";
  estimatedTurnoverEUR: number;
  pepStatus: boolean;
}

function defaultFactors(): RiskFactorsInput {
  return {
    countryOfIncorporation: "", companyAgeYears: 0, ownershipRecords: 1,
    nomineeOwnership: false, trustOrLP: false, uboResidenceCountry: "",
    directorResidenceCountry: "", industry: "", licenceRequired: false,
    product: "", geographyZone: "EEA", estimatedTurnoverEUR: 0, pepStatus: false,
  };
}

interface FactorBreakdown {
  id: string; label: string; value: string; risk: "Low" | "Medium" | "High";
  weight: number | null; contribution: number; isTrigger: boolean; triggered?: boolean;
}

function computeRisk(f: RiskFactorsInput) {
  const breakdown: FactorBreakdown[] = [];
  const triggers: string[] = [];
  let forcedHigh = false;

  const ci = countryRisk(f.countryOfIncorporation);
  breakdown.push({ id: "ci", label: "Country of Incorporation", value: f.countryOfIncorporation || "—", risk: ci, weight: 10, contribution: (RV[ci] / 3) * 100 * 0.10, isTrigger: false });
  if (isProhibited(f.countryOfIncorporation)) { triggers.push("Prohibited country of incorporation"); forcedHigh = true; }

  const age: "Low" | "Medium" | "High" = f.companyAgeYears >= 3 ? "Low" : f.companyAgeYears >= 1 ? "Medium" : "High";
  breakdown.push({ id: "age", label: "Company Age", value: `${f.companyAgeYears} yr`, risk: age, weight: 7, contribution: (RV[age] / 3) * 100 * 0.07, isTrigger: false });

  const own: "Low" | "Medium" | "High" = f.ownershipRecords < 3 ? "Low" : f.ownershipRecords === 3 ? "Medium" : "High";
  breakdown.push({ id: "own", label: "Ownership Structure", value: `${f.ownershipRecords} records`, risk: own, weight: 8, contribution: (RV[own] / 3) * 100 * 0.08, isTrigger: false });

  const ubo = countryRisk(f.uboResidenceCountry);
  breakdown.push({ id: "ubo", label: "UBO Residence", value: f.uboResidenceCountry || "—", risk: ubo, weight: 5, contribution: (RV[ubo] / 3) * 100 * 0.05, isTrigger: false });
  if (isProhibited(f.uboResidenceCountry)) { triggers.push("UBO resident in prohibited country"); forcedHigh = true; }

  const dir = countryRisk(f.directorResidenceCountry);
  breakdown.push({ id: "dir", label: "Director Residence", value: f.directorResidenceCountry || "—", risk: dir, weight: 5, contribution: (RV[dir] / 3) * 100 * 0.05, isTrigger: false });

  const ind: "Low" | "Medium" | "High" = INDUSTRY_RISK[f.industry] ?? "Medium";
  breakdown.push({ id: "ind", label: "Industry / MCC", value: f.industry || "—", risk: ind, weight: 20, contribution: (RV[ind] / 3) * 100 * 0.20, isTrigger: false });

  const prod: "Low" | "Medium" | "High" = PRODUCT_RISK[f.product] ?? "Medium";
  breakdown.push({ id: "prod", label: "Product Needed", value: f.product || "—", risk: prod, weight: 15, contribution: (RV[prod] / 3) * 100 * 0.15, isTrigger: false });

  const geo: "Low" | "Medium" | "High" = f.geographyZone === "EEA" ? "Low" : f.geographyZone === "UK_GIB" ? "Medium" : "High";
  breakdown.push({ id: "geo", label: "Geography of Operations", value: f.geographyZone === "EEA" ? "EEA" : f.geographyZone === "UK_GIB" ? "UK & Gibraltar" : "Rest of World", risk: geo, weight: 7, contribution: (RV[geo] / 3) * 100 * 0.07, isTrigger: false });

  const eur = f.estimatedTurnoverEUR;
  const trn: "Low" | "Medium" | "High" = eur <= 1_000_000 ? "Low" : eur <= 1_500_000 ? "Medium" : "High";
  breakdown.push({ id: "trn", label: "Annual Turnover", value: eur >= 1_000_000 ? `€${(eur / 1_000_000).toFixed(1)}M` : `€${(eur / 1000).toFixed(0)}K`, risk: trn, weight: 8, contribution: (RV[trn] / 3) * 100 * 0.08, isTrigger: false });

  breakdown.push({ id: "lic", label: "AML Regulated / Licence Required", value: f.licenceRequired ? "Yes" : "No", risk: f.licenceRequired ? "High" : "Low", weight: null, contribution: 0, isTrigger: true, triggered: f.licenceRequired });
  if (f.licenceRequired) { triggers.push("Licence required for activity"); forcedHigh = true; }

  breakdown.push({ id: "nom", label: "Nominee Ownership / Trust", value: (f.nomineeOwnership || f.trustOrLP) ? "Yes" : "No", risk: (f.nomineeOwnership || f.trustOrLP) ? "High" : "Low", weight: null, contribution: 0, isTrigger: true, triggered: f.nomineeOwnership || f.trustOrLP });
  if (f.nomineeOwnership || f.trustOrLP) { triggers.push("Nominee ownership / trust structure confirmed"); forcedHigh = true; }

  breakdown.push({ id: "pep", label: "PEP / RCA Involvement", value: f.pepStatus ? "Yes" : "No", risk: f.pepStatus ? "High" : "Low", weight: null, contribution: 0, isTrigger: true, triggered: f.pepStatus });
  if (f.pepStatus) { triggers.push("Confirmed PEP / RCA involvement"); forcedHigh = true; }

  const totalWeighted = breakdown.filter(b => !b.isTrigger).reduce((s, b) => s + b.contribution, 0);
  const score = Math.round(totalWeighted * 10) / 10;
  const calculatedLevel: "Low" | "Medium" | "High" = score < 50 ? "Low" : score <= 80 ? "Medium" : "High";
  const level = forcedHigh ? "High" : calculatedLevel;
  const reverificationYears = level === "Low" ? 3 : level === "Medium" ? 2 : 1;

  return { score, calculatedLevel, level, override: forcedHigh, breakdown, triggers, reverificationYears };
}

function addYears(dateStr: string, years: number): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split("T")[0];
}

// ── Data types ────────────────────────────────────────────────────────────────
interface KybClient {
  id: string; customerId: string; ct: string; companyName: string;
  connection: string; entity: string; date: string; responsible: string;
  salesKam: string; status: string; lastTouchDate: string;
  decisionDate: string; verificationNote: string; scheduledReverification: string;
  reverificationSent: boolean; midNew: string; regulated: string;
  licence: string; licenceExpiry: string; activityDesc: string;
  poiCountry: string; poiExpiry: string; porCountry: string;
  website: string; sumsubMonitoring: boolean; folder: string;
  jiraTask: string; redFlags: string;
  riskFactors: RiskFactorsInput;
  riskScore: number; riskLevel: string; riskOverride: boolean; riskReverification: string;
  auditLog: { ts: string; action: string; user: string; oldValue?: string; newValue?: string; reason?: string }[];
  createdAt: string;
}
interface Reverification {
  id: string; clientId: string; companyName: string; ct: string;
  connection: string; entity: string; riskType: string;
  responsible: string; salesKam: string; status: string;
  lastTouchDate: string; decisionDate: string; verificationNote: string;
  scheduledDate: string; requestSent: boolean; task2025_2026: string;
  notes: string; scheduledMonth: string;
}
interface IGaming {
  id: string; date: string; companyName: string; status: string;
  licenceTierType: string; licenceJurisdiction: string; website: string;
  hqCountry: string; folderLink: string; sumsubMonitoring: boolean;
  licenceHolder: string; licenceJurisdiction2: string;
  licenceTypePerm: string; licenceExpiry: string;
  assessmentStatus: string; assessmentDate: string; role: string;
}
interface Crypto {
  id: string; date: string; companyName: string; status: string;
  licenceType: string; licenceCountry: string; website: string;
  folder: string; sumsubMonitoring: boolean; licenceCountry2: string;
  licenceType2: string; licenceExpiry: string; notes: string;
  productAssignment: string; entity: string;
}
interface Acquiring {
  id: string; date: string; companyName: string; projectName: string;
  entity: string; risk: string; responsible: string; salesKam: string;
  status: string; date2: string; mid1: string; mid2: string;
  licenceMccType: string; mccCode: string; website: string;
  toaLink: string; saqType: string; saqLink: string;
  projectStage: string; targetDate: string; nextSaqType: string;
}
interface Checkout {
  id: string; date: string; statusReason: string; notes: string;
  ticketId: string; merchantUuid: string; website: string;
}
interface KybData {
  clients: KybClient[]; reverifications: Reverification[]; igaming: IGaming[];
  crypto: Crypto[]; acquiring: Acquiring[]; checkout: Checkout[];
  globalAudit: { ts: string; action: string; entity: string; user: string }[];
}

const STORAGE_KEY = "kyb_data_v4";
function emptyData(): KybData { return { clients: [], reverifications: [], igaming: [], crypto: [], acquiring: [], checkout: [], globalAudit: [] }; }
function saveData(data: KybData) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {} }
function genId(p: string) { return `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }
function genCustomerId() { return `KYB-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`; }

function seedData(): KybData {
  const f1: RiskFactorsInput = { countryOfIncorporation: "Estonia", companyAgeYears: 6, ownershipRecords: 2, nomineeOwnership: false, trustOrLP: false, uboResidenceCountry: "Estonia", directorResidenceCountry: "Estonia", industry: "Crypto and Blockchain", licenceRequired: true, product: "IBAN / vIBAN / Mass Payments", geographyZone: "EEA", estimatedTurnoverEUR: 2_000_000, pepStatus: false };
  const r1 = computeRisk(f1);
  const f2: RiskFactorsInput = { countryOfIncorporation: "Germany", companyAgeYears: 3, ownershipRecords: 4, nomineeOwnership: false, trustOrLP: false, uboResidenceCountry: "Russia", directorResidenceCountry: "Germany", industry: "E-commerce – Physical Goods", licenceRequired: false, product: "Merchant Services / Checkout", geographyZone: "EEA", estimatedTurnoverEUR: 900_000, pepStatus: false };
  const r2 = computeRisk(f2);
  const f3: RiskFactorsInput = { countryOfIncorporation: "Malta", companyAgeYears: 8, ownershipRecords: 2, nomineeOwnership: false, trustOrLP: false, uboResidenceCountry: "Malta", directorResidenceCountry: "Malta", industry: "iGaming", licenceRequired: true, product: "Acquiring Solutions", geographyZone: "EEA", estimatedTurnoverEUR: 12_000_000, pepStatus: false };
  const r3 = computeRisk(f3);

  const clients: KybClient[] = [
    { id: genId("kyb"), customerId: "KYB-2025-00001", ct: "Corporate", companyName: "Nexus Payment Solutions Ltd", connection: "Direct", entity: "UTH EU", date: "2025-01-10", responsible: "A.Johnson", salesKam: "B.Smith", status: "Approved", lastTouchDate: "2025-06-01", decisionDate: "2025-06-10", verificationNote: "All docs verified", scheduledReverification: addYears("2025-06-10", r1.reverificationYears), reverificationSent: false, midNew: "MID-4421", regulated: "Yes – FIU Estonia VASP", licence: "VASP-EE-2025", licenceExpiry: "2026-12-31", activityDesc: "Crypto exchange for retail clients", poiCountry: "Estonia", poiExpiry: "2027-01-01", porCountry: "Estonia", website: "nexuspay.io", sumsubMonitoring: true, folder: "GDrive/KYB/Nexus", jiraTask: "KYB-441", redFlags: "", riskFactors: f1, riskScore: r1.score, riskLevel: r1.level, riskOverride: r1.override, riskReverification: `${r1.reverificationYears} year(s)`, auditLog: [{ ts: "2025-01-10T09:00:00Z", action: "Client created", user: "A.Johnson" }, { ts: "2025-06-10T14:30:00Z", action: "Status → Approved", user: "A.Johnson" }], createdAt: "2025-01-10T09:00:00Z" },
    { id: genId("kyb"), customerId: "KYB-2025-00002", ct: "Individual", companyName: "Global Merchants GmbH", connection: "Referral", entity: "UTH DE", date: "2025-02-15", responsible: "C.Mueller", salesKam: "D.Braun", status: "Pending", lastTouchDate: "2025-05-20", decisionDate: "", verificationNote: "Awaiting UBO docs", scheduledReverification: "", reverificationSent: false, midNew: "", regulated: "No", licence: "", licenceExpiry: "", activityDesc: "E-commerce retail", poiCountry: "Germany", poiExpiry: "2028-03-15", porCountry: "Germany", website: "globalmerch.de", sumsubMonitoring: false, folder: "GDrive/KYB/GlobalMerch", jiraTask: "KYB-442", redFlags: "Complex ownership", riskFactors: f2, riskScore: r2.score, riskLevel: r2.level, riskOverride: r2.override, riskReverification: `${r2.reverificationYears} year(s)`, auditLog: [{ ts: "2025-02-15T10:00:00Z", action: "Client created", user: "C.Mueller" }], createdAt: "2025-02-15T10:00:00Z" },
    { id: genId("kyb"), customerId: "KYB-2025-00003", ct: "Corporate", companyName: "Lucky Star Casino Ltd", connection: "Direct", entity: "UTH MT", date: "2025-03-01", responsible: "E.Vella", salesKam: "F.Borg", status: "High Risk – Approved", lastTouchDate: "2025-06-20", decisionDate: "2025-06-20", verificationNote: "Enhanced due diligence completed", scheduledReverification: addYears("2025-06-20", r3.reverificationYears), reverificationSent: false, midNew: "MID-8832", regulated: "Yes – MGA Malta", licence: "MGA/B2C/444/2021", licenceExpiry: "2026-03-01", activityDesc: "Online casino and sports betting", poiCountry: "Malta", poiExpiry: "2027-06-01", porCountry: "Malta", website: "luckystar.mt", sumsubMonitoring: true, folder: "GDrive/KYB/LuckyStar", jiraTask: "KYB-443", redFlags: "iGaming – elevated monitoring", riskFactors: f3, riskScore: r3.score, riskLevel: r3.level, riskOverride: r3.override, riskReverification: `${r3.reverificationYears} year(s)`, auditLog: [{ ts: "2025-03-01T08:00:00Z", action: "Client created", user: "E.Vella" }, { ts: "2025-06-20T11:00:00Z", action: "EDD completed – Approved", user: "E.Vella" }], createdAt: "2025-03-01T08:00:00Z" },
  ];
  const igaming: IGaming[] = [{ id: genId("ig"), date: "2025-01-15", companyName: "Lucky Star Casino Ltd", status: "Active", licenceTierType: "B2C/Class 1", licenceJurisdiction: "Malta (MGA)", website: "luckystar.mt", hqCountry: "Malta", folderLink: "GDrive/iGaming/LuckyStar", sumsubMonitoring: true, licenceHolder: "Lucky Star Casino Ltd", licenceJurisdiction2: "Curaçao", licenceTypePerm: "Permanent", licenceExpiry: "2026-03-01", assessmentStatus: "Completed", assessmentDate: "2025-01-10", role: "Operator" }];
  const crypto: Crypto[] = [{ id: genId("cr"), date: "2025-01-10", companyName: "Nexus Payment Solutions Ltd", status: "Active", licenceType: "VASP", licenceCountry: "Estonia", website: "nexuspay.io", folder: "GDrive/Crypto/Nexus", sumsubMonitoring: true, licenceCountry2: "", licenceType2: "", licenceExpiry: "2026-12-31", notes: "FIU registered", productAssignment: "Crypto exchange", entity: "UTH EU" }];
  const acquiring: Acquiring[] = [{ id: genId("aq"), date: "2025-04-01", companyName: "Global Merchants GmbH", projectName: "EU Checkout Integration", entity: "UTH DE", risk: "Medium", responsible: "C.Mueller", salesKam: "D.Braun", status: "In Progress", date2: "2025-06-01", mid1: "", mid2: "", licenceMccType: "E-commerce", mccCode: "5999", website: "globalmerch.de", toaLink: "", saqType: "SAQ-A", saqLink: "", projectStage: "Integration", targetDate: "2025-09-01", nextSaqType: "SAQ-A-EP" }];
  const checkout: Checkout[] = [{ id: genId("ch"), date: "2025-05-10", statusReason: "Pending review", notes: "New APM request – SEPA DD", ticketId: "TKT-2025-0088", merchantUuid: "m-99f3b2a1", website: "globalmerch.de" }];

  const data: KybData = { clients, reverifications: [], igaming, crypto, acquiring, checkout, globalAudit: [] };
  saveData(data);
  return data;
}

function loadData(): KybData {
  if (typeof window === "undefined") return emptyData();
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return JSON.parse(raw); } catch {}
  return seedData();
}

function RiskBadge({ level }: { level: string }) {
  const cls = level === "High" ? "bg-red-500/15 text-red-400 border-red-500/30"
    : level === "Medium" ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
    : "bg-green-500/15 text-green-400 border-green-500/30";
  return <Badge className={`text-[10px] border ${cls}`}>{level}</Badge>;
}
function StatusBadge({ status }: { status: string }) {
  const cls = status === "Approved" || status === "Active" ? "bg-green-500/15 text-green-400 border-green-500/30"
    : status === "Rejected" ? "bg-red-500/15 text-red-400 border-red-500/30"
    : status.includes("High Risk") ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
    : "bg-zinc-500/15 text-zinc-400 border-zinc-700";
  return <Badge className={`text-[10px] border ${cls}`}>{status || "—"}</Badge>;
}
function Field({ label, value, onChange, type = "text", placeholder = "", className = "", mono = false }:
  { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; className?: string; mono?: boolean }) {
  return (
    <div className={className}>
      <label className="block text-[10px] text-zinc-500 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 ${mono ? "font-mono" : ""}`} />
    </div>
  );
}
function SelectField({ label, value, onChange, options, className = "" }:
  { label: string; value: string; onChange: (v: string) => void; options: string[]; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-[10px] text-zinc-500 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500">
        <option value="">— select —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

const CT_OPTIONS = ["Corporate", "Individual", "Trust", "Foundation", "Partnership", "Other"];
const STATUS_OPTIONS = ["Pending", "In Review", "Approved", "High Risk – Approved", "Rejected", "On Hold", "Closed"];
const WIZARD_STEPS = ["Basic Info", "Activity & Compliance", "Risk Factors", "Score Review", "Status & Finalize"];

export default function KYBPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<KybData>(() => loadData());
  const [activeTab, setActiveTab] = useState("clients");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    _countryOverrides = loadCountryOverrides();
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

  const TABS = [
    { id: "clients", label: "Clients" },
    { id: "reverifications", label: "Re-verifications" },
    { id: "igaming", label: "iGaming Licenses" },
    { id: "crypto", label: "Crypto Licenses" },
    { id: "acquiring", label: "Acquiring Projects" },
    { id: "checkout", label: "Checkout APMs" },
    { id: "calculator", label: "Risk Calculator" },
    { id: "countries", label: "Country Risk" },
  ];

  const highRisk = data.clients.filter(c => c.riskLevel === "High").length;
  const pendingRev = data.clients.filter(c => c.status === "Pending" || c.status === "In Review").length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <DashNav user={user} />
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-black text-white">KYB — Business Due Diligence</h1>
          </div>
          <p className="text-zinc-500 text-sm">Know Your Business compliance tracking. Clients here are separate from auth system clients.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total KYB Clients", value: data.clients.length, icon: Building2, color: "text-indigo-400" },
            { label: "High Risk", value: highRisk, icon: AlertTriangle, color: "text-red-400" },
            { label: "Pending / In Review", value: pendingRev, icon: Clock, color: "text-yellow-400" },
            { label: "Re-verifications", value: data.reverifications.length, icon: RefreshCw, color: "text-green-400" },
          ].map(k => (
            <div key={k.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <k.icon className={`w-4 h-4 ${k.color}`} />
                <p className="text-zinc-500 text-[10px] uppercase tracking-wide">{k.label}</p>
              </div>
              <p className="text-2xl font-black text-white">{k.value}</p>
            </div>
          ))}
        </div>
        <div className="border-b border-zinc-800 flex gap-0.5 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-4 py-2.5 text-xs whitespace-nowrap border-b-2 -mb-px transition-colors cursor-pointer ${activeTab === t.id ? "border-indigo-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div>
          {activeTab === "clients" && <ClientsTab data={data} setData={setData} user={user} />}
          {activeTab === "reverifications" && <ReverificationsTab data={data} setData={setData} />}
          {activeTab === "igaming" && <IGamingTab data={data} setData={setData} />}
          {activeTab === "crypto" && <CryptoTab data={data} setData={setData} />}
          {activeTab === "acquiring" && <AcquiringTab data={data} setData={setData} />}
          {activeTab === "checkout" && <CheckoutTab data={data} setData={setData} />}
          {activeTab === "calculator" && <RiskCalcTab />}
          {activeTab === "countries" && <CountryRiskTab />}

        </div>
      </div>
    </div>
  );
}

// ── Clients tab ───────────────────────────────────────────────────────────────
function ClientsTab({ data, setData, user }: { data: KybData; setData: (d: KybData) => void; user: any }) {
  const [search, setSearch] = useState("");
  const [showWizard, setShowWizard] = useState(false);
  const [selected, setSelected] = useState<KybClient | null>(null);

  const filtered = data.clients.filter(c =>
    c.companyName.toLowerCase().includes(search.toLowerCase()) ||
    c.customerId.toLowerCase().includes(search.toLowerCase()) ||
    c.status.toLowerCase().includes(search.toLowerCase())
  );

  const addClient = (c: KybClient) => {
    const nd = { ...data, clients: [...data.clients, c], globalAudit: [...data.globalAudit, { ts: new Date().toISOString(), action: `Client added: ${c.companyName}`, entity: c.customerId, user: user?.email ?? "system" }] };
    setData(nd); saveData(nd); setShowWizard(false);
  };
  const updateClient = (c: KybClient) => {
    const nd = { ...data, clients: data.clients.map(x => x.id === c.id ? c : x) };
    setData(nd); saveData(nd); setSelected(c);
  };
  const deleteClient = (id: string) => {
    if (!confirm("Delete this client?")) return;
    const nd = { ...data, clients: data.clients.filter(c => c.id !== id) };
    setData(nd); saveData(nd);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients…" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500" />
        </div>
        <button onClick={() => setShowWizard(true)} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-2 rounded-lg cursor-pointer transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Client
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              {["Customer ID", "Company Name", "CT", "Entity", "Responsible", "Risk", "Status", "Decision Date", "Reverification", "Actions"].map(h => (
                <th key={h} className="px-3 py-2 text-left text-zinc-500 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-zinc-600">No clients found</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/40 transition-colors">
                <td className="px-3 py-2 font-mono text-indigo-400">{c.customerId}</td>
                <td className="px-3 py-2"><button onClick={() => setSelected(c)} className="text-white hover:text-indigo-300 cursor-pointer text-left">{c.companyName}</button></td>
                <td className="px-3 py-2 text-zinc-400">{c.ct}</td>
                <td className="px-3 py-2 text-zinc-400">{c.entity || "—"}</td>
                <td className="px-3 py-2 text-zinc-400">{c.responsible || "—"}</td>
                <td className="px-3 py-2"><RiskBadge level={c.riskLevel} /></td>
                <td className="px-3 py-2"><StatusBadge status={c.status} /></td>
                <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">{c.decisionDate || "—"}</td>
                <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">{c.scheduledReverification || "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => setSelected(c)} className="text-zinc-500 hover:text-indigo-400 cursor-pointer p-1"><Edit className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteClient(c.id)} className="text-zinc-500 hover:text-red-400 cursor-pointer p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-zinc-600 text-[10px] mt-2">{filtered.length} client{filtered.length !== 1 ? "s" : ""}</p>
      {showWizard && <AddClientWizard onClose={() => setShowWizard(false)} onSave={addClient} user={user} />}
      {selected && <ClientDetail client={selected} onClose={() => setSelected(null)} onUpdate={updateClient} />}
    </div>
  );
}

// ── Add Client Wizard (5 steps) ──────────────────────────────────────────────
function AddClientWizard({ onClose, onSave, user }: { onClose: () => void; onSave: (c: KybClient) => void; user: any }) {
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState<any>({
    customerId: genCustomerId(), ct: "Corporate", companyName: "", connection: "",
    entity: "", date: new Date().toISOString().split("T")[0], responsible: "", salesKam: "",
    activityDesc: "", regulated: "No", licence: "", licenceExpiry: "", poiCountry: "", poiExpiry: "",
    porCountry: "", website: "", sumsubMonitoring: false, folder: "", jiraTask: "", redFlags: "",
    status: "Pending", verificationNote: "", midNew: "", reverificationSent: false,
    riskFactors: defaultFactors(),
  });

  const rf: RiskFactorsInput = form.riskFactors;
  const risk = computeRisk(rf);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const setRf = (k: keyof RiskFactorsInput, v: any) => setForm((f: any) => ({ ...f, riskFactors: { ...f.riskFactors, [k]: v } }));

  const curlCmd = `curl -X POST https://auth-demo-rouge.vercel.app/api/kyb/clients \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "companyName": "${form.companyName || "Acme Corp"}",
    "ct": "${form.ct}",
    "countryOfIncorporation": "${rf.countryOfIncorporation || "Estonia"}",
    "industry": "${rf.industry || "E-commerce – Physical Goods"}",
    "licenceRequired": ${rf.licenceRequired},
    "website": "${form.website || "example.com"}"
  }'`;

  const handleSave = () => {
    const now = new Date().toISOString();
    const newClient: KybClient = {
      id: genId("kyb"), customerId: form.customerId, ct: form.ct, companyName: form.companyName,
      connection: form.connection, entity: form.entity, date: form.date, responsible: form.responsible,
      salesKam: form.salesKam, status: form.status, lastTouchDate: now.split("T")[0],
      decisionDate: form.status === "Approved" || form.status.includes("High Risk") ? now.split("T")[0] : "",
      verificationNote: form.verificationNote,
      scheduledReverification: addYears(now.split("T")[0], risk.reverificationYears),
      reverificationSent: form.reverificationSent, midNew: form.midNew, regulated: form.regulated,
      licence: form.licence, licenceExpiry: form.licenceExpiry, activityDesc: form.activityDesc,
      poiCountry: form.poiCountry, poiExpiry: form.poiExpiry, porCountry: form.porCountry,
      website: form.website, sumsubMonitoring: form.sumsubMonitoring, folder: form.folder,
      jiraTask: form.jiraTask, redFlags: form.redFlags, riskFactors: rf,
      riskScore: risk.score, riskLevel: risk.level, riskOverride: risk.override,
      riskReverification: `${risk.reverificationYears} year(s)`,
      auditLog: [{ ts: now, action: "Client created via wizard", user: user?.email ?? "system" }],
      createdAt: now,
    };
    onSave(newClient);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-white font-bold text-base">Add KYB Client</h2>
            <p className="text-zinc-500 text-xs mt-0.5">Step {step + 1} of {WIZARD_STEPS.length} — {WIZARD_STEPS[step]}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 pt-4 pb-2 flex gap-1.5">
          {WIZARD_STEPS.map((s, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className={`h-1.5 w-full rounded-full transition-colors ${i <= step ? "bg-indigo-500" : "bg-zinc-700"}`} />
              <span className={`text-[9px] ${i === step ? "text-indigo-400" : "text-zinc-600"} hidden sm:block`}>{s}</span>
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {step === 0 && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Customer ID" value={form.customerId} onChange={v => set("customerId", v)} mono />
              <Field label="Date" type="date" value={form.date} onChange={v => set("date", v)} />
              <SelectField label="CT (Client Type)" value={form.ct} onChange={v => set("ct", v)} options={CT_OPTIONS} />
              <Field label="Company / Individual Name" value={form.companyName} onChange={v => set("companyName", v)} />
              <Field label="Connection" value={form.connection} onChange={v => set("connection", v)} />
              <Field label="Entity" value={form.entity} onChange={v => set("entity", v)} placeholder="UTH EU / UTH MT…" />
              <Field label="Responsible" value={form.responsible} onChange={v => set("responsible", v)} />
              <Field label="Sales / KAM" value={form.salesKam} onChange={v => set("salesKam", v)} />
              <Field label="Website" value={form.website} onChange={v => set("website", v)} className="col-span-2" />
              <div className="col-span-2 bg-zinc-950 border border-zinc-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-indigo-400 font-mono font-semibold">API: Create client programmatically</p>
                  <button onClick={() => { navigator.clipboard.writeText(curlCmd); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="flex items-center gap-1 text-zinc-400 hover:text-white cursor-pointer">
                    {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    <span className="text-[10px]">{copied ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <pre className="text-[10px] text-zinc-400 font-mono whitespace-pre-wrap leading-relaxed">{curlCmd}</pre>
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Activity Description" value={form.activityDesc} onChange={v => set("activityDesc", v)} className="col-span-2" />
              <SelectField label="Regulated / Non-regulated" value={form.regulated} onChange={v => set("regulated", v)} options={["No", "Yes – FIU Estonia VASP", "Yes – MGA Malta", "Yes – UKGC", "Yes – BaFin", "Yes – AMF France", "Yes – Other"]} />
              <Field label="Licence" value={form.licence} onChange={v => set("licence", v)} />
              <Field label="Licence Expiry" type="date" value={form.licenceExpiry} onChange={v => set("licenceExpiry", v)} />
              <SelectField label="POI Country" value={form.poiCountry} onChange={v => set("poiCountry", v)} options={getCountryList()} />
              <Field label="POI Expiry" type="date" value={form.poiExpiry} onChange={v => set("poiExpiry", v)} />
              <SelectField label="POR Country" value={form.porCountry} onChange={v => set("porCountry", v)} options={getCountryList()} />
              <Field label="Folder (GDrive link)" value={form.folder} onChange={v => set("folder", v)} />
              <Field label="Jira Task" value={form.jiraTask} onChange={v => set("jiraTask", v)} />
              <div className="flex items-center gap-3 col-span-2 bg-zinc-800 rounded-lg p-3">
                <input type="checkbox" id="sumsub" checked={form.sumsubMonitoring} onChange={e => set("sumsubMonitoring", e.target.checked)} className="w-4 h-4 accent-indigo-500" />
                <label htmlFor="sumsub" className="text-sm text-zinc-300 cursor-pointer">SumSub Ongoing Monitoring enabled</label>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-400">Configure all risk factors. Licence required, Nominee/Trust ownership, and PEP/RCA are mandatory High-risk triggers — they override the calculated score.</p>
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Country of Incorporation (10%)" value={rf.countryOfIncorporation} onChange={v => setRf("countryOfIncorporation", v)} options={getCountryList()} />
                <Field label="Company Age (years, 7%)" type="number" value={String(rf.companyAgeYears)} onChange={v => setRf("companyAgeYears", Number(v) || 0)} />
                <Field label="Ownership/Control Records Count (8%)" type="number" value={String(rf.ownershipRecords)} onChange={v => setRf("ownershipRecords", Number(v) || 0)} />
                <SelectField label="UBO Residence (5%)" value={rf.uboResidenceCountry} onChange={v => setRf("uboResidenceCountry", v)} options={getCountryList()} />
                <SelectField label="Director Residence (5%)" value={rf.directorResidenceCountry} onChange={v => setRf("directorResidenceCountry", v)} options={getCountryList()} />
                <SelectField label="Industry / MCC (20%)" value={rf.industry} onChange={v => setRf("industry", v)} options={Object.keys(INDUSTRY_RISK)} />
                <SelectField label="Product Needed (15%)" value={rf.product} onChange={v => setRf("product", v)} options={Object.keys(PRODUCT_RISK)} />
                <SelectField label="Geography of Operations (7%)" value={rf.geographyZone} onChange={v => setRf("geographyZone", v as any)} options={["EEA", "UK_GIB", "REST"]} />
                <Field label="Annual Turnover EUR (8%)" type="number" value={String(rf.estimatedTurnoverEUR)} onChange={v => setRf("estimatedTurnoverEUR", Number(v) || 0)} />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2">
                {[["licenceRequired", "AML Regulated / Licence Required"], ["nomineeOwnership", "Nominee Ownership"], ["pepStatus", "PEP / RCA Involvement"]].map(([k, label]) => (
                  <label key={k} className={`flex items-center gap-2 rounded-lg p-3 border cursor-pointer ${rf[k as keyof RiskFactorsInput] ? "border-red-500/40 bg-red-500/10" : "border-zinc-700 bg-zinc-800"}`}>
                    <input type="checkbox" checked={!!rf[k as keyof RiskFactorsInput]} onChange={e => setRf(k as keyof RiskFactorsInput, e.target.checked)} className="w-4 h-4 accent-red-500" />
                    <span className="text-xs text-zinc-300">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <div className={`rounded-xl p-5 border ${risk.level === "High" ? "border-red-500/30 bg-red-500/5" : risk.level === "Medium" ? "border-yellow-500/30 bg-yellow-500/5" : "border-green-500/30 bg-green-500/5"}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-bold text-lg">{risk.score}<span className="text-sm font-normal text-zinc-400">% weighted score</span></h3>
                  <RiskBadge level={risk.level} />
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2 mb-1">
                  <div className={`h-2 rounded-full ${risk.level === "High" ? "bg-red-500" : risk.level === "Medium" ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: `${Math.min(100, (risk.score / 85) * 100)}%` }} />
                </div>
                <p className="text-xs text-zinc-400 mt-2">Calculated level: <span className="text-white">{risk.calculatedLevel}</span> · Re-verification: <span className="text-white">{risk.reverificationYears} year(s)</span></p>
                {risk.override && <p className="text-xs text-red-400 mt-1">Override applied — final level forced to High</p>}
                {risk.triggers.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {risk.triggers.map(t => <Badge key={t} className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/30">{t}</Badge>)}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Factor Breakdown</p>
                {risk.breakdown.map(b => (
                  <div key={b.id} className="grid grid-cols-4 gap-2 text-xs py-1.5 border-b border-zinc-800 items-center">
                    <span className="text-zinc-300 col-span-1">{b.label}</span>
                    <span className="text-zinc-400 text-[10px] truncate">{b.value || "—"}</span>
                    <div className="w-full bg-zinc-800 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${b.risk === "High" ? "bg-red-500" : b.risk === "Medium" ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: b.isTrigger ? (b.triggered ? "100%" : "0%") : `${(RV[b.risk] / 3) * 100}%` }} />
                    </div>
                    <span className="text-zinc-400 text-right text-[10px]">{b.isTrigger ? (b.triggered ? "Trigger active" : "—") : `${b.weight}% × ${((RV[b.risk] / 3) * 100).toFixed(0)}% = ${b.contribution.toFixed(1)}`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Status" value={form.status} onChange={v => set("status", v)} options={STATUS_OPTIONS} />
              <Field label="MID NEW (with limits)" value={form.midNew} onChange={v => set("midNew", v)} />
              <Field label="Verification Note" value={form.verificationNote} onChange={v => set("verificationNote", v)} className="col-span-2" />
              <Field label="Red Flags" value={form.redFlags} onChange={v => set("redFlags", v)} className="col-span-2" />
              <div className="flex items-center gap-3 col-span-2 bg-zinc-800 rounded-lg p-3">
                <input type="checkbox" id="revSent" checked={form.reverificationSent} onChange={e => set("reverificationSent", e.target.checked)} className="w-4 h-4 accent-indigo-500" />
                <label htmlFor="revSent" className="text-sm text-zinc-300 cursor-pointer">Reverification Request Sent</label>
              </div>
              <div className="col-span-2 bg-zinc-800 rounded-xl p-4 space-y-2">
                <p className="text-xs text-zinc-400 font-semibold">Summary</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  <span className="text-zinc-500">Customer ID</span><span className="text-white font-mono">{form.customerId}</span>
                  <span className="text-zinc-500">Company</span><span className="text-white">{form.companyName || "—"}</span>
                  <span className="text-zinc-500">Risk Score</span><span className="text-white">{risk.score}%</span>
                  <span className="text-zinc-500">Risk Level</span><span><RiskBadge level={risk.level} /></span>
                  <span className="text-zinc-500">Re-verification</span><span className="text-white">{risk.reverificationYears} year(s)</span>
                  <span className="text-zinc-500">Status</span><span><StatusBadge status={form.status} /></span>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-zinc-800 flex justify-between">
          <button onClick={() => step > 0 ? setStep(s => s - 1) : onClose()} className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm cursor-pointer">
            <ChevronLeft className="w-4 h-4" />{step === 0 ? "Cancel" : "Back"}
          </button>
          {step < WIZARD_STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={step === 0 && !form.companyName} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg transition-colors cursor-pointer">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSave} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-sm px-5 py-2 rounded-lg transition-colors cursor-pointer">
              <CheckCircle className="w-4 h-4" /> Save Client
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Client detail panel ───────────────────────────────────────────────────────
function ClientDetail({ client, onClose, onUpdate }: { client: KybClient; onClose: () => void; onUpdate: (c: KybClient) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<KybClient>({ ...client });
  const [reason, setReason] = useState("");
  const risk = computeRisk(form.riskFactors);

  const setRf = (k: keyof RiskFactorsInput, v: any) => setForm(f => ({ ...f, riskFactors: { ...f.riskFactors, [k]: v } }));

  const save = () => {
    if (!reason.trim()) { alert("Please provide a reason for this change."); return; }
    const now = new Date().toISOString();
    const updated: KybClient = {
      ...form, riskScore: risk.score, riskLevel: risk.level, riskOverride: risk.override,
      riskReverification: `${risk.reverificationYears} year(s)`,
      scheduledReverification: addYears(now.split("T")[0], risk.reverificationYears),
      lastTouchDate: now.split("T")[0],
      auditLog: [...form.auditLog, { ts: now, action: "Manual update", user: "current-user", oldValue: `${client.riskLevel} (${client.riskScore}%)`, newValue: `${risk.level} (${risk.score}%)`, reason: reason.trim() }],
    };
    onUpdate(updated);
    setEditing(false); setReason("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <p className="text-zinc-500 text-xs font-mono">{client.customerId}</p>
            <h2 className="text-white font-bold">{client.companyName}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(!editing)} className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 rounded-lg px-3 py-1 cursor-pointer">{editing ? "Cancel" : "Edit"}</button>
            {editing && <button onClick={save} className="text-xs text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg px-3 py-1 cursor-pointer">Save</button>}
            <button onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">Overview</p>
              <div className="space-y-1.5 text-xs">
                {[["Status", <StatusBadge key="s" status={form.status} />],
                  ["Risk Level", <RiskBadge key="r" level={risk.level} />],
                  ["Risk Score", `${risk.score}%`],
                  ["Override", risk.override ? "Yes" : "No"],
                  ["Re-verification", `${risk.reverificationYears} year(s)`],
                  ["Regulated", form.regulated],
                  ["Responsible", form.responsible],
                  ["Sales/KAM", form.salesKam],
                  ["Entity", form.entity],
                ].map(([k, v]) => (
                  <div key={String(k)} className="flex justify-between gap-4">
                    <span className="text-zinc-500">{String(k)}</span>
                    <span className="text-white">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">Risk Breakdown</p>
              <div className="space-y-1.5">
                {risk.breakdown.map(b => (
                  <div key={b.id} className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-400 w-28 shrink-0">{b.label}</span>
                    <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${b.risk === "High" ? "bg-red-500" : b.risk === "Medium" ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: b.isTrigger ? (b.triggered ? "100%" : "0%") : `${(RV[b.risk] / 3) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {editing && (
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">Edit Risk Factors</p>
                <div className="grid grid-cols-2 gap-2">
                  <SelectField label="Country of Incorporation" value={form.riskFactors.countryOfIncorporation} onChange={v => setRf("countryOfIncorporation", v)} options={getCountryList()} />
                  <Field label="Company Age (yrs)" type="number" value={String(form.riskFactors.companyAgeYears)} onChange={v => setRf("companyAgeYears", Number(v) || 0)} />
                  <Field label="Ownership records" type="number" value={String(form.riskFactors.ownershipRecords)} onChange={v => setRf("ownershipRecords", Number(v) || 0)} />
                  <SelectField label="UBO Residence" value={form.riskFactors.uboResidenceCountry} onChange={v => setRf("uboResidenceCountry", v)} options={getCountryList()} />
                  <SelectField label="Industry" value={form.riskFactors.industry} onChange={v => setRf("industry", v)} options={Object.keys(INDUSTRY_RISK)} />
                  <SelectField label="Product" value={form.riskFactors.product} onChange={v => setRf("product", v)} options={Object.keys(PRODUCT_RISK)} />
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  {[["licenceRequired", "Licence Required"], ["nomineeOwnership", "Nominee"], ["pepStatus", "PEP/RCA"]].map(([k, label]) => (
                    <label key={k} className="flex items-center gap-1.5 text-[10px] text-zinc-300 cursor-pointer">
                      <input type="checkbox" checked={!!form.riskFactors[k as keyof RiskFactorsInput]} onChange={e => setRf(k as keyof RiskFactorsInput, e.target.checked)} className="accent-red-500" />{label}
                    </label>
                  ))}
                </div>
                <Field label="Reason for change (required)" value={reason} onChange={setReason} className="mt-2" />
              </div>
            )}
          </div>
          <div className="space-y-4">
            {editing ? (
              <div className="space-y-2">
                <SelectField label="Status" value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))} options={STATUS_OPTIONS} />
                <Field label="Verification Note" value={form.verificationNote} onChange={v => setForm(f => ({ ...f, verificationNote: v }))} />
                <Field label="MID NEW" value={form.midNew} onChange={v => setForm(f => ({ ...f, midNew: v }))} />
                <Field label="Red Flags" value={form.redFlags} onChange={v => setForm(f => ({ ...f, redFlags: v }))} />
                <Field label="Jira Task" value={form.jiraTask} onChange={v => setForm(f => ({ ...f, jiraTask: v }))} />
                <Field label="Folder" value={form.folder} onChange={v => setForm(f => ({ ...f, folder: v }))} />
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Details</p>
                {[["Activity", form.activityDesc], ["Website", form.website], ["Licence", form.licence || "—"], ["Licence Expiry", form.licenceExpiry || "—"], ["POI Country", form.poiCountry], ["POR Country", form.porCountry], ["MID NEW", form.midNew || "—"], ["Jira Task", form.jiraTask || "—"], ["Red Flags", form.redFlags || "—"], ["Verification Note", form.verificationNote || "—"]].map(([k, v]) => (
                  <div key={k} className="flex gap-4">
                    <span className="text-zinc-500 w-28 shrink-0">{k}</span>
                    <span className="text-white">{v}</span>
                  </div>
                ))}
              </div>
            )}
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">Audit Trail</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {[...form.auditLog].reverse().map((log, i) => (
                  <div key={i} className="bg-zinc-800 rounded-lg px-3 py-2 text-xs">
                    <p className="text-white">{log.action}</p>
                    {log.oldValue && <p className="text-zinc-400 text-[10px] font-mono">{log.oldValue} → {log.newValue}</p>}
                    {log.reason && <p className="text-zinc-400 text-[10px] italic">&ldquo;{log.reason}&rdquo;</p>}
                    <p className="text-zinc-500 text-[10px]">{new Date(log.ts).toLocaleString()} · {log.user}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Re-verifications tab ─────────────────────────────────────────────────────
function ReverificationsTab({ data, setData }: { data: KybData; setData: (d: KybData) => void }) {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<Reverification>>({ id: "", clientId: "", companyName: "", ct: "Corporate", connection: "", entity: "", riskType: "Medium", responsible: "", salesKam: "", status: "Pending", lastTouchDate: "", decisionDate: "", verificationNote: "", scheduledDate: "", requestSent: false, task2025_2026: "", notes: "", scheduledMonth: "" });

  const filtered = data.reverifications.filter(r => r.companyName.toLowerCase().includes(search.toLowerCase()) || r.status.toLowerCase().includes(search.toLowerCase()));
  const save = () => { const nd = { ...data, reverifications: [...data.reverifications, { ...form, id: genId("rev") } as Reverification] }; setData(nd); saveData(nd); setShowAdd(false); };
  const del = (id: string) => { if (!confirm("Delete?")) return; const nd = { ...data, reverifications: data.reverifications.filter(r => r.id !== id) }; setData(nd); saveData(nd); };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search re-verifications…" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500" /></div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-2 rounded-lg cursor-pointer"><Plus className="w-3.5 h-3.5" /> Add</button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-zinc-800 bg-zinc-900/50">{["MID NEW", "Company Name", "CT", "Risk Type", "Responsible", "Status", "Decision Date", "Scheduled Date", "Rev. Task 25/26", "Scheduled Month", "Actions"].map(h => <th key={h} className="px-3 py-2 text-left text-zinc-500 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={11} className="px-4 py-8 text-center text-zinc-600">No re-verifications</td></tr>
              : filtered.map(r => (
                <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/40">
                  <td className="px-3 py-2 font-mono text-zinc-400">{r.clientId || "—"}</td>
                  <td className="px-3 py-2 text-white">{r.companyName}</td>
                  <td className="px-3 py-2 text-zinc-400">{r.ct}</td>
                  <td className="px-3 py-2"><RiskBadge level={r.riskType} /></td>
                  <td className="px-3 py-2 text-zinc-400">{r.responsible}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-2 text-zinc-400">{r.decisionDate || "—"}</td>
                  <td className="px-3 py-2 text-zinc-400">{r.scheduledDate || "—"}</td>
                  <td className="px-3 py-2 text-zinc-400">{r.task2025_2026 || "—"}</td>
                  <td className="px-3 py-2 text-zinc-400">{r.scheduledMonth || "—"}</td>
                  <td className="px-3 py-2"><button onClick={() => del(r.id)} className="text-zinc-500 hover:text-red-400 cursor-pointer p-1"><Trash2 className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-xl shadow-2xl p-6 space-y-3">
            <div className="flex justify-between items-center mb-2"><h3 className="text-white font-bold">Add Re-verification</h3><button onClick={() => setShowAdd(false)} className="text-zinc-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Company Name" value={form.companyName!} onChange={v => setForm(f => ({ ...f, companyName: v }))} />
              <SelectField label="CT" value={form.ct!} onChange={v => setForm(f => ({ ...f, ct: v }))} options={CT_OPTIONS} />
              <SelectField label="Risk Type" value={form.riskType!} onChange={v => setForm(f => ({ ...f, riskType: v }))} options={["Low", "Medium", "High"]} />
              <SelectField label="Status" value={form.status!} onChange={v => setForm(f => ({ ...f, status: v }))} options={STATUS_OPTIONS} />
              <Field label="Responsible" value={form.responsible!} onChange={v => setForm(f => ({ ...f, responsible: v }))} />
              <Field label="Sales/KAM" value={form.salesKam!} onChange={v => setForm(f => ({ ...f, salesKam: v }))} />
              <Field label="Scheduled Date" type="date" value={form.scheduledDate!} onChange={v => setForm(f => ({ ...f, scheduledDate: v }))} />
              <Field label="Scheduled Month" value={form.scheduledMonth!} onChange={v => setForm(f => ({ ...f, scheduledMonth: v }))} placeholder="Jan 2026" />
              <Field label="Task 2025/2026" value={form.task2025_2026!} onChange={v => setForm(f => ({ ...f, task2025_2026: v }))} className="col-span-2" />
              <Field label="Notes" value={form.notes!} onChange={v => setForm(f => ({ ...f, notes: v }))} className="col-span-2" />
            </div>
            <div className="flex justify-end gap-2 pt-2"><button onClick={() => setShowAdd(false)} className="text-zinc-400 hover:text-white text-sm cursor-pointer">Cancel</button><button onClick={save} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg cursor-pointer">Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── iGaming tab ───────────────────────────────────────────────────────────────
const EMPTY_IGAMING: Partial<IGaming> = { date: new Date().toISOString().split("T")[0], companyName: "", status: "Active", licenceTierType: "", licenceJurisdiction: "", website: "", hqCountry: "", folderLink: "", sumsubMonitoring: false, licenceHolder: "", licenceJurisdiction2: "", licenceTypePerm: "Permanent", licenceExpiry: "", assessmentStatus: "Pending", assessmentDate: "", role: "" };

function IGamingTab({ data, setData }: { data: KybData; setData: (d: KybData) => void }) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<IGaming>>(EMPTY_IGAMING);

  const filtered = data.igaming.filter(r => r.companyName.toLowerCase().includes(search.toLowerCase()));
  const openAdd = () => { setEditId(null); setForm(EMPTY_IGAMING); setShowForm(true); };
  const openEdit = (r: IGaming) => { setEditId(r.id); setForm({ ...r }); setShowForm(true); };
  const save = () => {
    const nd = editId
      ? { ...data, igaming: data.igaming.map(x => x.id === editId ? { ...form, id: editId } as IGaming : x) }
      : { ...data, igaming: [...data.igaming, { ...form, id: genId("ig") } as IGaming] };
    setData(nd); saveData(nd); setShowForm(false);
  };
  const del = (id: string) => { if (!confirm("Delete?")) return; const nd = { ...data, igaming: data.igaming.filter(r => r.id !== id) }; setData(nd); saveData(nd); };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search iGaming…" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500" /></div>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-2 rounded-lg cursor-pointer"><Plus className="w-3.5 h-3.5" /> Add</button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-zinc-800 bg-zinc-900/50">{["Date", "Company Name", "Status", "Licence Tier/Type", "Jurisdiction", "HQ Country", "Licence Holder", "Licence Type", "Expiry", "Assessment", "Role", "Actions"].map(h => <th key={h} className="px-3 py-2 text-left text-zinc-500 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={12} className="px-4 py-8 text-center text-zinc-600">No iGaming licenses</td></tr>
              : filtered.map(r => (
                <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/40">
                  <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">{r.date}</td>
                  <td className="px-3 py-2 text-white">{r.companyName}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-2 text-zinc-400">{r.licenceTierType}</td>
                  <td className="px-3 py-2 text-zinc-400">{r.licenceJurisdiction}</td>
                  <td className="px-3 py-2 text-zinc-400">{r.hqCountry}</td>
                  <td className="px-3 py-2 text-zinc-400">{r.licenceHolder}</td>
                  <td className="px-3 py-2 text-zinc-400">{r.licenceTypePerm}</td>
                  <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">{r.licenceExpiry || "—"}</td>
                  <td className="px-3 py-2 text-zinc-400">{r.assessmentStatus}</td>
                  <td className="px-3 py-2 text-zinc-400">{r.role}</td>
                  <td className="px-3 py-2"><div className="flex items-center gap-1">
                    <button onClick={() => openEdit(r)} className="text-zinc-500 hover:text-indigo-400 cursor-pointer p-1"><Edit className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(r.id)} className="text-zinc-500 hover:text-red-400 cursor-pointer p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-xl shadow-2xl p-6 space-y-3">
            <div className="flex justify-between items-center mb-2"><h3 className="text-white font-bold">{editId ? "Edit iGaming License" : "Add iGaming License"}</h3><button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" type="date" value={form.date!} onChange={v => setForm(f => ({ ...f, date: v }))} />
              <Field label="Company Name" value={form.companyName!} onChange={v => setForm(f => ({ ...f, companyName: v }))} />
              <SelectField label="Status" value={form.status!} onChange={v => setForm(f => ({ ...f, status: v }))} options={["Active", "Pending", "Expired", "Revoked", "Suspended"]} />
              <Field label="Licence Tier/Type" value={form.licenceTierType!} onChange={v => setForm(f => ({ ...f, licenceTierType: v }))} />
              <Field label="Jurisdiction" value={form.licenceJurisdiction!} onChange={v => setForm(f => ({ ...f, licenceJurisdiction: v }))} />
              <Field label="HQ Country" value={form.hqCountry!} onChange={v => setForm(f => ({ ...f, hqCountry: v }))} />
              <Field label="Licence Holder" value={form.licenceHolder!} onChange={v => setForm(f => ({ ...f, licenceHolder: v }))} />
              <SelectField label="Licence Type" value={form.licenceTypePerm!} onChange={v => setForm(f => ({ ...f, licenceTypePerm: v }))} options={["Permanent", "Temporary"]} />
              <Field label="Licence Expiry" type="date" value={form.licenceExpiry!} onChange={v => setForm(f => ({ ...f, licenceExpiry: v }))} />
              <Field label="Role" value={form.role!} onChange={v => setForm(f => ({ ...f, role: v }))} />
              <Field label="Assessment Status" value={form.assessmentStatus!} onChange={v => setForm(f => ({ ...f, assessmentStatus: v }))} />
              <Field label="Assessment Date" type="date" value={form.assessmentDate!} onChange={v => setForm(f => ({ ...f, assessmentDate: v }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2"><button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-white text-sm cursor-pointer">Cancel</button><button onClick={save} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg cursor-pointer">Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Crypto tab ────────────────────────────────────────────────────────────────
const EMPTY_CRYPTO: Partial<Crypto> = { date: new Date().toISOString().split("T")[0], companyName: "", status: "Active", licenceType: "VASP", licenceCountry: "", website: "", folder: "", sumsubMonitoring: false, licenceCountry2: "", licenceType2: "", licenceExpiry: "", notes: "", productAssignment: "", entity: "" };

function CryptoTab({ data, setData }: { data: KybData; setData: (d: KybData) => void }) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Crypto>>(EMPTY_CRYPTO);

  const filtered = data.crypto.filter(r => r.companyName.toLowerCase().includes(search.toLowerCase()));
  const openAdd = () => { setEditId(null); setForm(EMPTY_CRYPTO); setShowForm(true); };
  const openEdit = (r: Crypto) => { setEditId(r.id); setForm({ ...r }); setShowForm(true); };
  const save = () => {
    const nd = editId
      ? { ...data, crypto: data.crypto.map(x => x.id === editId ? { ...form, id: editId } as Crypto : x) }
      : { ...data, crypto: [...data.crypto, { ...form, id: genId("cr") } as Crypto] };
    setData(nd); saveData(nd); setShowForm(false);
  };
  const del = (id: string) => { if (!confirm("Delete?")) return; const nd = { ...data, crypto: data.crypto.filter(r => r.id !== id) }; setData(nd); saveData(nd); };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search crypto licenses…" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500" /></div>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-2 rounded-lg cursor-pointer"><Plus className="w-3.5 h-3.5" /> Add</button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-zinc-800 bg-zinc-900/50">{["Date", "Company Name", "Status", "Licence Type", "Country", "Licence Expiry", "Product", "Entity", "Notes", "Actions"].map(h => <th key={h} className="px-3 py-2 text-left text-zinc-500 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={10} className="px-4 py-8 text-center text-zinc-600">No crypto licenses</td></tr>
              : filtered.map(r => (
                <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/40">
                  <td className="px-3 py-2 text-zinc-400">{r.date}</td>
                  <td className="px-3 py-2 text-white">{r.companyName}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-2 text-zinc-400">{r.licenceType}</td>
                  <td className="px-3 py-2 text-zinc-400">{r.licenceCountry}</td>
                  <td className="px-3 py-2 text-zinc-400">{r.licenceExpiry || "—"}</td>
                  <td className="px-3 py-2 text-zinc-400">{r.productAssignment || "—"}</td>
                  <td className="px-3 py-2 text-zinc-400">{r.entity || "—"}</td>
                  <td className="px-3 py-2 text-zinc-400 max-w-[120px] truncate">{r.notes || "—"}</td>
                  <td className="px-3 py-2"><div className="flex items-center gap-1">
                    <button onClick={() => openEdit(r)} className="text-zinc-500 hover:text-indigo-400 cursor-pointer p-1"><Edit className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(r.id)} className="text-zinc-500 hover:text-red-400 cursor-pointer p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-xl shadow-2xl p-6 space-y-3">
            <div className="flex justify-between items-center mb-2"><h3 className="text-white font-bold">{editId ? "Edit Crypto License" : "Add Crypto License"}</h3><button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" type="date" value={form.date!} onChange={v => setForm(f => ({ ...f, date: v }))} />
              <Field label="Company Name" value={form.companyName!} onChange={v => setForm(f => ({ ...f, companyName: v }))} />
              <SelectField label="Status" value={form.status!} onChange={v => setForm(f => ({ ...f, status: v }))} options={["Active", "Pending", "Expired", "Revoked"]} />
              <SelectField label="Licence Type" value={form.licenceType!} onChange={v => setForm(f => ({ ...f, licenceType: v }))} options={["VASP", "EMI", "CASP", "Other"]} />
              <SelectField label="Licence Country" value={form.licenceCountry!} onChange={v => setForm(f => ({ ...f, licenceCountry: v }))} options={getCountryList()} />
              <Field label="Licence Expiry" type="date" value={form.licenceExpiry!} onChange={v => setForm(f => ({ ...f, licenceExpiry: v }))} />
              <Field label="Product Assignment" value={form.productAssignment!} onChange={v => setForm(f => ({ ...f, productAssignment: v }))} />
              <Field label="Entity" value={form.entity!} onChange={v => setForm(f => ({ ...f, entity: v }))} />
              <Field label="Notes" value={form.notes!} onChange={v => setForm(f => ({ ...f, notes: v }))} className="col-span-2" />
            </div>
            <div className="flex justify-end gap-2 pt-2"><button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-white text-sm cursor-pointer">Cancel</button><button onClick={save} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg cursor-pointer">Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Acquiring tab ─────────────────────────────────────────────────────────────
const EMPTY_ACQUIRING: Partial<Acquiring> = { date: new Date().toISOString().split("T")[0], companyName: "", projectName: "", entity: "", risk: "Medium", responsible: "", salesKam: "", status: "In Progress", date2: "", mid1: "", mid2: "", licenceMccType: "", mccCode: "", website: "", toaLink: "", saqType: "", saqLink: "", projectStage: "", targetDate: "", nextSaqType: "" };

function AcquiringTab({ data, setData }: { data: KybData; setData: (d: KybData) => void }) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Acquiring>>(EMPTY_ACQUIRING);

  const filtered = data.acquiring.filter(r => r.companyName.toLowerCase().includes(search.toLowerCase()) || r.projectName.toLowerCase().includes(search.toLowerCase()));
  const openAdd = () => { setEditId(null); setForm(EMPTY_ACQUIRING); setShowForm(true); };
  const openEdit = (r: Acquiring) => { setEditId(r.id); setForm({ ...r }); setShowForm(true); };
  const save = () => {
    const nd = editId
      ? { ...data, acquiring: data.acquiring.map(x => x.id === editId ? { ...form, id: editId } as Acquiring : x) }
      : { ...data, acquiring: [...data.acquiring, { ...form, id: genId("aq") } as Acquiring] };
    setData(nd); saveData(nd); setShowForm(false);
  };
  const del = (id: string) => { if (!confirm("Delete?")) return; const nd = { ...data, acquiring: data.acquiring.filter(r => r.id !== id) }; setData(nd); saveData(nd); };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search acquiring…" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500" /></div>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-2 rounded-lg cursor-pointer"><Plus className="w-3.5 h-3.5" /> Add</button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-zinc-800 bg-zinc-900/50">{["Date", "Company", "Project", "Entity", "Risk", "Responsible", "Status", "MID1", "MCC", "SAQ Type", "Project Stage", "Target Date", "Actions"].map(h => <th key={h} className="px-3 py-2 text-left text-zinc-500 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={13} className="px-4 py-8 text-center text-zinc-600">No acquiring projects</td></tr>
              : filtered.map(r => (
                <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/40">
                  <td className="px-3 py-2 text-zinc-400">{r.date}</td>
                  <td className="px-3 py-2 text-white">{r.companyName}</td>
                  <td className="px-3 py-2 text-zinc-400">{r.projectName}</td>
                  <td className="px-3 py-2 text-zinc-400">{r.entity}</td>
                  <td className="px-3 py-2"><RiskBadge level={r.risk} /></td>
                  <td className="px-3 py-2 text-zinc-400">{r.responsible}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-2 text-zinc-400 font-mono">{r.mid1 || "—"}</td>
                  <td className="px-3 py-2 text-zinc-400">{r.mccCode || "—"}</td>
                  <td className="px-3 py-2 text-zinc-400">{r.saqType || "—"}</td>
                  <td className="px-3 py-2 text-zinc-400">{r.projectStage || "—"}</td>
                  <td className="px-3 py-2 text-zinc-400">{r.targetDate || "—"}</td>
                  <td className="px-3 py-2"><div className="flex items-center gap-1">
                    <button onClick={() => openEdit(r)} className="text-zinc-500 hover:text-indigo-400 cursor-pointer p-1"><Edit className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(r.id)} className="text-zinc-500 hover:text-red-400 cursor-pointer p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl shadow-2xl p-6 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-2"><h3 className="text-white font-bold">{editId ? "Edit Acquiring Project" : "Add Acquiring Project"}</h3><button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" type="date" value={form.date!} onChange={v => setForm(f => ({ ...f, date: v }))} />
              <Field label="Company Name" value={form.companyName!} onChange={v => setForm(f => ({ ...f, companyName: v }))} />
              <Field label="Project Name" value={form.projectName!} onChange={v => setForm(f => ({ ...f, projectName: v }))} className="col-span-2" />
              <Field label="Entity" value={form.entity!} onChange={v => setForm(f => ({ ...f, entity: v }))} />
              <SelectField label="Risk" value={form.risk!} onChange={v => setForm(f => ({ ...f, risk: v }))} options={["Low", "Medium", "High"]} />
              <Field label="Responsible" value={form.responsible!} onChange={v => setForm(f => ({ ...f, responsible: v }))} />
              <Field label="Sales/KAM" value={form.salesKam!} onChange={v => setForm(f => ({ ...f, salesKam: v }))} />
              <SelectField label="Status" value={form.status!} onChange={v => setForm(f => ({ ...f, status: v }))} options={["In Progress", "Pending", "Approved", "Rejected", "On Hold"]} />
              <Field label="MID1" value={form.mid1!} onChange={v => setForm(f => ({ ...f, mid1: v }))} />
              <Field label="MID2" value={form.mid2!} onChange={v => setForm(f => ({ ...f, mid2: v }))} />
              <Field label="Licence/MCC Type" value={form.licenceMccType!} onChange={v => setForm(f => ({ ...f, licenceMccType: v }))} />
              <Field label="MCC Code" value={form.mccCode!} onChange={v => setForm(f => ({ ...f, mccCode: v }))} />
              <Field label="Website" value={form.website!} onChange={v => setForm(f => ({ ...f, website: v }))} />
              <Field label="SAQ Type" value={form.saqType!} onChange={v => setForm(f => ({ ...f, saqType: v }))} />
              <Field label="Project Stage" value={form.projectStage!} onChange={v => setForm(f => ({ ...f, projectStage: v }))} />
              <Field label="Target Date" type="date" value={form.targetDate!} onChange={v => setForm(f => ({ ...f, targetDate: v }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2"><button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-white text-sm cursor-pointer">Cancel</button><button onClick={save} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg cursor-pointer">Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Checkout APMs tab ─────────────────────────────────────────────────────────
const EMPTY_CHECKOUT: Partial<Checkout> = { date: new Date().toISOString().split("T")[0], statusReason: "", notes: "", ticketId: "", merchantUuid: "", website: "" };

function CheckoutTab({ data, setData }: { data: KybData; setData: (d: KybData) => void }) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Checkout>>(EMPTY_CHECKOUT);

  const filtered = data.checkout.filter(r => r.website.toLowerCase().includes(search.toLowerCase()) || r.ticketId.toLowerCase().includes(search.toLowerCase()));
  const openAdd = () => { setEditId(null); setForm(EMPTY_CHECKOUT); setShowForm(true); };
  const openEdit = (r: Checkout) => { setEditId(r.id); setForm({ ...r }); setShowForm(true); };
  const save = () => {
    const nd = editId
      ? { ...data, checkout: data.checkout.map(x => x.id === editId ? { ...form, id: editId } as Checkout : x) }
      : { ...data, checkout: [...data.checkout, { ...form, id: genId("ch") } as Checkout] };
    setData(nd); saveData(nd); setShowForm(false);
  };
  const del = (id: string) => { if (!confirm("Delete?")) return; const nd = { ...data, checkout: data.checkout.filter(r => r.id !== id) }; setData(nd); saveData(nd); };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search checkout APMs…" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500" /></div>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-2 rounded-lg cursor-pointer"><Plus className="w-3.5 h-3.5" /> Add</button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-zinc-800 bg-zinc-900/50">{["Date", "Status/Reason", "Notes", "Ticket ID", "Merchant UUID", "Website", "Actions"].map(h => <th key={h} className="px-3 py-2 text-left text-zinc-500 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-600">No checkout APM entries</td></tr>
              : filtered.map(r => (
                <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/40">
                  <td className="px-3 py-2 text-zinc-400">{r.date}</td>
                  <td className="px-3 py-2 text-zinc-300">{r.statusReason}</td>
                  <td className="px-3 py-2 text-zinc-400 max-w-[150px] truncate">{r.notes || "—"}</td>
                  <td className="px-3 py-2 text-zinc-400 font-mono">{r.ticketId}</td>
                  <td className="px-3 py-2 text-zinc-400 font-mono text-[10px]">{r.merchantUuid}</td>
                  <td className="px-3 py-2 text-zinc-400">{r.website}</td>
                  <td className="px-3 py-2"><div className="flex items-center gap-1">
                    <button onClick={() => openEdit(r)} className="text-zinc-500 hover:text-indigo-400 cursor-pointer p-1"><Edit className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(r.id)} className="text-zinc-500 hover:text-red-400 cursor-pointer p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-3">
            <div className="flex justify-between items-center mb-2"><h3 className="text-white font-bold">{editId ? "Edit Checkout APM" : "Add Checkout APM"}</h3><button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" type="date" value={form.date!} onChange={v => setForm(f => ({ ...f, date: v }))} />
              <Field label="Status / Reason" value={form.statusReason!} onChange={v => setForm(f => ({ ...f, statusReason: v }))} />
              <Field label="Ticket ID" value={form.ticketId!} onChange={v => setForm(f => ({ ...f, ticketId: v }))} />
              <Field label="Merchant UUID" value={form.merchantUuid!} onChange={v => setForm(f => ({ ...f, merchantUuid: v }))} mono />
              <Field label="Website" value={form.website!} onChange={v => setForm(f => ({ ...f, website: v }))} />
              <Field label="Notes" value={form.notes!} onChange={v => setForm(f => ({ ...f, notes: v }))} className="col-span-2" />
            </div>
            <div className="flex justify-end gap-2 pt-2"><button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-white text-sm cursor-pointer">Cancel</button><button onClick={save} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg cursor-pointer">Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Risk Calculator tab ───────────────────────────────────────────────────────
function RiskCalcTab() {
  const [factors, setFactors] = useState<RiskFactorsInput>(defaultFactors());
  const risk = computeRisk(factors);
  const setF = (k: keyof RiskFactorsInput, v: any) => setFactors(f => ({ ...f, [k]: v }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-zinc-400">Configure Risk Factors</p>
          <button onClick={() => setFactors(defaultFactors())} className="text-xs text-zinc-500 hover:text-white cursor-pointer flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Reset</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Country of Incorporation (10%)" value={factors.countryOfIncorporation} onChange={v => setF("countryOfIncorporation", v)} options={getCountryList()} />
          <Field label="Company Age (years, 7%)" type="number" value={String(factors.companyAgeYears)} onChange={v => setF("companyAgeYears", Number(v) || 0)} />
          <Field label="Ownership/Control Records (8%)" type="number" value={String(factors.ownershipRecords)} onChange={v => setF("ownershipRecords", Number(v) || 0)} />
          <SelectField label="UBO Residence (5%)" value={factors.uboResidenceCountry} onChange={v => setF("uboResidenceCountry", v)} options={getCountryList()} />
          <SelectField label="Director Residence (5%)" value={factors.directorResidenceCountry} onChange={v => setF("directorResidenceCountry", v)} options={getCountryList()} />
          <SelectField label="Industry / MCC (20%)" value={factors.industry} onChange={v => setF("industry", v)} options={Object.keys(INDUSTRY_RISK)} />
          <SelectField label="Product Needed (15%)" value={factors.product} onChange={v => setF("product", v)} options={Object.keys(PRODUCT_RISK)} />
          <SelectField label="Geography of Operations (7%)" value={factors.geographyZone} onChange={v => setF("geographyZone", v as any)} options={["EEA", "UK_GIB", "REST"]} />
          <Field label="Annual Turnover EUR (8%)" type="number" value={String(factors.estimatedTurnoverEUR)} onChange={v => setF("estimatedTurnoverEUR", Number(v) || 0)} />
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[["licenceRequired", "AML Regulated / Licence Required"], ["nomineeOwnership", "Nominee Ownership"], ["pepStatus", "PEP / RCA Involvement"]].map(([k, label]) => (
            <label key={k} className={`flex items-center gap-2 rounded-lg p-3 border cursor-pointer ${factors[k as keyof RiskFactorsInput] ? "border-red-500/40 bg-red-500/10" : "border-zinc-700 bg-zinc-900"}`}>
              <input type="checkbox" checked={!!factors[k as keyof RiskFactorsInput]} onChange={e => setF(k as keyof RiskFactorsInput, e.target.checked)} className="w-4 h-4 accent-red-500" />
              <span className="text-xs text-zinc-300">{label}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-4 lg:sticky lg:top-16">
        <div className={`rounded-xl p-5 border ${risk.level === "High" ? "border-red-500/40 bg-red-500/5" : risk.level === "Medium" ? "border-yellow-500/40 bg-yellow-500/5" : "border-green-500/40 bg-green-500/5"}`}>
          <p className="text-zinc-400 text-xs mb-1">Weighted Risk Score</p>
          <p className="text-4xl font-black text-white">{risk.score}<span className="text-base text-zinc-500">%</span></p>
          <div className="w-full bg-zinc-800 rounded-full h-2 my-3">
            <div className={`h-2 rounded-full transition-all ${risk.level === "High" ? "bg-red-500" : risk.level === "Medium" ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: `${Math.min(100, (risk.score / 85) * 100)}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <RiskBadge level={risk.level} />
            <p className="text-xs text-zinc-400">Re-verify: <span className="text-white">{risk.reverificationYears} yr</span></p>
          </div>
          <p className="text-[10px] text-zinc-500 mt-2">Thresholds: &lt;50% Low · 50–80% Medium · &gt;80% High. Max ordinary score 85%.</p>
        </div>
        {risk.triggers.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 space-y-1">
            <p className="text-xs text-red-400 font-semibold">Active Overrides</p>
            {risk.triggers.map(t => <p key={t} className="text-xs text-red-300">• {t}</p>)}
          </div>
        )}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2">
          <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide">Breakdown</p>
          {risk.breakdown.map(b => (
            <div key={b.id} className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-400 w-24 shrink-0 leading-tight">{b.label}</span>
              <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full ${b.risk === "High" ? "bg-red-500" : b.risk === "Medium" ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: b.isTrigger ? (b.triggered ? "100%" : "0%") : `${(RV[b.risk] / 3) * 100}%` }} />
              </div>
              <span className="text-[10px] text-zinc-500 w-8 text-right">{b.weight ? `${b.weight}%` : "trig"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Country Risk tab ──────────────────────────────────────────────────────────
const RISK_LEVELS = ["Low", "Medium", "High", "Prohibited"] as const;
type RiskLevel = "Low" | "Medium" | "High" | "Prohibited";

function riskCls(risk: RiskLevel) {
  return risk === "Low" ? "border-green-500/20 bg-green-500/5"
    : risk === "Medium" ? "border-yellow-500/20 bg-yellow-500/5"
    : risk === "High" ? "border-red-500/20 bg-red-500/5"
    : "border-purple-500/20 bg-purple-500/5";
}
function riskBadgeCls(risk: RiskLevel) {
  return risk === "Low" ? "border-green-500/30 text-green-400"
    : risk === "Medium" ? "border-yellow-500/30 text-yellow-400"
    : risk === "High" ? "border-red-500/30 text-red-400"
    : "border-purple-500/30 text-purple-400";
}
function riskTextCls(risk: RiskLevel) {
  return risk === "Low" ? "text-green-400" : risk === "Medium" ? "text-yellow-400" : risk === "High" ? "text-red-400" : "text-purple-400";
}

function CountryRiskTab() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"All" | RiskLevel>("All");
  const [version, setVersion] = useState(0); // bump to force re-render after edits
  const [showAdd, setShowAdd] = useState(false);
  const [newCountry, setNewCountry] = useState("");
  const [newRisk, setNewRisk] = useState<RiskLevel>("Medium");

  const map = getCountryRiskMap();
  const countries = Object.entries(map)
    .filter(([c, r]) => (filter === "All" || r === filter) && c.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a[0].localeCompare(b[0]));

  const counts = { Low: 0, Medium: 0, High: 0, Prohibited: 0 };
  Object.values(map).forEach(r => { counts[r]++; });

  const isOverridden = (c: string) => c in _countryOverrides;
  const isCustom = (c: string) => !(c in COUNTRY_RISK);

  const changeRisk = (country: string, risk: RiskLevel) => {
    applyCountryOverride(country, risk);
    setVersion(v => v + 1);
  };
  const resetCountry = (country: string) => {
    removeCountryOverride(country);
    setVersion(v => v + 1);
  };
  const addCountry = () => {
    if (!newCountry.trim()) return;
    applyCountryOverride(newCountry.trim(), newRisk);
    setVersion(v => v + 1);
    setNewCountry(""); setShowAdd(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="grid grid-cols-4 gap-2 flex-1">
          {RISK_LEVELS.map(l => (
            <button key={l} onClick={() => setFilter(f => f === l ? "All" : l)} className={`rounded-xl p-3 border cursor-pointer transition-colors ${filter === l ? (l === "Low" ? "border-green-500 bg-green-500/10" : l === "Medium" ? "border-yellow-500 bg-yellow-500/10" : l === "High" ? "border-red-500 bg-red-500/10" : "border-purple-500 bg-purple-500/10") : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"}`}>
              <p className={`text-xl font-black ${riskTextCls(l)}`}>{counts[l]}</p>
              <p className="text-zinc-400 text-xs">{l}</p>
            </button>
          ))}
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-2 rounded-lg cursor-pointer shrink-0"><Plus className="w-3.5 h-3.5" /> Add Country</button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search countries…" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {countries.map(([country, risk]) => (
          <div key={country + version} className={`rounded-lg px-3 py-2 border flex items-center gap-2 ${riskCls(risk as RiskLevel)}`}>
            <span className="text-xs text-zinc-300 flex-1 truncate">{country}</span>
            {(isCustom(country) || isOverridden(country)) && (
              <span className="text-[9px] text-indigo-400 font-mono">custom</span>
            )}
            <select value={risk} onChange={e => changeRisk(country, e.target.value as RiskLevel)}
              className="bg-zinc-800 border border-zinc-700 rounded px-1.5 py-1 text-[10px] text-white focus:outline-none focus:border-indigo-500 cursor-pointer shrink-0">
              {RISK_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            {isOverridden(country) && (
              <button onClick={() => resetCountry(country)} title="Reset to default" className="text-zinc-600 hover:text-zinc-400 cursor-pointer shrink-0 text-[10px]">↺</button>
            )}
            {isCustom(country) && (
              <button onClick={() => resetCountry(country)} title="Remove custom country" className="text-zinc-600 hover:text-red-400 cursor-pointer shrink-0"><Trash2 className="w-3 h-3" /></button>
            )}
          </div>
        ))}
        {countries.length === 0 && <p className="text-zinc-600 text-xs col-span-3 py-6 text-center">No countries match the filter.</p>}
      </div>
      <p className="text-zinc-600 text-[10px] mt-3">
        {countries.length} countries shown · Changes saved automatically · Prohibited countries force High risk in scoring.
      </p>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-white font-bold">Add Country</h3>
              <button onClick={() => setShowAdd(false)} className="text-zinc-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Country Name</label>
                <input value={newCountry} onChange={e => setNewCountry(e.target.value)} placeholder="e.g. Andorra" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Risk Level</label>
                <select value={newRisk} onChange={e => setNewRisk(e.target.value as RiskLevel)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500">
                  {RISK_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="text-zinc-400 hover:text-white text-sm cursor-pointer">Cancel</button>
              <button onClick={addCountry} disabled={!newCountry.trim()} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm px-4 py-2 rounded-lg cursor-pointer">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
