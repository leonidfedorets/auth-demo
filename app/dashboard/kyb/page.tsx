"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Building2, Search, Shield, AlertTriangle, CheckCircle, Clock,
  Edit2, Save, X, History, Globe, FileText, Calendar, Filter,
  ChevronDown, RefreshCw, Info, TrendingUp, Plus, Minus
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

// ─── TYPES ────────────────────────────────────────────────────────────────────
type RiskLevel = "Low" | "Medium" | "High" | "Prohibited";

interface RiskFactors {
  countryOfIncorporation: string;
  companyAgeYears: number;
  ownershipRecords: number;
  nomineeOwnership: boolean;
  trustOrLP: boolean;
  uboResidenceCountry: string;
  directorResidenceCountry: string;
  industry: string;
  amlRegulated: boolean;
  product: string;
  geographyZone: "EEA" | "UK_GIB" | "REST";
  estimatedTurnoverEUR: number;
  pepStatus: boolean;
}

interface RiskBreakdown {
  factor: string; label: string; value: string;
  risk: "Low" | "Medium" | "High"; weight: number | null;
  contribution: number; isTrigger: boolean; triggered?: boolean;
}

interface RiskResult {
  score: number; level: "Low" | "Medium" | "High";
  reverificationYears: number; breakdown: RiskBreakdown[]; triggers: string[];
}

interface AuditEntry {
  id: string; timestamp: string; user: string; clientId: string; clientName: string;
  factor: string; oldValue: string; newValue: string; reason: string;
}

interface KybClient {
  id: string; date: string; customerId: string; ct: string; companyName: string;
  connection: string; entity: string; responsible: string; salesKam: string;
  status: string; lastTouchDate: string; verificationNote: string;
  reverificationRequestSent: boolean; midNew: string; regulated: string;
  license: string; licenseExpiry: string; activityDescription: string;
  poiCountry: string; poiExpiry: string; porCountry: string; website: string;
  sumsubMonitoring: boolean; jiraTask: string; redFlags: string;
  riskFactors: RiskFactors; auditLog: AuditEntry[];
  riskScore: number; riskLevel: "Low" | "Medium" | "High"; reverificationDate: string;
}

// ─── COUNTRY RISK DATABASE ────────────────────────────────────────────────────
const COUNTRY_RISK: Record<string, RiskLevel> = {
  // LOW – EEA
  "Austria":"Low","Belgium":"Low","Bulgaria":"Low","Croatia":"Low","Cyprus":"Low",
  "Czech Republic":"Low","Denmark":"Low","Estonia":"Low","Finland":"Low","France":"Low",
  "Germany":"Low","Greece":"Low","Hungary":"Low","Ireland":"Low","Italy":"Low",
  "Latvia":"Low","Lithuania":"Low","Luxembourg":"Low","Malta":"Low","Netherlands":"Low",
  "Poland":"Low","Portugal":"Low","Romania":"Low","Slovakia":"Low","Slovenia":"Low",
  "Spain":"Low","Sweden":"Low",
  // LOW – equivalents
  "Iceland":"Low","Liechtenstein":"Low","Norway":"Low","Australia":"Low","Canada":"Low",
  "Cape Verde":"Low","Chile":"Low","Japan":"Low","Monaco":"Low","New Zealand":"Low",
  "San Marino":"Low","South Korea":"Low","Switzerland":"Low","United Kingdom":"Low",
  "UK":"Low","United States":"Low","USA":"Low","Uruguay":"Low","Gibraltar":"Low",
  // MEDIUM
  "Albania":"Medium","Argentina":"Medium","Bhutan":"Medium","Bosnia and Herzegovina":"Medium",
  "Botswana":"Medium","Brazil":"Medium","China":"Medium","Colombia":"Medium",
  "Costa Rica":"Medium","Ecuador":"Medium","Fiji":"Medium","Georgia":"Medium",
  "Ghana":"Medium","Guatemala":"Medium","Honduras":"Medium","India":"Medium",
  "Indonesia":"Medium","Israel":"Medium","Jamaica":"Medium","Jordan":"Medium",
  "Kazakhstan":"Medium","Kosovo":"Medium","Malaysia":"Medium","Mexico":"Medium",
  "Moldova":"Medium","Mongolia":"Medium","Montenegro":"Medium","Morocco":"Medium",
  "Namibia":"Medium","North Macedonia":"Medium","Oman":"Medium","Panama":"Medium",
  "Paraguay":"Medium","Peru":"Medium","Philippines":"Medium","Qatar":"Medium",
  "Saudi Arabia":"Medium","Senegal":"Medium","Serbia":"Medium","South Africa":"Medium",
  "Sri Lanka":"Medium","Thailand":"Medium","Trinidad and Tobago":"Medium","Tunisia":"Medium",
  "Turkey":"Medium","United Arab Emirates":"Medium","UAE":"Medium","Ukraine":"Medium","Vietnam":"Medium",
  // PROHIBITED
  "Afghanistan":"Prohibited","Belarus":"Prohibited","Burundi":"Prohibited",
  "Central African Republic":"Prohibited","Congo (DRC)":"Prohibited",
  "Democratic Republic of Congo":"Prohibited","Cuba":"Prohibited","Guinea":"Prohibited",
  "Guinea-Bissau":"Prohibited","Haiti":"Prohibited","Iran":"Prohibited","Iraq":"Prohibited",
  "Lebanon":"Prohibited","Libya":"Prohibited","Mali":"Prohibited","Myanmar":"Prohibited",
  "Nicaragua":"Prohibited","North Korea":"Prohibited","Russia":"Prohibited",
  "Somalia":"Prohibited","South Sudan":"Prohibited","Sudan":"Prohibited",
  "Syria":"Prohibited","Venezuela":"Prohibited","Yemen":"Prohibited","Zimbabwe":"Prohibited",
  // HIGH (explicit)
  "Algeria":"High","Angola":"High","Antigua and Barbuda":"High","Armenia":"High",
  "Azerbaijan":"High","Bahamas":"High","Bahrain":"High","Bangladesh":"High",
  "Barbados":"High","Belize":"High","Benin":"High","Bolivia":"High","Brunei":"High",
  "Burkina Faso":"High","Cambodia":"High","Cameroon":"High","Chad":"High","Comoros":"High",
  "Djibouti":"High","Dominica":"High","Dominican Republic":"High","Egypt":"High",
  "El Salvador":"High","Equatorial Guinea":"High","Eritrea":"High","Eswatini":"High",
  "Ethiopia":"High","Gabon":"High","Gambia":"High","Grenada":"High","Guyana":"High",
  "Kenya":"High","Kiribati":"High","Kuwait":"High","Kyrgyzstan":"High","Laos":"High",
  "Lesotho":"High","Liberia":"High","Madagascar":"High","Malawi":"High","Maldives":"High",
  "Marshall Islands":"High","Mauritania":"High","Mauritius":"High","Micronesia":"High",
  "Mozambique":"High","Nauru":"High","Nepal":"High","Niger":"High","Nigeria":"High",
  "Pakistan":"High","Palau":"High","Papua New Guinea":"High","Rwanda":"High",
  "Saint Kitts and Nevis":"High","Saint Lucia":"High","Saint Vincent and the Grenadines":"High",
  "Samoa":"High","São Tomé and Príncipe":"High","Sierra Leone":"High","Singapore":"High",
  "Solomon Islands":"High","Suriname":"High","Tajikistan":"High","Tanzania":"High",
  "Timor-Leste":"High","Togo":"High","Tonga":"High","Turkmenistan":"High",
  "Tuvalu":"High","Uganda":"High","Uzbekistan":"High","Vanuatu":"High","Zambia":"High",
};

const COUNTRY_LIST = Object.entries(COUNTRY_RISK)
  .map(([name, risk]) => ({ name, risk }))
  .sort((a, b) => a.name.localeCompare(b.name));

function getCountryRisk(country: string): RiskLevel {
  return COUNTRY_RISK[country] ?? "High";
}

// ─── INDUSTRY & PRODUCT RISK ──────────────────────────────────────────────────
const INDUSTRY_LIST: { name: string; risk: "Low" | "Medium" | "High" }[] = [
  { name: "IT / Software Development", risk: "Medium" },
  { name: "Import / Export", risk: "High" },
  { name: "Logistics", risk: "Medium" },
  { name: "Construction", risk: "Medium" },
  { name: "Manufacturing", risk: "Medium" },
  { name: "E-commerce (physical goods)", risk: "Low" },
  { name: "E-commerce (food supplements & cosmetics)", risk: "High" },
  { name: "E-commerce (digital goods)", risk: "Medium" },
  { name: "E-commerce (digital subscription)", risk: "High" },
  { name: "In-Game Items (video games)", risk: "Medium" },
  { name: "Video Game Publishers", risk: "Medium" },
  { name: "Gift & Activation Cards", risk: "High" },
  { name: "Marketplace (physical goods)", risk: "Medium" },
  { name: "Marketplace (digital goods)", risk: "Medium" },
  { name: "Marketing", risk: "Medium" },
  { name: "Affiliate Marketing", risk: "High" },
  { name: "eSports", risk: "Medium" },
  { name: "Legal & Consulting Services", risk: "High" },
  { name: "Professional Services", risk: "High" },
  { name: "Payment Gateways (ISO)", risk: "High" },
  { name: "Forex (regulated EEA/UK)", risk: "High" },
  { name: "Forex (regulated outside EEA)", risk: "High" },
  { name: "Crypto & Blockchain (regulated)", risk: "High" },
  { name: "Crypto & Blockchain (unregulated)", risk: "High" },
  { name: "iGaming (regulated)", risk: "High" },
  { name: "iGaming (unregulated)", risk: "High" },
  { name: "Skill Games", risk: "High" },
  { name: "Games of Chance", risk: "High" },
  { name: "Financial Services", risk: "High" },
  { name: "Payment Services Providers", risk: "High" },
  { name: "Holding Companies", risk: "High" },
  { name: "Online Dating", risk: "High" },
  { name: "Affiliate Program Partner", risk: "Medium" },
];

const INDUSTRY_RISK: Record<string, "Low" | "Medium" | "High"> = Object.fromEntries(INDUSTRY_LIST.map(i => [i.name, i.risk]));

const PRODUCT_RISK: Record<string, "Low" | "Medium" | "High"> = {
  "Payment Services": "Low",
  "Merchant Services / vIBAN / Mass Payments": "Medium",
  "Acquiring Solutions": "High",
};

// ─── RISK ENGINE ──────────────────────────────────────────────────────────────
function levelFromScore(s: number): "Low" | "Medium" | "High" {
  return s < 34 ? "Low" : s < 67 ? "Medium" : "High";
}

function countryRiskLevel(c: string): "Low" | "Medium" | "High" {
  const r = getCountryRisk(c);
  return r === "Prohibited" ? "High" : r;
}

const RV: Record<"Low" | "Medium" | "High", number> = { Low: 0, Medium: 50, High: 100 };

function computeRisk(f: RiskFactors): RiskResult {
  const breakdown: RiskBreakdown[] = [];
  const triggers: string[] = [];
  let hasHighTrigger = false;

  if (f.pepStatus) { triggers.push("PEP Status → overall risk automatically High"); hasHighTrigger = true; }
  if (f.amlRegulated) { triggers.push("AML-regulated activity → overall risk automatically High"); hasHighTrigger = true; }

  const ci = countryRiskLevel(f.countryOfIncorporation);
  breakdown.push({ factor: "ci", label: "Country of Incorporation", value: f.countryOfIncorporation || "—", risk: ci, weight: 10, contribution: RV[ci] * 0.10, isTrigger: false });

  const age: "Low" | "Medium" | "High" = f.companyAgeYears >= 3 ? "Low" : f.companyAgeYears >= 1 ? "Medium" : "High";
  breakdown.push({ factor: "age", label: "Company Age", value: `${f.companyAgeYears} yr`, risk: age, weight: 7, contribution: RV[age] * 0.07, isTrigger: false });

  const own: "Low" | "Medium" | "High" = (f.nomineeOwnership || f.trustOrLP) ? "High" : f.ownershipRecords < 3 ? "Low" : f.ownershipRecords === 3 ? "Medium" : "High";
  if ((f.nomineeOwnership || f.trustOrLP)) triggers.push("Nominee / Trust / LP → ownership forced High");
  breakdown.push({ factor: "own", label: "Ownership Structure", value: `${f.ownershipRecords} records${f.nomineeOwnership ? " + nominee" : f.trustOrLP ? " + trust/LP" : ""}`, risk: own, weight: 8, contribution: RV[own] * 0.08, isTrigger: false });

  const ubo = countryRiskLevel(f.uboResidenceCountry);
  breakdown.push({ factor: "ubo", label: "UBO Residence", value: f.uboResidenceCountry || "—", risk: ubo, weight: 5, contribution: RV[ubo] * 0.05, isTrigger: false });

  const dir = countryRiskLevel(f.directorResidenceCountry);
  breakdown.push({ factor: "dir", label: "Director Residence", value: f.directorResidenceCountry || "—", risk: dir, weight: 5, contribution: RV[dir] * 0.05, isTrigger: false });

  const ind: "Low" | "Medium" | "High" = INDUSTRY_RISK[f.industry] ?? "Medium";
  breakdown.push({ factor: "ind", label: "Industry / MCC", value: f.industry || "—", risk: ind, weight: 20, contribution: RV[ind] * 0.20, isTrigger: false });

  breakdown.push({ factor: "aml", label: "AML Regulated", value: f.amlRegulated ? "Yes" : "No", risk: f.amlRegulated ? "High" : "Low", weight: null, contribution: 0, isTrigger: true, triggered: f.amlRegulated });

  const prod: "Low" | "Medium" | "High" = PRODUCT_RISK[f.product] ?? "Medium";
  breakdown.push({ factor: "prod", label: "Product Needed", value: f.product || "—", risk: prod, weight: 15, contribution: RV[prod] * 0.15, isTrigger: false });

  const geo: "Low" | "Medium" | "High" = f.geographyZone === "EEA" ? "Low" : f.geographyZone === "UK_GIB" ? "Medium" : "High";
  breakdown.push({ factor: "geo", label: "Geography of Operations", value: f.geographyZone === "EEA" ? "EEA" : f.geographyZone === "UK_GIB" ? "UK & Gibraltar" : "Rest of World", risk: geo, weight: 7, contribution: RV[geo] * 0.07, isTrigger: false });

  const eur = f.estimatedTurnoverEUR;
  const trn: "Low" | "Medium" | "High" = eur < 1_000_000 ? "Low" : eur < 1_500_000 ? "Medium" : "High";
  breakdown.push({ factor: "trn", label: "Estimated Turnover", value: eur >= 1_000_000 ? `€${(eur/1_000_000).toFixed(1)}M` : `€${(eur/1000).toFixed(0)}K`, risk: trn, weight: 8, contribution: RV[trn] * 0.08, isTrigger: false });

  breakdown.push({ factor: "nom", label: "Nominee Ownership", value: f.nomineeOwnership ? "Yes" : "No", risk: f.nomineeOwnership ? "High" : "Low", weight: null, contribution: 0, isTrigger: true, triggered: f.nomineeOwnership });
  breakdown.push({ factor: "pep", label: "PEP Status", value: f.pepStatus ? "Yes" : "No", risk: f.pepStatus ? "High" : "Low", weight: null, contribution: 0, isTrigger: true, triggered: f.pepStatus });

  const totalContrib = breakdown.filter(b => !b.isTrigger).reduce((s, b) => s + b.contribution, 0);
  const score = Math.round(totalContrib / 85 * 100);
  const level = hasHighTrigger ? "High" : levelFromScore(score);
  const reverificationYears = level === "Low" ? 3 : level === "Medium" ? 2 : 1;

  return { score, level, reverificationYears, breakdown, triggers };
}

function addYears(dateStr: string, years: number): string {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

// ─── INITIAL MOCK DATA ────────────────────────────────────────────────────────
function makeMockClients(): KybClient[] {
  const mkFactors = (f: Partial<RiskFactors>): RiskFactors => ({
    countryOfIncorporation: "United Kingdom", companyAgeYears: 5, ownershipRecords: 2,
    nomineeOwnership: false, trustOrLP: false, uboResidenceCountry: "United Kingdom",
    directorResidenceCountry: "United Kingdom", industry: "IT / Software Development",
    amlRegulated: false, product: "Payment Services", geographyZone: "EEA",
    estimatedTurnoverEUR: 500_000, pepStatus: false, ...f,
  });

  const mkClient = (base: Partial<KybClient> & { riskFactors: RiskFactors }): KybClient => {
    const r = computeRisk(base.riskFactors);
    const lastTouch = base.lastTouchDate || "2025-01-15";
    return {
      id: Math.random().toString(36).slice(2), ct: "BA", connection: "Customer",
      date: lastTouch, verificationNote: "", reverificationRequestSent: false,
      midNew: "", regulated: "", license: "", licenseExpiry: "", activityDescription: "",
      poiCountry: "", poiExpiry: "", porCountry: "", website: "", sumsubMonitoring: false,
      jiraTask: "", redFlags: "", auditLog: [],
      riskScore: r.score, riskLevel: r.level,
      reverificationDate: addYears(lastTouch, r.reverificationYears),
      ...base,
    } as KybClient;
  };

  return [
    mkClient({
      customerId: "TF-2024-001", companyName: "Techflow Solutions Ltd",
      entity: "UK", responsible: "Alice Johnson", salesKam: "Bob Smith",
      status: "Approved", lastTouchDate: "2025-03-15",
      website: "techflow.io", license: "FCA#123456",
      activityDescription: "B2B SaaS platform for financial analytics",
      riskFactors: mkFactors({ industry: "IT / Software Development", product: "Payment Services", estimatedTurnoverEUR: 800_000 }),
    }),
    mkClient({
      customerId: "GP-2024-002", companyName: "GlobalPay Malta Ltd",
      entity: "Malta", responsible: "Carol Davis", salesKam: "David Lee",
      status: "In Progress", lastTouchDate: "2025-05-01",
      activityDescription: "Payment gateway ISO operating across EU",
      redFlags: "Multiple director jurisdictions; high velocity transactions",
      jiraTask: "KYB-2024-892", sumsubMonitoring: true,
      riskFactors: mkFactors({
        countryOfIncorporation: "Malta", companyAgeYears: 2, ownershipRecords: 4,
        uboResidenceCountry: "UAE", directorResidenceCountry: "Malta",
        industry: "Payment Gateways (ISO)", product: "Acquiring Solutions",
        geographyZone: "EEA", estimatedTurnoverEUR: 2_200_000,
      }),
    }),
    mkClient({
      customerId: "EG-2024-003", companyName: "EuroGames GE Ltd",
      entity: "Gibraltar", responsible: "Eve Martinez", salesKam: "Frank Wilson",
      status: "On Hold", lastTouchDate: "2025-04-10",
      license: "GGA#2024-0045", licenseExpiry: "2026-12-31",
      activityDescription: "Online casino operator with MGA and GGA licenses",
      regulated: "Yes – MGA Malta", verificationNote: "Awaiting updated UBO declaration",
      riskFactors: mkFactors({
        countryOfIncorporation: "Gibraltar", companyAgeYears: 4, ownershipRecords: 3,
        uboResidenceCountry: "Israel", directorResidenceCountry: "United Kingdom",
        industry: "iGaming (regulated)", product: "Merchant Services / vIBAN / Mass Payments",
        geographyZone: "UK_GIB", estimatedTurnoverEUR: 1_700_000,
      }),
    }),
    mkClient({
      customerId: "TC-2024-004", companyName: "TradeConnect AG",
      entity: "Switzerland", responsible: "Grace Lee", salesKam: "Henry Brown",
      status: "Requested", lastTouchDate: "2025-05-20",
      activityDescription: "International commodity trading and logistics",
      porCountry: "Switzerland", poiCountry: "Kazakhstan",
      redFlags: "Operations in high-risk jurisdictions; nominee shareholder detected",
      riskFactors: mkFactors({
        countryOfIncorporation: "Switzerland", companyAgeYears: 1, ownershipRecords: 5,
        nomineeOwnership: true, uboResidenceCountry: "Kazakhstan",
        directorResidenceCountry: "Switzerland", industry: "Import / Export",
        product: "Merchant Services / vIBAN / Mass Payments", geographyZone: "REST",
        estimatedTurnoverEUR: 1_800_000,
      }),
    }),
    mkClient({
      customerId: "RN-2024-005", companyName: "RetailNow GmbH",
      entity: "Germany", responsible: "Alice Johnson", salesKam: "Bob Smith",
      status: "Approved", lastTouchDate: "2024-11-01",
      activityDescription: "E-commerce retailer, household goods",
      website: "retailnow.de",
      riskFactors: mkFactors({
        countryOfIncorporation: "Germany", companyAgeYears: 7, ownershipRecords: 2,
        uboResidenceCountry: "Germany", directorResidenceCountry: "Germany",
        industry: "E-commerce (physical goods)", product: "Payment Services",
        geographyZone: "EEA", estimatedTurnoverEUR: 600_000,
      }),
    }),
    mkClient({
      customerId: "CE-2024-006", companyName: "CryptoEx Estonia OÜ",
      entity: "Estonia", responsible: "Carol Davis", salesKam: "David Lee",
      status: "In Progress", lastTouchDate: "2025-06-01",
      regulated: "Yes – FIU Estonia VASP license",
      license: "FIU-VASP-2023-0112", licenseExpiry: "2025-12-31",
      activityDescription: "Crypto asset exchange and custody regulated by Estonian FIU",
      sumsubMonitoring: true, jiraTask: "KYB-2024-910",
      riskFactors: mkFactors({
        countryOfIncorporation: "Estonia", companyAgeYears: 2, ownershipRecords: 3,
        uboResidenceCountry: "Estonia", directorResidenceCountry: "Estonia",
        industry: "Crypto & Blockchain (regulated)", amlRegulated: true,
        product: "Payment Services", geographyZone: "EEA", estimatedTurnoverEUR: 900_000,
      }),
    }),
  ];
}

const STATUSES = ["All","Approved","In Progress","On Hold","Requested","Rejected","Account Closed"];

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

// ─── RISK BADGE ───────────────────────────────────────────────────────────────
function RiskBadge({ level }: { level: string }) {
  const cls = level === "Low" ? "bg-green-500/10 text-green-400 border-green-500/30"
    : level === "Medium" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
    : level === "High" ? "bg-red-500/10 text-red-400 border-red-500/30"
    : "bg-purple-500/10 text-purple-400 border-purple-500/30";
  return <Badge className={`text-[10px] border ${cls}`}>{level}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === "Approved" ? "bg-green-500/10 text-green-400 border-green-500/30"
    : status === "Rejected" ? "bg-red-500/10 text-red-400 border-red-500/30"
    : status === "On Hold" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
    : "bg-zinc-500/10 text-zinc-400 border-zinc-700";
  return <Badge className={`text-[10px] border ${cls}`}>{status}</Badge>;
}

// ─── RISK BAR ────────────────────────────────────────────────────────────────
function RiskBar({ pct, risk }: { pct: number; risk: "Low" | "Medium" | "High" }) {
  const color = risk === "Low" ? "bg-green-500" : risk === "Medium" ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex-1 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

// ─── RISK CALCULATOR ─────────────────────────────────────────────────────────
function RiskCalculatorPanel() {
  const defaultFactors: RiskFactors = {
    countryOfIncorporation: "Germany", companyAgeYears: 3, ownershipRecords: 2,
    nomineeOwnership: false, trustOrLP: false, uboResidenceCountry: "Germany",
    directorResidenceCountry: "Germany", industry: "IT / Software Development",
    amlRegulated: false, product: "Payment Services", geographyZone: "EEA",
    estimatedTurnoverEUR: 500_000, pepStatus: false,
  };
  const [f, setF] = useState<RiskFactors>(defaultFactors);
  const result = useMemo(() => computeRisk(f), [f]);

  const set = (key: keyof RiskFactors, val: any) => setF(p => ({ ...p, [key]: val }));

  return (
    <div className="max-w-4xl mx-auto p-6 grid lg:grid-cols-2 gap-6">
      {/* Inputs */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-white">Risk Factor Inputs</h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3 text-xs">
          <p className="text-zinc-500 font-medium uppercase tracking-wide text-[10px]">Weighted Factors</p>
          {[
            ["Country of Incorporation (10%)", "countryOfIncorporation"],
            ["UBO Residence Country (5%)", "uboResidenceCountry"],
            ["Director Residence Country (5%)", "directorResidenceCountry"],
          ].map(([label, key]) => (
            <div key={key}>
              <label className="text-zinc-400 block mb-1">{label}</label>
              <select value={f[key as keyof RiskFactors] as string} onChange={e => set(key as keyof RiskFactors, e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded text-white text-xs px-2 py-1.5 cursor-pointer">
                {COUNTRY_LIST.filter(c => c.risk !== "Prohibited").map(c => <option key={c.name} value={c.name}>{c.name} ({c.risk})</option>)}
              </select>
            </div>
          ))}
          <div>
            <label className="text-zinc-400 block mb-1">Company Age (years) (7%)</label>
            <input type="number" min={0} max={50} value={f.companyAgeYears} onChange={e => set("companyAgeYears", +e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded text-white text-xs px-2 py-1.5" />
          </div>
          <div>
            <label className="text-zinc-400 block mb-1">Ownership Records count (8%)</label>
            <input type="number" min={1} max={20} value={f.ownershipRecords} onChange={e => set("ownershipRecords", +e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded text-white text-xs px-2 py-1.5" />
          </div>
          <div>
            <label className="text-zinc-400 block mb-1">Industry / MCC (20%)</label>
            <select value={f.industry} onChange={e => set("industry", e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded text-white text-xs px-2 py-1.5 cursor-pointer">
              {INDUSTRY_LIST.map(i => <option key={i.name} value={i.name}>{i.name} ({i.risk})</option>)}
            </select>
          </div>
          <div>
            <label className="text-zinc-400 block mb-1">Product Needed (15%)</label>
            <select value={f.product} onChange={e => set("product", e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded text-white text-xs px-2 py-1.5 cursor-pointer">
              {Object.entries(PRODUCT_RISK).map(([p, r]) => <option key={p} value={p}>{p} ({r})</option>)}
            </select>
          </div>
          <div>
            <label className="text-zinc-400 block mb-1">Geography of Operations (7%)</label>
            <select value={f.geographyZone} onChange={e => set("geographyZone", e.target.value as any)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded text-white text-xs px-2 py-1.5 cursor-pointer">
              <option value="EEA">EEA (Low)</option>
              <option value="UK_GIB">UK & Gibraltar (Medium)</option>
              <option value="REST">Rest of World (High)</option>
            </select>
          </div>
          <div>
            <label className="text-zinc-400 block mb-1">Estimated Turnover EUR (8%)</label>
            <input type="number" min={0} step={50000} value={f.estimatedTurnoverEUR} onChange={e => set("estimatedTurnoverEUR", +e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded text-white text-xs px-2 py-1.5" />
          </div>
          <p className="text-zinc-500 font-medium uppercase tracking-wide text-[10px] pt-2">Triggers (automatic High)</p>
          {([["nomineeOwnership","Nominee Ownership"],["trustOrLP","Trust / LP / LLP"],["amlRegulated","AML Regulated Activity"],["pepStatus","PEP Status"]] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer text-zinc-300">
              <input type="checkbox" checked={f[key] as boolean} onChange={e => set(key, e.target.checked)} className="accent-indigo-500" />
              {label}
            </label>
          ))}
        </div>
      </div>
      {/* Results */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-white">Risk Score Output</h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-xs">Weighted Score</span>
            <span className="text-2xl font-black text-white">{result.score}<span className="text-xs text-zinc-500">/100</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-zinc-800 rounded-full h-3 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${result.level === "Low" ? "bg-green-500" : result.level === "Medium" ? "bg-yellow-500" : "bg-red-500"}`}
                style={{ width: `${result.score}%` }} />
            </div>
            <RiskBadge level={result.level} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-zinc-800 rounded-lg p-2">
              <p className="text-zinc-500 text-[10px]">Risk Level</p>
              <p className={`font-bold text-sm ${result.level === "Low" ? "text-green-400" : result.level === "Medium" ? "text-yellow-400" : "text-red-400"}`}>{result.level}</p>
            </div>
            <div className="bg-zinc-800 rounded-lg p-2">
              <p className="text-zinc-500 text-[10px]">Reverification</p>
              <p className="font-bold text-sm text-white">{result.reverificationYears}yr</p>
            </div>
            <div className="bg-zinc-800 rounded-lg p-2">
              <p className="text-zinc-500 text-[10px]">Due by</p>
              <p className="font-bold text-sm text-white">{addYears(new Date().toISOString().slice(0,10), result.reverificationYears)}</p>
            </div>
          </div>
          {result.triggers.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-1">
              <p className="text-red-400 text-xs font-semibold">High Risk Triggers Activated</p>
              {result.triggers.map((t, i) => <p key={i} className="text-red-300 text-xs">• {t}</p>)}
            </div>
          )}
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
          <p className="text-zinc-400 text-xs font-semibold mb-3">Factor Breakdown</p>
          {result.breakdown.map(b => (
            <div key={b.factor} className="space-y-0.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">{b.label}</span>
                <div className="flex items-center gap-1.5">
                  {b.isTrigger ? (
                    b.triggered ? <span className="text-red-400 font-bold">TRIGGERED</span> : <span className="text-zinc-600">—</span>
                  ) : (
                    <>
                      <span className={b.risk === "Low" ? "text-green-400" : b.risk === "Medium" ? "text-yellow-400" : "text-red-400"}>{b.risk}</span>
                      <span className="text-zinc-600">({b.weight}%)</span>
                    </>
                  )}
                </div>
              </div>
              {!b.isTrigger && <RiskBar pct={(b.contribution / (b.weight || 1)) * 1} risk={b.risk} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── COUNTRY RISK TABLE ───────────────────────────────────────────────────────
function CountryRiskPanel() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("All");
  const filtered = useMemo(() =>
    COUNTRY_LIST.filter(c =>
      (filter === "All" || c.risk === filter) &&
      c.name.toLowerCase().includes(search.toLowerCase())
    ), [search, filter]);

  const counts = useMemo(() => ({
    Low: COUNTRY_LIST.filter(c => c.risk === "Low").length,
    Medium: COUNTRY_LIST.filter(c => c.risk === "Medium").length,
    High: COUNTRY_LIST.filter(c => c.risk === "High").length,
    Prohibited: COUNTRY_LIST.filter(c => c.risk === "Prohibited").length,
  }), []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {(["Low","Medium","High","Prohibited"] as const).map(r => (
          <button key={r} onClick={() => setFilter(filter === r ? "All" : r)}
            className={`rounded-xl border p-3 text-center cursor-pointer transition-all ${filter === r ? "border-indigo-500 bg-indigo-500/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"}`}>
            <p className={`text-lg font-black ${r === "Low" ? "text-green-400" : r === "Medium" ? "text-yellow-400" : r === "High" ? "text-red-400" : "text-purple-400"}`}>{counts[r]}</p>
            <p className="text-zinc-500 text-[10px]">{r}</p>
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500"/><Input placeholder="Search country…" value={search} onChange={e => setSearch(e.target.value)} className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 pl-8"/></div>
      </div>
      <div className="border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-zinc-900 border-b border-zinc-800">
            <tr><th className="text-left px-4 py-2.5 text-zinc-500 font-medium">Country</th><th className="text-left px-4 py-2.5 text-zinc-500 font-medium">Risk Level</th><th className="text-left px-4 py-2.5 text-zinc-500 font-medium">KYB Policy</th></tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.name} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                <td className="px-4 py-2.5 text-white">{c.name}</td>
                <td className="px-4 py-2.5"><RiskBadge level={c.risk} /></td>
                <td className="px-4 py-2.5 text-zinc-500">
                  {c.risk === "Prohibited" ? "Business not permitted" : c.risk === "High" ? "Enhanced due diligence required" : c.risk === "Medium" ? "Standard due diligence" : "Simplified due diligence"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="p-8 text-center text-zinc-500 text-sm">No countries match filter</div>}
      </div>
    </div>
  );
}

// ─── CLIENT DETAIL PANEL ─────────────────────────────────────────────────────
function ClientDetailPanel({ client, onClose, onSave, currentUser }: {
  client: KybClient; onClose: () => void;
  onSave: (id: string, newFactors: RiskFactors, auditEntry: AuditEntry) => void;
  currentUser: string;
}) {
  const [tab, setTab] = useState<"overview" | "risk" | "audit">("overview");
  const [editing, setEditing] = useState(false);
  const [editF, setEditF] = useState<RiskFactors>(client.riskFactors);
  const [reason, setReason] = useState("");

  const result = useMemo(() => computeRisk(editing ? editF : client.riskFactors), [editing, editF, client.riskFactors]);
  const prevResult = useMemo(() => computeRisk(client.riskFactors), [client.riskFactors]);

  const setEF = (k: keyof RiskFactors, v: any) => setEditF(p => ({ ...p, [k]: v }));

  function handleSave() {
    if (!reason.trim()) { alert("Please provide a reason for the change."); return; }
    const entry: AuditEntry = {
      id: Math.random().toString(36).slice(2),
      timestamp: new Date().toISOString(),
      user: currentUser,
      clientId: client.id,
      clientName: client.companyName,
      factor: "Risk Factors Updated",
      oldValue: `${client.riskLevel} (${client.riskScore})`,
      newValue: `${result.level} (${result.score})`,
      reason: reason.trim(),
    };
    onSave(client.id, editF, entry);
    setEditing(false);
    setReason("");
  }

  const daysUntilRev = Math.round((new Date(client.reverificationDate).getTime() - Date.now()) / 86400_000);
  const isUrgent = daysUntilRev < 90;

  return (
    <div className="h-full flex flex-col">
      <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">{client.companyName}</p>
            <p className="text-zinc-500 text-[10px] font-mono">{client.customerId}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex gap-0 border-b border-zinc-800 px-4">
        {(["overview","risk","audit"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-xs capitalize border-b-2 -mb-px cursor-pointer transition-colors ${tab === t ? "border-indigo-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
            {t === "overview" ? "Overview" : t === "risk" ? "Risk Score" : "Audit Trail"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-4">
        {tab === "overview" && (
          <>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={client.status} />
              <RiskBadge level={client.riskLevel} />
              {client.jiraTask && <Badge className="text-[10px] border border-zinc-700 text-zinc-400">{client.jiraTask}</Badge>}
            </div>
            {isUrgent && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
                <p className="text-orange-300 text-xs">Re-verification due in <strong>{daysUntilRev} days</strong> ({client.reverificationDate})</p>
              </div>
            )}
            {client.redFlags && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-400 text-xs font-semibold mb-1">Red Flags</p>
                <p className="text-red-300 text-xs">{client.redFlags}</p>
              </div>
            )}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800/50">
              {([
                ["Customer ID", client.customerId],
                ["CT", client.ct],
                ["Entity", client.entity],
                ["Responsible", client.responsible],
                ["Sales / KAM", client.salesKam],
                ["Last Touch Date", client.lastTouchDate],
                ["Reverification Date", client.reverificationDate],
                ["Scheduled Reverification", `${client.riskLevel === "Low" ? "3yr" : client.riskLevel === "Medium" ? "2yr" : "1yr"} cycle`],
                ["License", client.license || "—"],
                ["License Expiry", client.licenseExpiry || "—"],
                ["Regulated", client.regulated || "—"],
                ["POI Country", client.poiCountry || "—"],
                ["POI Expiry", client.poiExpiry || "—"],
                ["POR Country", client.porCountry || "—"],
                ["Website", client.website || "—"],
                ["SumSub Monitoring", client.sumsubMonitoring ? "Enabled" : "Disabled"],
                ["Activity", client.activityDescription || "—"],
              ] as [string, string][]).map(([l, v]) => (
                <div key={l} className="flex items-center justify-between px-3 py-1.5 gap-2">
                  <span className="text-zinc-500 text-xs">{l}</span>
                  <span className="text-zinc-300 text-xs text-right max-w-[60%] truncate">{v}</span>
                </div>
              ))}
            </div>
            {client.verificationNote && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <p className="text-zinc-500 text-[10px] mb-1">Verification Note</p>
                <p className="text-zinc-300 text-xs">{client.verificationNote}</p>
              </div>
            )}
          </>
        )}

        {tab === "risk" && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-white text-lg font-black">{result.score}<span className="text-zinc-500 text-xs">/100</span></span>
                <RiskBadge level={result.level} />
                {editing && prevResult.level !== result.level && (
                  <span className={`text-xs ${result.level === "High" ? "text-red-400" : result.level === "Medium" ? "text-yellow-400" : "text-green-400"}`}>
                    ← was {prevResult.level}
                  </span>
                )}
              </div>
              {!editing
                ? <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-xs border border-indigo-500/30 rounded px-2 py-1 cursor-pointer"><Edit2 className="w-3 h-3"/>Edit Factors</button>
                : (
                  <div className="flex gap-2">
                    <button onClick={() => { setEditing(false); setEditF(client.riskFactors); setReason(""); }} className="text-zinc-400 hover:text-white text-xs border border-zinc-700 rounded px-2 py-1 cursor-pointer">Cancel</button>
                    <button onClick={handleSave} className="flex items-center gap-1 text-white bg-indigo-600 hover:bg-indigo-500 text-xs rounded px-2 py-1 cursor-pointer"><Save className="w-3 h-3"/>Save</button>
                  </div>
                )
              }
            </div>

            {editing && result.level === "High" && prevResult.level !== "High" && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-red-300 text-xs">Risk would escalate to <strong>High</strong>. Re-verification period reduced to 1 year. Review and confirm.</p>
              </div>
            )}

            {result.triggers.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-1">
                {result.triggers.map((t, i) => <p key={i} className="text-red-300 text-xs">⚡ {t}</p>)}
              </div>
            )}

            <div className="space-y-2">
              {result.breakdown.map(b => {
                const activeF = editing ? editF : client.riskFactors;
                return (
                  <div key={b.factor} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">{b.label}{b.weight ? ` (${b.weight}%)` : ""}</span>
                      {b.isTrigger
                        ? b.triggered ? <span className="text-red-400 font-bold">⚡ TRIGGERED</span> : <span className="text-zinc-600 text-[10px]">trigger</span>
                        : <RiskBadge level={b.risk} />
                      }
                    </div>
                    {!b.isTrigger && <RiskBar pct={(b.contribution / ((b.weight || 1) / 100 * 100)) * 1} risk={b.risk} />}
                    <p className="text-zinc-500 text-[10px]">{b.value}</p>

                    {editing && (
                      <div className="pt-1 border-t border-zinc-800">
                        {(b.factor === "ci") && (
                          <select value={activeF.countryOfIncorporation} onChange={e => setEF("countryOfIncorporation", e.target.value)}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded text-white text-xs px-2 py-1 cursor-pointer">
                            {COUNTRY_LIST.filter(c => c.risk !== "Prohibited").map(c => <option key={c.name} value={c.name}>{c.name} ({c.risk})</option>)}
                          </select>
                        )}
                        {(b.factor === "age") && (
                          <input type="number" min={0} value={activeF.companyAgeYears} onChange={e => setEF("companyAgeYears", +e.target.value)}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded text-white text-xs px-2 py-1" />
                        )}
                        {(b.factor === "own") && (
                          <div className="space-y-1">
                            <input type="number" min={1} value={activeF.ownershipRecords} onChange={e => setEF("ownershipRecords", +e.target.value)}
                              className="w-full bg-zinc-800 border border-zinc-700 rounded text-white text-xs px-2 py-1" placeholder="Records count" />
                          </div>
                        )}
                        {(b.factor === "ubo") && (
                          <select value={activeF.uboResidenceCountry} onChange={e => setEF("uboResidenceCountry", e.target.value)}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded text-white text-xs px-2 py-1 cursor-pointer">
                            {COUNTRY_LIST.filter(c => c.risk !== "Prohibited").map(c => <option key={c.name} value={c.name}>{c.name} ({c.risk})</option>)}
                          </select>
                        )}
                        {(b.factor === "dir") && (
                          <select value={activeF.directorResidenceCountry} onChange={e => setEF("directorResidenceCountry", e.target.value)}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded text-white text-xs px-2 py-1 cursor-pointer">
                            {COUNTRY_LIST.filter(c => c.risk !== "Prohibited").map(c => <option key={c.name} value={c.name}>{c.name} ({c.risk})</option>)}
                          </select>
                        )}
                        {(b.factor === "ind") && (
                          <select value={activeF.industry} onChange={e => setEF("industry", e.target.value)}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded text-white text-xs px-2 py-1 cursor-pointer">
                            {INDUSTRY_LIST.map(i => <option key={i.name} value={i.name}>{i.name} ({i.risk})</option>)}
                          </select>
                        )}
                        {(b.factor === "prod") && (
                          <select value={activeF.product} onChange={e => setEF("product", e.target.value)}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded text-white text-xs px-2 py-1 cursor-pointer">
                            {Object.entries(PRODUCT_RISK).map(([p, r]) => <option key={p} value={p}>{p} ({r})</option>)}
                          </select>
                        )}
                        {(b.factor === "geo") && (
                          <select value={activeF.geographyZone} onChange={e => setEF("geographyZone", e.target.value as any)}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded text-white text-xs px-2 py-1 cursor-pointer">
                            <option value="EEA">EEA (Low)</option>
                            <option value="UK_GIB">UK & Gibraltar (Medium)</option>
                            <option value="REST">Rest of World (High)</option>
                          </select>
                        )}
                        {(b.factor === "trn") && (
                          <input type="number" min={0} step={100000} value={activeF.estimatedTurnoverEUR} onChange={e => setEF("estimatedTurnoverEUR", +e.target.value)}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded text-white text-xs px-2 py-1" />
                        )}
                        {(b.factor === "aml") && (
                          <label className="flex items-center gap-2 cursor-pointer text-zinc-300 text-xs">
                            <input type="checkbox" checked={activeF.amlRegulated} onChange={e => setEF("amlRegulated", e.target.checked)} className="accent-indigo-500" />AML Regulated
                          </label>
                        )}
                        {(b.factor === "nom") && (
                          <label className="flex items-center gap-2 cursor-pointer text-zinc-300 text-xs">
                            <input type="checkbox" checked={activeF.nomineeOwnership} onChange={e => setEF("nomineeOwnership", e.target.checked)} className="accent-indigo-500" />Nominee Ownership
                          </label>
                        )}
                        {(b.factor === "pep") && (
                          <label className="flex items-center gap-2 cursor-pointer text-zinc-300 text-xs">
                            <input type="checkbox" checked={activeF.pepStatus} onChange={e => setEF("pepStatus", e.target.checked)} className="accent-indigo-500" />PEP Status
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {editing && (
              <div className="space-y-2">
                <label className="text-zinc-400 text-xs block">Reason for change <span className="text-red-400">*</span></label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Describe why this factor changed…"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg text-white text-xs px-3 py-2 resize-none focus:outline-none focus:border-indigo-500" />
              </div>
            )}

            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <p className="text-zinc-500 text-[10px] mb-2">Re-verification Schedule</p>
              <div className="flex items-center justify-between">
                <span className="text-zinc-300 text-xs">{result.level} → every {result.reverificationYears} year{result.reverificationYears > 1 ? "s" : ""}</span>
                <span className="text-zinc-400 text-xs">Due: <span className={isUrgent ? "text-orange-400" : "text-white"}>{client.reverificationDate}</span></span>
              </div>
            </div>
          </>
        )}

        {tab === "audit" && (
          <div className="space-y-2">
            {client.auditLog.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-sm">No audit entries yet</div>
            ) : (
              client.auditLog.slice().reverse().map(e => (
                <div key={e.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-xs font-medium">{e.factor}</span>
                    <span className="text-zinc-500 text-[10px]">{new Date(e.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-zinc-500 text-[10px]">by <span className="text-zinc-300">{e.user}</span></p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-zinc-500 font-mono">{e.oldValue}</span>
                    <span className="text-zinc-600">→</span>
                    <span className="text-indigo-300 font-mono">{e.newValue}</span>
                  </div>
                  <p className="text-zinc-400 text-xs italic">"{e.reason}"</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
const STORAGE_KEY = "kyb_clients_v2";

export default function KybPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<"clients" | "calculator" | "countries" | "audit">("clients");
  const [clients, setClients] = useState<KybClient[]>([]);
  const [selected, setSelected] = useState<KybClient | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterRisk, setFilterRisk] = useState("All");
  const [globalAudit, setGlobalAudit] = useState<AuditEntry[]>([]);

  useEffect(() => {
    fetch("/api/auth/me").then(async r => {
      if (r.status === 401) { router.push("/login"); return; }
      const d = await r.json(); setUser(d.user);
    });
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setClients(parsed.clients || []);
        setGlobalAudit(parsed.globalAudit || []);
      } else {
        const initial = makeMockClients();
        setClients(initial);
        persist(initial, []);
      }
    } catch {
      const initial = makeMockClients();
      setClients(initial);
    }
  }, []);

  function persist(cls: KybClient[], ga: AuditEntry[]) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ clients: cls, globalAudit: ga })); } catch {}
  }

  function handleSave(id: string, newFactors: RiskFactors, entry: AuditEntry) {
    const r = computeRisk(newFactors);
    const updated = clients.map(c => c.id !== id ? c : {
      ...c, riskFactors: newFactors, riskScore: r.score, riskLevel: r.level,
      reverificationDate: addYears(c.lastTouchDate, r.reverificationYears),
      auditLog: [...c.auditLog, entry],
    });
    const newGa = [...globalAudit, entry];
    setClients(updated);
    setGlobalAudit(newGa);
    persist(updated, newGa);
    setSelected(updated.find(c => c.id === id) || null);
  }

  const filtered = useMemo(() => clients.filter(c =>
    (filterStatus === "All" || c.status === filterStatus) &&
    (filterRisk === "All" || c.riskLevel === filterRisk) &&
    (c.companyName.toLowerCase().includes(search.toLowerCase()) || c.customerId.toLowerCase().includes(search.toLowerCase()))
  ), [clients, filterStatus, filterRisk, search]);

  const alertClients = clients.filter(c => {
    const days = (new Date(c.reverificationDate).getTime() - Date.now()) / 86400_000;
    return days < 90;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <DashNav user={user} />

      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4 flex items-center gap-4">
        <Building2 className="w-5 h-5 text-indigo-400" />
        <div>
          <h1 className="text-base font-bold text-white">KYB — Know Your Business</h1>
          <p className="text-zinc-500 text-xs">Client due diligence, 12-factor risk scoring, re-verification scheduling</p>
        </div>
        {alertClients.length > 0 && (
          <div className="ml-auto flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-lg px-3 py-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-orange-300 text-xs">{alertClients.length} reverification{alertClients.length > 1 ? "s" : ""} due within 90 days</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-800 px-6 flex gap-1">
        {([["clients","Clients"],["calculator","Risk Calculator"],["countries","Country Risk"],["audit","Audit Log"]] as const).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2.5 text-xs border-b-2 -mb-px cursor-pointer transition-colors ${tab === t ? "border-indigo-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>{l}</button>
        ))}
      </div>

      {/* Content */}
      {tab === "clients" && (
        <div className="flex h-[calc(100vh-140px)]">
          {/* List */}
          <div className={`flex-1 flex flex-col overflow-hidden ${selected ? "lg:max-w-[55%]" : ""}`}>
            <div className="px-6 py-3 border-b border-zinc-800 flex flex-wrap gap-2 items-center">
              <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500"/><Input placeholder="Search company or ID…" value={search} onChange={e => setSearch(e.target.value)} className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 pl-8 w-48"/></div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded text-white text-xs px-2 py-1 h-8 cursor-pointer">
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
              <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded text-white text-xs px-2 py-1 h-8 cursor-pointer">
                {["All","Low","Medium","High"].map(r => <option key={r}>{r}</option>)}
              </select>
              <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs ml-auto">{filtered.length} clients</Badge>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-zinc-950 border-b border-zinc-800">
                  <tr>{["Date","Customer ID","Company","Entity","Risk","Score","Status","Last Touch","Rev. Date","Responsible"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-zinc-500 font-medium whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const daysLeft = Math.round((new Date(c.reverificationDate).getTime() - Date.now()) / 86400_000);
                    return (
                      <tr key={c.id} onClick={() => setSelected(selected?.id === c.id ? null : c)}
                        className={`border-b border-zinc-800/40 hover:bg-zinc-900 cursor-pointer ${selected?.id === c.id ? "bg-zinc-900" : ""}`}>
                        <td className="px-4 py-2.5 text-zinc-500">{c.date.slice(0,10)}</td>
                        <td className="px-4 py-2.5 font-mono text-zinc-400 text-[10px]">{c.customerId}</td>
                        <td className="px-4 py-2.5"><div className="text-white font-medium">{c.companyName}</div></td>
                        <td className="px-4 py-2.5 text-zinc-400">{c.entity}</td>
                        <td className="px-4 py-2.5"><RiskBadge level={c.riskLevel} /></td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-white font-mono">{c.riskScore}</span>
                            <div className="w-10 bg-zinc-800 rounded-full h-1 overflow-hidden">
                              <div className={`h-full rounded-full ${c.riskLevel === "Low" ? "bg-green-500" : c.riskLevel === "Medium" ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${c.riskScore}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5"><StatusBadge status={c.status} /></td>
                        <td className="px-4 py-2.5 text-zinc-500">{c.lastTouchDate}</td>
                        <td className="px-4 py-2.5">
                          <span className={daysLeft < 90 ? "text-orange-400" : "text-zinc-500"}>{c.reverificationDate}</span>
                        </td>
                        <td className="px-4 py-2.5 text-zinc-400">{c.responsible}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && <div className="text-center py-12 text-zinc-500 text-sm">No clients match the filter</div>}
            </div>
          </div>

          {/* Detail Panel */}
          {selected && (
            <div className="w-full lg:w-[45%] border-l border-zinc-800 overflow-auto flex-shrink-0">
              <ClientDetailPanel
                client={clients.find(c => c.id === selected.id)!}
                onClose={() => setSelected(null)}
                onSave={handleSave}
                currentUser={user?.email || "admin"}
              />
            </div>
          )}
        </div>
      )}

      {tab === "calculator" && <RiskCalculatorPanel />}
      {tab === "countries" && <CountryRiskPanel />}
      {tab === "audit" && (
        <div className="max-w-4xl mx-auto p-6 space-y-3">
          <h2 className="text-sm font-bold text-white">Global Audit Log</h2>
          {globalAudit.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-sm">No audit entries yet. Edit a client's risk factors to create entries.</div>
          ) : (
            globalAudit.slice().reverse().map(e => (
              <div key={e.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-white text-xs font-semibold">{e.clientName}</span>
                    <span className="text-zinc-600 text-xs mx-2">·</span>
                    <span className="text-zinc-400 text-xs">{e.factor}</span>
                  </div>
                  <span className="text-zinc-500 text-[10px]">{new Date(e.timestamp).toLocaleString()}</span>
                </div>
                <p className="text-zinc-500 text-[10px]">Changed by <span className="text-zinc-300">{e.user}</span></p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="bg-zinc-800 px-2 py-0.5 rounded font-mono text-zinc-400">{e.oldValue}</span>
                  <span className="text-zinc-600">→</span>
                  <span className="bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 rounded font-mono text-indigo-300">{e.newValue}</span>
                </div>
                <p className="text-zinc-400 text-xs italic">Reason: "{e.reason}"</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
