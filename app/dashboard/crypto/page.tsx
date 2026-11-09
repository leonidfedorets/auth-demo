"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft, ArrowUpRight, RefreshCw, Copy, Check, ChevronRight,
  ExternalLink, Clock, CheckCircle2, Loader2, Building2, User, Shield,
  Wallet, ArrowRight, BarChart2, FileText, Plus, Camera, X, Calendar,
  ChevronLeft, Activity, Timer, ShoppingCart, ArrowLeftRight, Tag, Receipt
} from "lucide-react";
import { DashNav } from "@/components/dash-nav";

/* ── helpers ── */
function uid(p = "ID") { return `${p}-${Date.now().toString(36).toUpperCase()}`; }
function now() { return new Date().toISOString(); }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function CopyBtn({ text }: { text: string }) {
  const [c, setC] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setC(true); setTimeout(() => setC(false), 1600); }}
      className="text-zinc-500 hover:text-zinc-300 cursor-pointer ml-1 shrink-0">
      {c ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function SBadge({ s }: { s: string }) {
  const m: Record<string, string> = {
    COMPLETE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    ACCEPTED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    APPROVED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    DETECTED: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    PENDING: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    UNDER_REVIEW: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    PENDING_REVIEW: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    EXCEPTION: "bg-red-500/15 text-red-400 border-red-500/30",
    REJECTED: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${m[s] ?? "bg-zinc-700 text-zinc-300 border-zinc-600"}`}>{s.replace(/_/g, " ")}</span>;
}

function CIcon({ sym, size = 24 }: { sym: string; size?: number }) {
  const bg: Record<string, string> = { BTC: "#F7931A", ETH: "#627EEA", USDT: "#26A17B", USDC: "#2775CA", SOL: "#9945FF", EUR: "#003399", USD: "#1a56db", GBP: "#00247D" };
  const lbl: Record<string, string> = { BTC: "₿", ETH: "⟠", USDT: "T", USDC: "U", SOL: "◎", EUR: "€", USD: "$", GBP: "£" };
  return (
    <div style={{ width: size, height: size, background: bg[sym] ?? "#6366f1", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ color: "#fff", fontSize: size * 0.4, fontWeight: 700, lineHeight: 1 }}>{lbl[sym] ?? sym[0]}</span>
    </div>
  );
}

function QRMock({ data, size = 130 }: { data: string; size?: number }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    import("qrcode").then(QR => {
      QR.toString(data || "address", { type: "svg", width: size, margin: 1, color: { dark: "#000000", light: "#ffffff" } })
        .then(s => setSvg(s))
        .catch(() => setSvg(null));
    });
  }, [data, size]);
  if (!svg) return (
    <div style={{ width: size, height: size, background: "#fff", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
    </div>
  );
  return (
    <div style={{ borderRadius: 10, overflow: "hidden", display: "inline-block", lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: svg }} />
  );
}

/* ── types ── */
type AccType = "B2B" | "B2C";
type CState = "banner" | "onboarding" | "active";
type OStep = "type" | "agreements" | "info" | "kyc" | "review" | "wallets" | "creating";
type VStatus = "UNDER_REVIEW" | "APPROVED";

interface CryptoAcc {
  bvnkId: string; accountType: AccType; taxId: string; intendedUse: string;
  sourceOfFunds: string; volume: string; taxRes: string;
  verificationStatus: VStatus; selectedWallets: string[];
  wallets: Record<string, { address: string; balance: string }>;
  projectEurBalance: string;
  projectUsdBalance?: string;
  projectGbpBalance?: string;
  bankingEurBalance: string;
  bankingUsdBalance?: string;
  bankingGbpBalance?: string;
  createdAt: string;
}
interface IncomeTx {
  id: string; transactionType: "CRYPTO_INCOMING";
  transferId?: string; customerId?: string;
  providerPaymentId: string; requestedCryptoAmount: string;
  receivedCryptoAmount: string; creditedCryptoAmount: string;
  cryptoCurrency: string; network: string; networkDisplay: string;
  senderAddress: string; recipientAddress: string; transactionHash: string;
  networkFee?: string; providerFee: string;
  providerFeeEur?: string; commissionEur?: string; commissionRate?: string;
  bvnkWalletId: string; status: string;
  detectedAt: string; updatedAt?: string; confirmedAt?: string;
  checkout_payment_id?: string;
}
interface CheckoutOrder {
  checkout_payment_id: string; crypto_operation_id: string;
  merchant_id: string; project_id: string; order_reference: string;
  order_amount: string; order_currency: string;
  selected_crypto_asset: string; selected_network: string;
  crypto_submid_id: string; payment_status: string; settlement_status: string;
  project_iban: string; project_allocation_reference: string;
  t1_id: string; t2_id: string; t3_id: string; created_at: string;
  customerId: string; pid: string; type: string; paymentMethod: string;
  project_reference: string;
  network_fee: string; provider_fee_eur: string; commission_eur: string;
  commission_rate: string; total_fee_eur: string;
}
interface ExchangeTx {
  id: string; transactionType: "CRYPTO_WITHDRAWAL_FX";
  checkout_payment_id: string; source_wallet_id: string;
  crypto_debit_amount: string; source_currency: string; target_currency: string;
  provider_exchange_rate: string; customer_exchange_rate: string;
  gross_converted_eur: string;
  network_fee_usdt: string;
  provider_fee_eur: string;
  commission_eur: string; commission_rate: string;
  total_fee_eur: string;
  converted_eur_amount: string; net_settlement_amount: string;
  provider_transfer_id: string; provider_payout_id: string;
  destination_iban: string; allocation_reference: string;
  t1_reference: string;
  status: string; created_at: string;
}
interface EurIncomingTx {
  id: string; transactionType: "MERCHANT_PROJECT_INCOMING_EUR";
  checkout_payment_id: string; currency: string; actual_received_amount: string;
  total_fee_deducted: string;
  sender_name: string; sender_account: string; beneficiary_iban: string;
  bank_reference: string; bank_transaction_id: string;
  project_id: string; project_balance_posting_id: string;
  t2_reference: string;
  status: string; posted_at: string;
}
interface WithdrawalTx {
  id: string; transactionType: "EUR_TO_CRYPTO_WITHDRAWAL" | "FIAT_TO_CRYPTO_WITHDRAWAL" | "CRYPTO_TO_EUR_WITHDRAWAL" | "CRYPTO_TO_EXTERNAL_WITHDRAWAL";
  direction: "EUR_TO_CRYPTO" | "FIAT_TO_CRYPTO" | "CRYPTO_TO_EUR" | "CRYPTO_TO_EXTERNAL";
  customerId: string; transferId: string; pid: string;
  paymentMethod: string; status: string;
  eurAmount: string; networkFeeUsdt: string; providerFeeEur: string;
  commissionEur: string; commissionRate: string; totalFeeEur: string;
  netCryptoAmount: string; targetCurrency: string; targetNetwork: string;
  depositAddress: string; conversionRate: string;
  t1_reference?: string;
  sourceBankAccount: string;
  // crypto→EUR only
  cryptoAmount?: string; cryptoCurrency?: string; networkFeeCrypto?: string;
  providerFeeCrypto?: string; commissionCrypto?: string; netEurAmount?: string;
  // crypto→external wallet only
  externalAddress?: string; txHash?: string;
  createdAt: string; updatedAt: string;
}

const CRYPTO_OPTS = [
  { id: "BTC", name: "Bitcoin", rec: true },
  { id: "ETH", name: "Ethereum" },
  { id: "USDT", name: "Tether USD" },
  { id: "USDC", name: "USD Coin" },
  { id: "SOL", name: "Solana" },
  { id: "BNB", name: "BNB" },
  { id: "XRP", name: "XRP" },
];
const NETWORKS: Record<string, string[]> = {
  USDT: ["ETHEREUM (ERC20)", "TRON (TRC20)", "POLYGON"],
  USDC: ["ETHEREUM (ERC20)", "POLYGON", "SOLANA"],
  ETH: ["ETHEREUM"], BTC: ["BITCOIN"], SOL: ["SOLANA"],
  BNB: ["BNB SMART CHAIN (BEP20)"], XRP: ["XRP LEDGER"],
};

function explorerTxUrl(network: string, hash: string): string {
  const n = (network ?? "").toUpperCase();
  if (n.includes("TRON") || n.includes("TRC20")) return `https://tronscan.org/#/transaction/${hash}`;
  if (n.includes("POLYGON")) return `https://polygonscan.com/tx/${hash}`;
  if (n.includes("SOLANA") || n.includes("SOL")) return `https://solscan.io/tx/${hash}`;
  if (n.includes("BITCOIN") || n.includes("BTC")) return `https://blockchair.com/bitcoin/transaction/${hash}`;
  if (n.includes("BNB") || n.includes("BSC")) return `https://bscscan.com/tx/${hash}`;
  if (n.includes("XRP") || n.includes("RIPPLE")) return `https://xrpscan.com/tx/${hash}`;
  return `https://etherscan.io/tx/${hash}`;
}
function explorerAddrUrl(network: string, addr: string): string {
  const n = (network ?? "").toUpperCase();
  if (n.includes("TRON") || n.includes("TRC20")) return `https://tronscan.org/#/address/${addr}`;
  if (n.includes("POLYGON")) return `https://polygonscan.com/address/${addr}`;
  if (n.includes("SOLANA") || n.includes("SOL")) return `https://solscan.io/account/${addr}`;
  if (n.includes("BITCOIN") || n.includes("BTC")) return `https://blockchair.com/bitcoin/address/${addr}`;
  if (n.includes("BNB") || n.includes("BSC")) return `https://bscscan.com/address/${addr}`;
  if (n.includes("XRP") || n.includes("RIPPLE")) return `https://xrpscan.com/account/${addr}`;
  return `https://etherscan.io/address/${addr}`;
}

const TOS = `BVNK Provider Agreement — Version 2.4 · Effective 15 Jan 2025

BVNK Terms of Service

These Terms of Service (the "Agreement") are entered into between you (the "Customer") and BVNK Limited ("BVNK") and govern your access to and use of BVNK's services, including the provision of payment, settlement and related financial infrastructure services (the "Services").

1. Definitions
"Account" means the account provided to you by BVNK to access the Services.
"Applicable Law" means all applicable laws and regulations.
"Services" means the payment, collection, settlement, wallet, and other financial infrastructure services provided by BVNK.
"Embedded Services" means services provided via API integration to partner platforms.

2. Services
2.1 BVNK provides embedded crypto services including: (a) crypto custody wallets; (b) crypto deposit channels; (c) fiat-to-crypto and crypto-to-fiat exchange; (d) crypto withdrawal to external blockchain addresses.
2.2 All services are subject to BVNK's AML/KYC policies and applicable regulatory requirements.

3. Customer Obligations
3.1 You must provide accurate information during onboarding and maintain its accuracy.
3.2 You must implement appropriate AML controls for your end customers.
3.3 You must not use the Services for prohibited activities including sanctions evasion, fraud, or money laundering.

4. Fees
4.1 BVNK charges fees as set out in the applicable pricing schedule.
4.2 Fees are deducted from transaction amounts or billed separately.

5. Liability
5.1 BVNK's liability is limited to direct losses and capped at fees paid in the 3 months prior to the claim.

16. Governing Law
This Agreement is governed by the laws of England and Wales.`;

const PRIVACY = `BVNK Privacy Policy — Version 1.8 · Effective 15 Jan 2025

How BVNK collects, uses, and protects your data.

1. Data We Collect
We collect: identity data, contact data, financial data, transaction data, technical data, and usage data.

2. How We Use Your Data
To provide and manage services, comply with legal obligations, prevent fraud, and improve our products.

3. Data Sharing
We share data with: regulatory authorities, payment partners, KYC providers, and IT service providers.

4. Data Retention
We retain data for 7 years after the end of the business relationship, or longer where required by law.

5. Your Rights
You have rights to: access, rectification, erasure, restriction, portability, and objection.

6. Contact: dpo@bvnk.com`;

/* ════════════════════════════════════════════
   BANNER
════════════════════════════════════════════ */
function Banner({ onActivate }: { onActivate: () => void }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-zinc-900 border border-indigo-500/20 p-6 relative overflow-hidden">
      <div className="absolute right-6 top-1/2 -translate-y-1/2">
        <svg width="140" height="100" viewBox="0 0 140 100">
          <circle cx="52" cy="58" r="38" fill="#F7931A" opacity="0.9" /><text x="52" y="65" textAnchor="middle" fill="white" fontSize="22" fontWeight="800">₿</text>
          <circle cx="102" cy="38" r="27" fill="#627EEA" opacity="0.9" /><text x="102" y="44" textAnchor="middle" fill="white" fontSize="15" fontWeight="700">⟠</text>
          <circle cx="114" cy="74" r="19" fill="#9945FF" opacity="0.85" /><text x="114" y="79" textAnchor="middle" fill="white" fontSize="10" fontWeight="700">◎</text>
        </svg>
      </div>
      <div className="max-w-md">
        <p className="text-xs text-indigo-400 font-semibold mb-1">BVNK Embedded · Crypto Services</p>
        <h2 className="text-xl font-bold text-white mb-1.5">Use crypto with PayDo</h2>
        <p className="text-sm text-zinc-400 mb-5">Access supported cryptocurrencies and exchange between crypto and fiat. Powered by BVNK Embedded.</p>
        <div className="flex items-center gap-3">
          <button onClick={onActivate} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl cursor-pointer transition-colors">
            Activate Crypto <ArrowRight className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500"><Shield className="w-3.5 h-3.5" />Additional terms and verification may be required.</div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   ONBOARDING WIZARD
════════════════════════════════════════════ */
function Onboarding({ onDone }: { onDone: (a: CryptoAcc) => void }) {
  const [step, setStep] = useState<OStep>("type");
  const [accType, setAccType] = useState<AccType>("B2B");
  const [tosOk, setTosOk] = useState(false);
  const [privOk, setPrivOk] = useState(false);
  const [openDoc, setOpenDoc] = useState<"tos" | "priv" | null>(null);
  const [form, setForm] = useState({ intendedUse: "Accept crypto payments from customers", sourceOfFunds: "Revenue from goods and services", volume: "€100,000 – €500,000", taxRes: "same", taxId: "" });
  const [kycPhase, setKycPhase] = useState(0);
  const [vStatus, setVStatus] = useState<VStatus>("UNDER_REVIEW");
  const [selWallets, setSelWallets] = useState(["BTC", "ETH", "USDT"]);
  const [wProg, setWProg] = useState<Record<string, number>>({});
  const [wStat, setWStat] = useState<Record<string, string>>({});
  const bvnkId = `bvnk-emb-cust-${Date.now().toString(36)}`;

  const stepBar = (labels: string[], active: number) => (
    <div className="flex items-center gap-1 mb-5">
      {labels.map((lbl, i) => (
        <div key={i} className="flex items-center gap-1 flex-1">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${i < active ? "bg-indigo-600 text-white" : i === active ? "bg-indigo-600 text-white ring-2 ring-indigo-400/30" : "bg-zinc-800 text-zinc-500 border border-zinc-700"}`}>
            {i < active ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </div>
          <span className={`text-[10px] flex-1 ${i <= active ? "text-zinc-300" : "text-zinc-600"}`}>{lbl}</span>
          {i < labels.length - 1 && <div className={`w-4 h-px mx-0.5 ${i < active ? "bg-indigo-600" : "bg-zinc-800"}`} />}
        </div>
      ))}
    </div>
  );

  async function runKyc() {
    setKycPhase(1); await sleep(1200);
    setKycPhase(2); await sleep(1500);
    setKycPhase(3); await sleep(1600);
    setStep("review");
  }

  async function simulateApprove() {
    await sleep(2200);
    setVStatus("APPROVED");
  }

  async function createWallets() {
    const p: Record<string, number> = {}, s: Record<string, string> = {};
    selWallets.forEach(w => { p[w] = 0; s[w] = "pending"; });
    setWProg({ ...p }); setWStat({ ...s }); setStep("creating");
    for (let i = 0; i <= 100; i += 4) {
      await sleep(60);
      const np: Record<string, number> = {}, ns: Record<string, string> = {};
      selWallets.forEach((w, idx) => {
        const v = Math.min(100, Math.max(0, i - idx * 18));
        np[w] = v; ns[w] = v >= 100 ? "active" : v > 0 ? "creating" : "pending";
      });
      setWProg({ ...np }); setWStat({ ...ns });
    }
    await sleep(400);
    const wallets: CryptoAcc["wallets"] = {};
    selWallets.forEach(sym => { wallets[sym] = { address: `0x${Math.random().toString(16).slice(2).padEnd(40, "0").slice(0, 40)}`, balance: "0.000000" }; });
    onDone({ bvnkId, accountType: accType, taxId: form.taxId, intendedUse: form.intendedUse, sourceOfFunds: form.sourceOfFunds, volume: form.volume, taxRes: form.taxRes, verificationStatus: "APPROVED", selectedWallets: selWallets, wallets, projectEurBalance: "0.00", projectUsdBalance: "0.00", projectGbpBalance: "0.00", bankingEurBalance: "10000.00", bankingUsdBalance: "0.00", bankingGbpBalance: "0.00", createdAt: now() });
  }

  return (
    <div className="max-w-xl mx-auto">
      <button className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 mb-4 cursor-pointer transition-colors">
        <ChevronLeft className="w-3.5 h-3.5" />Crypto onboarding
      </button>
      {step !== "kyc" && step !== "review" && step !== "creating" && (
        <div className="rounded-2xl bg-gradient-to-r from-indigo-500/10 to-violet-500/5 border border-indigo-500/20 p-4 mb-4 flex items-center gap-4">
          <svg width="72" height="56" viewBox="0 0 72 56">
            <circle cx="28" cy="34" r="21" fill="#F7931A" opacity="0.9" /><text x="28" y="40" textAnchor="middle" fill="white" fontSize="13" fontWeight="800">₿</text>
            <circle cx="54" cy="20" r="15" fill="#627EEA" opacity="0.9" /><text x="54" y="25" textAnchor="middle" fill="white" fontSize="9" fontWeight="700">⟠</text>
            <circle cx="60" cy="44" r="11" fill="#9945FF" opacity="0.8" /><text x="60" y="48" textAnchor="middle" fill="white" fontSize="7" fontWeight="700">◎</text>
          </svg>
          <div>
            <p className="text-base font-bold text-white">Activate crypto with PayDo</p>
            <p className="text-xs text-zinc-400">Access supported cryptocurrencies and exchange between crypto and fiat.</p>
          </div>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">

        {/* STEP: type */}
        {step === "type" && (
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Account Type</p>
            <h2 className="text-base font-bold text-white mb-1">Choose your account type</h2>
            <p className="text-xs text-zinc-400 mb-4">Select the account type that best describes your relationship.</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {(["B2B", "B2C"] as AccType[]).map(t => (
                <button key={t} onClick={() => setAccType(t)}
                  className={`text-left p-4 rounded-xl border cursor-pointer transition-all ${accType === t ? "border-indigo-500 bg-indigo-500/10" : "border-zinc-700 hover:border-zinc-600"}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 ${t === "B2B" ? "bg-indigo-600/20" : "bg-cyan-600/20"}`}>
                    {t === "B2B" ? <Building2 className="w-4 h-4 text-indigo-400" /> : <User className="w-4 h-4 text-cyan-400" />}
                  </div>
                  <p className="text-sm font-semibold text-white">{t === "B2B" ? "Business (B2B)" : "Individual (B2C)"}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{t === "B2B" ? "For companies and merchants" : "For individual users"}</p>
                  {accType === t && <div className="flex items-center gap-1 mt-2 text-indigo-400"><Check className="w-3 h-3" /><span className="text-[10px]">Selected</span></div>}
                </button>
              ))}
            </div>
            <button onClick={() => setStep("agreements")} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl py-2.5 cursor-pointer flex items-center justify-center gap-2">
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP: agreements */}
        {step === "agreements" && (
          <div>
            {stepBar(["Review agreements", "Verify details", "Activate crypto"], 0)}
            <h2 className="text-base font-bold text-white mb-1">Review crypto service agreements</h2>
            <p className="text-xs text-zinc-400 mb-4">To activate crypto services, review and accept the BVNK agreements that govern the provision of crypto services on PayDo.</p>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase mb-2">Agreements to review</p>
            <div className="space-y-2 mb-4">
              {[
                { key: "tos" as const, icon: FileText, label: "Terms & Conditions", desc: "The terms that apply to your use of BVNK's crypto services", accepted: tosOk },
                { key: "priv" as const, icon: Shield, label: "Privacy Policy", desc: "How BVNK collects, uses, and protects your data", accepted: privOk },
              ].map(item => (
                <button key={item.key} onClick={() => setOpenDoc(openDoc === item.key ? null : item.key)}
                  className={`w-full flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all text-left ${item.accepted ? "border-emerald-500/30 bg-emerald-500/5" : "border-zinc-700 hover:border-zinc-600"}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.accepted ? "bg-emerald-500/20" : "bg-zinc-800"}`}>
                      <item.icon className={`w-4 h-4 ${item.accepted ? "text-emerald-400" : "text-zinc-400"}`} />
                    </div>
                    <div><p className="text-sm font-medium text-white">{item.label}</p><p className="text-[10px] text-zinc-500">{item.desc}</p></div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.accepted ? <span className="text-[10px] text-emerald-400 font-semibold">✓ Accepted</span> : <span className="text-[10px] text-orange-400 font-semibold border border-orange-500/30 bg-orange-500/10 px-1.5 py-0.5 rounded">Required</span>}
                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                  </div>
                </button>
              ))}
            </div>
            {openDoc && (
              <div className="mb-4 rounded-xl border border-zinc-700 overflow-hidden">
                <div className="bg-zinc-800 px-3 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-zinc-700 flex items-center justify-center text-[9px] font-bold text-white">B</div>
                    <div>
                      <p className="text-xs font-semibold text-white">BVNK Provider Agreement</p>
                      <p className="text-[10px] text-zinc-500">Terms of Service and Commercial Agreement</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${(openDoc === "tos" ? tosOk : privOk) ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-orange-500/15 text-orange-400 border-orange-500/30"}`}>
                      {(openDoc === "tos" ? tosOk : privOk) ? "✓ Accepted" : "Terms pending"}
                    </span>
                    <button onClick={() => setOpenDoc(null)}><X className="w-4 h-4 text-zinc-500 hover:text-white cursor-pointer" /></button>
                  </div>
                </div>
                <div className="h-44 overflow-y-auto p-3 bg-zinc-900/80"><pre className="text-[11px] text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">{openDoc === "tos" ? TOS : PRIVACY}</pre></div>
                <div className="bg-zinc-800 px-3 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[10px] text-zinc-500"><Shield className="w-3 h-3" />Your information is securely shared with BVNK.</div>
                  <div className="flex gap-2">
                    <button onClick={() => setOpenDoc(null)} className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg border border-zinc-700 cursor-pointer">Reject</button>
                    <button onClick={() => { openDoc === "tos" ? setTosOk(true) : setPrivOk(true); setOpenDoc(null); }}
                      className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5">
                      Accept and continue <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setStep("type")} className="px-4 border border-zinc-700 text-zinc-400 text-sm rounded-xl py-2.5 cursor-pointer hover:bg-zinc-800">Back</button>
              <button onClick={() => setStep("info")} disabled={!tosOk || !privOk}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 cursor-pointer flex items-center justify-center gap-2">
                Review Terms <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP: info */}
        {step === "info" && (
          <div>
            {stepBar(["Review agreements", "Verify details", "Activate crypto"], 1)}
            <div className="flex items-center gap-2 mb-1"><span className="text-[10px] bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full">Step 2 of 3</span></div>
            <h2 className="text-base font-bold text-white mb-1">Complete crypto verification</h2>
            <p className="text-xs text-zinc-400 mb-4">We need a few more details to finish your crypto onboarding with BVNK. This helps us meet regulatory requirements.</p>
            <div className="rounded-xl bg-zinc-800/60 border border-zinc-700 p-3 mb-3">
              <div className="flex items-center gap-2 mb-2.5">
                <User className="w-3.5 h-3.5 text-zinc-400" /><p className="text-xs font-semibold text-white">Your details (from verification)</p>
                <p className="text-[10px] text-zinc-500 ml-auto">Cannot be edited</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[{ l: "Legal entity name", v: accType === "B2B" ? "Your Business Ltd" : "John Smith" }, { l: "Country of incorporation", v: "Ireland" }].map(r => (
                  <div key={r.l}>
                    <label className="text-[10px] text-zinc-500">{r.l}</label>
                    <div className="flex items-center gap-2 bg-zinc-700/50 rounded-lg px-2.5 h-7 mt-0.5"><span className="text-xs text-zinc-300 flex-1">{r.v}</span><Shield className="w-3 h-3 text-zinc-500 shrink-0" /></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 mb-2.5">
              <div>
                <label className="text-xs text-zinc-400">Intended use *</label>
                <select className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 h-8 text-xs text-white outline-none focus:border-indigo-500"
                  value={form.intendedUse} onChange={e => setForm(f => ({ ...f, intendedUse: e.target.value }))}>
                  {["Accept crypto payments from customers", "Send crypto payments to suppliers", "Convert fiat to crypto", "Store crypto assets"].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-400">Source of funds *</label>
                <select className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 h-8 text-xs text-white outline-none focus:border-indigo-500"
                  value={form.sourceOfFunds} onChange={e => setForm(f => ({ ...f, sourceOfFunds: e.target.value }))}>
                  {["Revenue from goods and services", "Investment returns", "Crypto trading profits", "Other"].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div className="mb-2.5">
              <label className="text-xs text-zinc-400">Expected monthly volume *</label>
              <select className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 h-8 text-xs text-white outline-none focus:border-indigo-500"
                value={form.volume} onChange={e => setForm(f => ({ ...f, volume: e.target.value }))}>
                {["< €10,000", "€10,000 – €50,000", "€50,000 – €100,000", "€100,000 – €500,000", "> €500,000"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="mb-2.5">
              <label className="text-xs text-zinc-400">Tax residency *</label>
              <div className="mt-1 space-y-1.5">
                {[{ v: "same", l: "Same as country of incorporation (Ireland)" }, { v: "other", l: "Other" }].map(o => (
                  <label key={o.v} className="flex items-center gap-2 cursor-pointer">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${form.taxRes === o.v ? "border-indigo-500" : "border-zinc-600"}`}>
                      {form.taxRes === o.v && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                    </div>
                    <span className="text-xs text-zinc-300">{o.l}</span>
                    <input type="radio" className="sr-only" checked={form.taxRes === o.v} onChange={() => setForm(f => ({ ...f, taxRes: o.v }))} />
                  </label>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="text-xs text-zinc-400">Tax ID / VAT number *</label>
              <input className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 h-8 text-xs text-white outline-none focus:border-indigo-500"
                placeholder="e.g. IE123456789" value={form.taxId} onChange={e => setForm(f => ({ ...f, taxId: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("agreements")} className="px-4 border border-zinc-700 text-zinc-400 text-sm rounded-xl py-2.5 cursor-pointer hover:bg-zinc-800">Back</button>
              <button onClick={() => setStep("kyc")} disabled={!form.taxId}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 cursor-pointer flex items-center justify-center gap-2">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP: kyc */}
        {step === "kyc" && (
          <div>
            {stepBar(["Review agreements", "Verify details", "Activate crypto"], 1)}
            {kycPhase === 0 ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center"><span className="text-xs font-bold text-white">BVNK</span></div>
                  <div><p className="text-[10px] text-indigo-400 font-semibold uppercase">VERIFICATION REQUIRED</p><h2 className="text-base font-bold text-white">Complete verification with BVNK</h2></div>
                </div>
                <p className="text-xs text-zinc-400 mb-4">Our verification provider BVNK needs a few additional documents to verify your business and keep your account active.</p>
                <div className="space-y-2.5 mb-5">
                  {[{ I: User, l: "Proof of identity", d: "A government-issued photo ID (e.g. passport, driver's licence)" }, { I: FileText, l: "Proof of address", d: "A recent document (e.g. utility bill, bank statement)" }, { I: Camera, l: "Selfie", d: "A live selfie to confirm your identity" }].map(item => (
                    <div key={item.l} className="flex items-start gap-3 p-3 rounded-xl bg-zinc-800 border border-zinc-700">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0"><item.I className="w-4 h-4 text-indigo-400" /></div>
                      <div><p className="text-xs font-semibold text-white">{item.l}</p><p className="text-[10px] text-zinc-500">{item.d}</p></div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mb-4"><Shield className="w-3 h-3" />Secure, hosted verification by BVNK</div>
                <div className="flex gap-3">
                  <button onClick={() => setStep("info")} className="px-4 border border-zinc-700 text-zinc-400 text-sm rounded-xl py-2.5 cursor-pointer hover:bg-zinc-800">Back</button>
                  <button onClick={runKyc} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl py-2.5 cursor-pointer flex items-center justify-center gap-2">
                    Continue with BVNK <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto mb-3"><span className="text-xs font-bold text-white">BVNK</span></div>
                <p className="text-sm font-semibold text-white mb-1">BVNK Verification in Progress</p>
                <p className="text-xs text-zinc-500 mb-5">Verifying your identity and documents…</p>
                <div className="space-y-2.5 text-left">
                  {[{ ph: 1, l: "Verifying proof of identity", I: User }, { ph: 2, l: "Checking proof of address", I: FileText }, { ph: 3, l: "Liveness check (selfie)", I: Camera }].map(item => (
                    <div key={item.ph} className={`flex items-center gap-3 p-3 rounded-xl border ${kycPhase > item.ph ? "border-emerald-500/30 bg-emerald-500/5" : kycPhase === item.ph ? "border-indigo-500/30 bg-indigo-500/5" : "border-zinc-800"}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${kycPhase > item.ph ? "bg-emerald-600" : kycPhase === item.ph ? "bg-indigo-600" : "bg-zinc-800"}`}>
                        {kycPhase > item.ph ? <Check className="w-3.5 h-3.5 text-white" /> : kycPhase === item.ph ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <div className="w-2 h-2 rounded-full bg-zinc-600" />}
                      </div>
                      <span className={`text-xs ${kycPhase >= item.ph ? "text-white" : "text-zinc-600"}`}>{item.l}</span>
                      {kycPhase > item.ph && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-auto" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP: review */}
        {step === "review" && (
          <div>
            <div className="flex items-center gap-0.5 mb-5">
              {[{ l: "Agreements accepted", done: true }, { l: "Information submitted", done: true }, { l: "Under review", done: vStatus === "APPROVED", active: vStatus === "UNDER_REVIEW" }, { l: "Wallet setup", done: false }].map((s, i, arr) => (
                <div key={i} className="flex items-center flex-1 gap-0.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${s.done ? "bg-emerald-600" : s.active ? "bg-zinc-800 border-2 border-indigo-500" : "bg-zinc-800 border border-zinc-700"}`}>
                    {s.done ? <Check className="w-4 h-4 text-white" /> : s.active ? <Clock className="w-4 h-4 text-indigo-400" /> : <Wallet className="w-4 h-4 text-zinc-600" />}
                  </div>
                  <p className={`text-[9px] font-semibold truncate ${s.done || s.active ? "text-white" : "text-zinc-600"}`}>{s.l}</p>
                  {i < arr.length - 1 && <div className={`w-4 h-px mx-0.5 shrink-0 ${s.done ? "bg-emerald-600" : "bg-zinc-700"}`} />}
                </div>
              ))}
            </div>

            {vStatus === "UNDER_REVIEW" ? (
              <>
                <div className="text-center mb-4">
                  <SBadge s="UNDER_REVIEW" />
                  <h2 className="text-base font-bold text-white mt-2.5 mb-1">Your information is being reviewed</h2>
                  <p className="text-xs text-zinc-400">Our provider is reviewing the information you submitted. We'll notify you when the review is completed.</p>
                </div>
                <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-3 flex items-start gap-2.5 mb-5">
                  <Calendar className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div><p className="text-xs font-semibold text-white">Estimated review time</p><p className="text-[10px] text-zinc-400">Usually 1–2 business days (up to 3 business days in some cases).</p></div>
                </div>
                <div className="flex gap-3">
                  <button onClick={simulateApprove} className="flex-1 flex items-center justify-center gap-2 border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-sm rounded-xl py-2.5 cursor-pointer hover:bg-indigo-500/20">
                    <RefreshCw className="w-4 h-4" />Refresh status
                  </button>
                  <button className="flex-1 border border-zinc-700 text-zinc-400 text-sm rounded-xl py-2.5 cursor-pointer hover:bg-zinc-800">Learn more</button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-600/20 border-2 border-emerald-500 flex items-center justify-center mx-auto mb-2.5">
                    <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                  </div>
                  <span className="text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">BVNK APPROVED</span>
                  <h2 className="text-base font-bold text-white mt-2 mb-1">Verification complete!</h2>
                  <p className="text-xs text-zinc-400">Your account has been verified. Now set up your crypto wallets to get started.</p>
                </div>
                <button onClick={() => setStep("wallets")} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl py-2.5 cursor-pointer flex items-center justify-center gap-2">
                  Set up crypto wallets <ArrowRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        )}

        {/* STEP: wallets */}
        {step === "wallets" && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">BVNK APPROVED</span>
              <span className="text-xs text-zinc-500">Step 3 of 3</span>
            </div>
            <h2 className="text-base font-bold text-white mt-2 mb-1">Set up your crypto wallets</h2>
            <p className="text-xs text-zinc-400 mb-4">Choose the cryptocurrencies you want to work with. You can add more later in account settings.</p>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase mb-2">Select cryptocurrencies</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {CRYPTO_OPTS.map(c => {
                const sel = selWallets.includes(c.id);
                return (
                  <button key={c.id} onClick={() => setSelWallets(p => sel ? p.filter(x => x !== c.id) : [...p, c.id])}
                    className={`text-left p-3.5 rounded-xl border cursor-pointer transition-all ${sel ? "border-indigo-500 bg-indigo-500/10" : "border-zinc-700 hover:border-zinc-600"}`}>
                    <div className="flex items-start justify-between mb-2">
                      <CIcon sym={c.id} size={28} />
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${sel ? "bg-indigo-600 border-indigo-600" : "border-zinc-600"}`}>{sel && <Check className="w-2.5 h-2.5 text-white" />}</div>
                    </div>
                    <p className="text-xs font-semibold text-white">{c.id}</p>
                    <p className="text-[10px] text-zinc-500">{c.name}</p>
                    {c.rec && <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded mt-1 inline-block">Recommended</span>}
                  </button>
                );
              })}
            </div>
            <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-3 flex items-center gap-2 mb-4">
              <Wallet className="w-4 h-4 text-indigo-400" />
              <div><p className="text-xs font-semibold text-white">{selWallets.length} wallet{selWallets.length !== 1 ? "s" : ""} will be created</p><p className="text-[10px] text-zinc-500">{selWallets.join(", ")}</p></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("review")} className="px-4 border border-zinc-700 text-zinc-400 text-sm rounded-xl py-2.5 cursor-pointer hover:bg-zinc-800">Cancel</button>
              <button onClick={createWallets} disabled={selWallets.length === 0}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 cursor-pointer flex items-center justify-center gap-2">
                Create selected wallets <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP: creating */}
        {step === "creating" && (
          <div>
            <h2 className="text-base font-bold text-white mb-1">Wallet setup pending</h2>
            <p className="text-xs text-zinc-400 mb-4">We're creating and activating your selected wallets with our provider. This usually takes a few minutes.</p>
            <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-white">Wallet creation progress</p>
                <span className="text-xs text-zinc-400">{Object.values(wStat).filter(s => s === "active").length} of {selWallets.length} wallets in progress</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-700 rounded-full mb-4">
                <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${Object.values(wProg).reduce((s, v) => s + v, 0) / (selWallets.length * 100) * 100}%` }} />
              </div>
              <div className="space-y-3">
                {selWallets.map(sym => {
                  const prog = wProg[sym] ?? 0; const stat = wStat[sym] ?? "pending";
                  return (
                    <div key={sym} className="flex items-center gap-3">
                      <CIcon sym={sym} size={20} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-white">{sym}</span>
                          {stat === "active" ? <span className="text-[10px] text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" />Ready</span>
                            : stat === "creating" ? <span className="text-[10px] text-blue-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Creating</span>
                              : <span className="text-[10px] text-zinc-500">Awaiting activation</span>}
                        </div>
                        <div className="w-full h-1 bg-zinc-700 rounded-full">
                          <div className={`h-full rounded-full transition-all ${stat === "active" ? "bg-emerald-500" : "bg-indigo-600"}`} style={{ width: `${prog}%` }} />
                        </div>
                      </div>
                      {stat === "active" && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   ADD WALLET POPUP
════════════════════════════════════════════ */
function AddWalletPopup({ account, onUpdateAcc, onClose }: {
  account: CryptoAcc; onUpdateAcc: (a: CryptoAcc) => void; onClose: () => void;
}) {
  const existing = Object.keys(account.wallets);
  const available = CRYPTO_OPTS.filter(c => !existing.includes(c.id));
  const [sel, setSel] = useState<string>(available[0]?.id ?? "");
  const [phase, setPhase] = useState<"idle" | "creating" | "done">("idle");
  const [result, setResult] = useState<{ walletId: string; address: string } | null>(null);

  const accountType = account.accountType ?? "B2B";
  const customerId = account.bvnkId;
  const walletName = accountType === "B2B"
    ? `PayDo Merchant ${sel} Crypto Wallet`
    : `PayDo Personal ${sel} Wallet`;

  const reqBody = JSON.stringify({ customerId, currency: sel, name: walletName }, null, 2);

  async function create() {
    setPhase("creating");
    await sleep(1800);
    const walletId = `bvnk-wlt-${sel.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}`;
    const address = sel === "BTC"
      ? `bc1q${Math.random().toString(16).slice(2, 42)}`
      : sel === "XRP"
        ? `r${Math.random().toString(36).slice(2, 36)}`
        : `0x${Math.random().toString(16).slice(2).padEnd(40, "0").slice(0, 40)}`;
    setResult({ walletId, address });
    setPhase("done");
    const updWallets = { ...account.wallets, [sel]: { address, balance: "0.000000" } };
    onUpdateAcc({ ...account, wallets: updWallets, selectedWallets: [...(account.selectedWallets ?? []), sel] });
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div><p className="font-semibold text-white">Create New Wallet</p><p className="text-xs text-zinc-500">POST /ledger/v2/wallets</p></div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center cursor-pointer hover:bg-zinc-700"><X className="w-4 h-4 text-zinc-400" /></button>
        </div>
        <div className="p-4 space-y-4">
          {available.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center py-4">All supported currencies already have wallets.</p>
          ) : (
            <>
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Select currency</label>
                <div className="flex gap-1.5 flex-wrap">
                  {available.map(c => (
                    <button key={c.id} onClick={() => { if (phase === "idle") setSel(c.id); }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs cursor-pointer transition-all ${sel === c.id ? "border-indigo-500 bg-indigo-500/15 text-white" : "border-zinc-700 text-zinc-400 hover:border-zinc-600"}`}>
                      <CIcon sym={c.id} size={14} />{c.id} <span className="text-zinc-500">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* API request preview */}
              <div>
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">API Request</p>
                <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">POST</span>
                    <span className="text-[10px] font-mono text-zinc-400">/ledger/v2/wallets</span>
                  </div>
                  <pre className="text-[10px] font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">{reqBody}</pre>
                </div>
              </div>

              {/* Account type context */}
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-3 space-y-1">
                <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Wallet Context</p>
                <div className="flex justify-between text-xs"><span className="text-zinc-500">Customer ID</span><span className="font-mono text-zinc-300 text-[10px]">{customerId}</span></div>
                <div className="flex justify-between text-xs"><span className="text-zinc-500">Account Type</span><span className="text-zinc-300">{accountType}</span></div>
                <div className="flex justify-between text-xs"><span className="text-zinc-500">Network</span><span className="text-zinc-300">{NETWORKS[sel]?.[0] ?? "ETHEREUM (ERC20)"}</span></div>
                <div className="flex justify-between text-xs"><span className="text-zinc-500">Initial Balance</span><span className="text-zinc-300">0.000000 {sel}</span></div>
              </div>

              {phase === "done" && result && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 space-y-1">
                  <p className="text-[9px] font-semibold text-emerald-400 uppercase tracking-wider mb-1">Wallet Created</p>
                  <div className="flex justify-between text-xs"><span className="text-zinc-500">Wallet ID</span><span className="font-mono text-emerald-300 text-[10px] truncate max-w-[200px]">{result.walletId}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-zinc-500">Deposit Address</span><span className="font-mono text-emerald-300 text-[10px] truncate max-w-[200px]">{result.address}</span></div>
                </div>
              )}

              {phase === "idle" && (
                <button onClick={create} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl py-2.5 cursor-pointer flex items-center justify-center gap-2">
                  Create {sel} wallet <ArrowRight className="w-4 h-4" />
                </button>
              )}
              {phase === "creating" && (
                <div className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-indigo-400">
                  <Loader2 className="w-4 h-4 animate-spin" />Creating wallet…
                </div>
              )}
              {phase === "done" && (
                <button onClick={onClose} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl py-2.5 cursor-pointer flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" />Done
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   TOP-UP POPUP
════════════════════════════════════════════ */
function TopUpPopup({ account, onUpdateAcc, onAddTx, onClose }: {
  account: CryptoAcc; onUpdateAcc: (a: CryptoAcc) => void;
  onAddTx: (tx: IncomeTx) => void; onClose: () => void;
}) {
  const keys = Object.keys(account.wallets);
  const [cur, setCur] = useState(keys[0] ?? "USDT");
  const [net, setNet] = useState(NETWORKS[keys[0] ?? "USDT"]?.[0] ?? "ETHEREUM (ERC20)");
  const [simming, setSimming] = useState(false);
  const [phase, setPhase] = useState(0);
  const addr = account.wallets[cur]?.address ?? "0x...";
  const nets = NETWORKS[cur] ?? ["ETHEREUM (ERC20)"];

  async function simulate() {
    setSimming(true); setPhase(1);
    await sleep(1600);
    const tx: IncomeTx = {
      id: uid("INC"), transactionType: "CRYPTO_INCOMING",
      providerPaymentId: uid("bvnk-chpay"),
      requestedCryptoAmount: "100.000000", receivedCryptoAmount: "100.000000", creditedCryptoAmount: "100.000000",
      cryptoCurrency: cur, network: net.split(" ")[0],
      networkDisplay: net.includes("ERC20") ? "ERC20" : net.includes("TRC20") ? "TRC20" : net.split(" ")[0],
      senderAddress: `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`,
      recipientAddress: addr, transactionHash: `0x${Math.random().toString(16).slice(2, 16)}...${Math.random().toString(16).slice(2, 8)}`,
      providerFee: "0.000000", bvnkWalletId: `bvnk-wlt-${cur.toLowerCase()}`,
      status: "DETECTED", detectedAt: now(),
    };
    onAddTx({ ...tx });
    setPhase(2);
    await sleep(2200);
    onAddTx({ ...tx, status: "COMPLETE", confirmedAt: now() });
    const updatedWallets = { ...account.wallets };
    if (updatedWallets[cur]) {
      updatedWallets[cur] = { ...updatedWallets[cur], balance: (parseFloat(updatedWallets[cur].balance || "0") + 100).toFixed(6) };
    }
    onUpdateAcc({ ...account, wallets: updatedWallets });
    setPhase(3);
    await sleep(900);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div><p className="font-semibold text-white">Top Up Crypto</p><p className="text-xs text-zinc-500">Receive crypto to your wallet</p></div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center cursor-pointer hover:bg-zinc-700"><X className="w-4 h-4 text-zinc-400" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Cryptocurrency</label>
            <div className="flex gap-1.5 flex-wrap">
              {keys.map(sym => (
                <button key={sym} onClick={() => { setCur(sym); setNet(NETWORKS[sym]?.[0] ?? "ETHEREUM (ERC20)"); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs cursor-pointer transition-all ${cur === sym ? "border-indigo-500 bg-indigo-500/15 text-white" : "border-zinc-700 text-zinc-400 hover:border-zinc-600"}`}>
                  <CIcon sym={sym} size={14} />{sym}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Network</label>
            <select className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 h-8 text-xs text-white outline-none" value={net} onChange={e => setNet(e.target.value)}>
              {nets.map(n => <option key={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex justify-center py-2"><QRMock data={addr} size={130} /></div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Deposit Address</label>
            <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2">
              <span className="text-[10px] font-mono text-zinc-300 flex-1 truncate">{addr}</span>
              <CopyBtn text={addr} />
            </div>
          </div>
          <p className="text-[10px] text-zinc-600 text-center">Only send {cur} on {net.split(" ")[0]} network. Other assets may be permanently lost.</p>
          {phase > 0 && (
            <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-3 space-y-2">
              {[{ ph: 1, l: `Detecting 100 ${cur} payment…` }, { ph: 2, l: "Payment detected on blockchain" }, { ph: 3, l: "Transaction confirmed ✓" }].map(item => (
                <div key={item.ph} className={`flex items-center gap-2 text-xs ${phase > item.ph ? "text-emerald-400" : phase === item.ph ? "text-indigo-400" : "text-zinc-600"}`}>
                  {phase > item.ph ? <Check className="w-3 h-3" /> : phase === item.ph ? <Loader2 className="w-3 h-3 animate-spin" /> : <div className="w-3 h-3 rounded-full border border-zinc-700" />}
                  {item.l}
                </div>
              ))}
            </div>
          )}
          <button onClick={simulate} disabled={simming}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl py-2.5 cursor-pointer flex items-center justify-center gap-2">
            {simming ? <><Loader2 className="w-4 h-4 animate-spin" />Processing…</> : <>Simulate receiving 100 {cur}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   CHECKOUT POPUP
════════════════════════════════════════════ */
const PAYMENT_METHODS = [
  { id: "sepa", label: "SEPA Transfer", category: "fiat", icon: "€", desc: "1–2 business days" },
  { id: "wire", label: "Wire Transfer", category: "fiat", icon: "€", desc: "Same day" },
  { id: "card", label: "Credit / Debit Card", category: "fiat", icon: "$", desc: "Instant" },
  { id: "usdt_erc20", label: "USDT (ERC-20)", category: "crypto", icon: "T", sym: "USDT", net: "ETHEREUM (ERC20)" },
  { id: "usdt_trc20", label: "USDT (TRC-20)", category: "crypto", icon: "T", sym: "USDT", net: "TRON (TRC20)" },
  { id: "btc", label: "Bitcoin (BTC)", category: "crypto", icon: "₿", sym: "BTC", net: "BITCOIN" },
  { id: "eth", label: "Ethereum (ETH)", category: "crypto", icon: "⟠", sym: "ETH", net: "ETHEREUM" },
  { id: "usdc", label: "USDC (ERC-20)", category: "crypto", icon: "U", sym: "USDC", net: "ETHEREUM (ERC20)" },
];
const RATE_USDT_EUR = 0.9215;
const COMMISSION_RATE   = 0.015;  // 1.5% flat commission
const PROVIDER_FEE_RATE = 0.005;  // 0.5% provider crypto processing fee
const NETWORK_FEE_USDT  = 0.10;  // blockchain network fee
const FIAT_RATES: Record<string, { rate: number; symbol: string; iban: string }> = {
  EUR: { rate: 0.9215, symbol: "€", iban: "IE29AIBK93115212345678" },
  USD: { rate: 1.00,   symbol: "$", iban: "US29CITI00997712345678" },
  GBP: { rate: 0.79,   symbol: "£", iban: "GB29BARCS93115212345678" },
};
// USD market price per 1 unit of each crypto
const CRYPTO_USD_RATES: Record<string, number> = {
  BTC: 73548, ETH: 2600, USDT: 1.00, USDC: 1.00, SOL: 170, BNB: 580, XRP: 0.52,
};

function CountdownBadge({ seconds }: { seconds: number }) {
  const [rem, setRem] = useState(seconds);
  useEffect(() => {
    const t = setInterval(() => setRem(r => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const m = String(Math.floor(rem / 60)).padStart(2, "0");
  const s = String(rem % 60).padStart(2, "0");
  return (
    <span className={`flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${rem > 120 ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : rem > 30 ? "text-orange-400 border-orange-500/30 bg-orange-500/10" : "text-red-400 border-red-500/30 bg-red-500/10"}`}>
      <Timer className="w-3 h-3" />{m}:{s}
    </span>
  );
}

function CheckoutPopup({ account, onUpdateAcc, onAddIncomeTx, onAddCheckout, onClose }: {
  account: CryptoAcc; onUpdateAcc: (a: CryptoAcc) => void;
  onAddIncomeTx: (tx: IncomeTx) => void;
  onAddCheckout: (o: CheckoutOrder, ex: ExchangeTx, eur: EurIncomingTx) => void;
  onClose: () => void;
}) {
  type Step = "invoice" | "method" | "quote" | "processing" | "done";
  const [step, setStep] = useState<Step>("invoice");
  const [amount, setAmount] = useState("100");
  const [invoiceCurrency, setInvoiceCurrency] = useState("EUR");
  const [description, setDescription] = useState("Online goods and services");
  const [reference, setReference] = useState(`INV-${Date.now().toString(36).toUpperCase()}`);
  const [method, setMethod] = useState("usdt_erc20");
  const [phase, setPhase] = useState(0);
  const [result, setResult] = useState<{ order: CheckoutOrder; t1: IncomeTx; t2: ExchangeTx; t3: EurIncomingTx } | null>(null);

  const sel = PAYMENT_METHODS.find(m => m.id === method)!;
  const fiatRate   = FIAT_RATES[invoiceCurrency]?.rate ?? RATE_USDT_EUR;
  const fiatSym    = FIAT_RATES[invoiceCurrency]?.symbol ?? "€";
  const fiatAmt    = parseFloat(amount) || 100;
  // Real crypto price for BTC/ETH/etc.
  const selCryptoUsdPrice = CRYPTO_USD_RATES[sel.sym ?? "USDT"] ?? 1;
  const selCryptoFiatPrice = selCryptoUsdPrice * fiatRate; // 1 crypto in invoiceCurrency
  const cryptoForFiat = fiatAmt / selCryptoFiatPrice;
  const networkFeeCrypto = (NETWORK_FEE_USDT / selCryptoUsdPrice);
  const usdtRequested = (cryptoForFiat + networkFeeCrypto).toFixed(8);
  const usdtReceived  = cryptoForFiat.toFixed(8);
  const usdtCredited  = cryptoForFiat.toFixed(8);
  const convertedFiat  = (cryptoForFiat * selCryptoFiatPrice).toFixed(2);
  const networkFeeUsdt  = networkFeeCrypto.toFixed(8);
  const providerFeeEur  = (fiatAmt * PROVIDER_FEE_RATE).toFixed(2);
  const commissionEur   = (fiatAmt * COMMISSION_RATE).toFixed(2);
  const totalFeeEur     = (parseFloat(providerFeeEur) + parseFloat(commissionEur)).toFixed(2);
  const netSettlement   = (parseFloat(convertedFiat) - parseFloat(totalFeeEur)).toFixed(2);
  const depositAddr = sel.sym && account.wallets[sel.sym] ? account.wallets[sel.sym].address : `0x${Math.random().toString(16).slice(2, 42)}`;

  async function simulatePayment() {
    setStep("processing");
    const checkoutId = uid("chk");
    const cryptoOpId = uid("cop");
    const t1Id = uid("T1");
    const t2Id = uid("T2");
    const t3Id = uid("T3");
    const customerId = `${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const transferId = `${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const projectReference = `REF${Math.floor(10000 + Math.random() * 90000)}`;
    const projectId = "proj-payd-eur-001";
    const projectIban = "IE29AIBK93115212345678";
    const allocationRef = `ALLOC-${reference}`;

    setPhase(1);
    await sleep(1800);
    const t1: IncomeTx = {
      id: t1Id, transactionType: "CRYPTO_INCOMING",
      transferId, customerId,
      providerPaymentId: uid("bvnk-chpay"),
      requestedCryptoAmount: usdtRequested,
      receivedCryptoAmount: usdtReceived,
      creditedCryptoAmount: usdtCredited,
      cryptoCurrency: sel.sym ?? "USDT",
      network: (sel.net ?? "ETHEREUM (ERC20)").split(" ")[0],
      networkDisplay: (sel.net ?? "").includes("ERC20") ? "ERC20" : (sel.net ?? "").includes("TRC20") ? "TRC20" : (sel.net ?? "").split(" ")[0],
      senderAddress: `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`,
      recipientAddress: depositAddr,
      transactionHash: `0x${Math.random().toString(16).slice(2, 16)}...${Math.random().toString(16).slice(2, 8)}`,
      networkFee: networkFeeUsdt, providerFee: networkFeeUsdt,
      bvnkWalletId: `bvnk-wlt-${(sel.sym ?? "usdt").toLowerCase()}`,
      status: "ACCEPTED", detectedAt: now(), updatedAt: now(), confirmedAt: now(),
      checkout_payment_id: checkoutId,
    };
    onAddIncomeTx(t1);
    setPhase(2);
    await sleep(2000);
    const providerRate = selCryptoFiatPrice;
    const customerExchangeRate = (providerRate * (1 - COMMISSION_RATE - PROVIDER_FEE_RATE)).toFixed(6);
    const projectIbanFiat = FIAT_RATES[invoiceCurrency]?.iban ?? projectIban;
    const t2: ExchangeTx = {
      id: t2Id, transactionType: "CRYPTO_WITHDRAWAL_FX",
      checkout_payment_id: checkoutId,
      source_wallet_id: `bvnk-wlt-${(sel.sym ?? "usdt").toLowerCase()}`,
      crypto_debit_amount: usdtCredited,
      source_currency: sel.sym ?? "USDT",
      target_currency: invoiceCurrency,
      provider_exchange_rate: providerRate.toString(),
      customer_exchange_rate: customerExchangeRate,
      gross_converted_eur: convertedFiat,
      network_fee_usdt: networkFeeUsdt,
      provider_fee_eur: providerFeeEur,
      commission_eur: commissionEur,
      commission_rate: `${(COMMISSION_RATE * 100).toFixed(1)}%`,
      total_fee_eur: totalFeeEur,
      converted_eur_amount: convertedFiat,
      net_settlement_amount: netSettlement,
      provider_transfer_id: uid("bvnk-tfr"),
      provider_payout_id: uid("bvnk-pay"),
      destination_iban: projectIbanFiat,
      allocation_reference: allocationRef,
      t1_reference: t1Id,
      status: "ACCEPTED", created_at: now(),
    };

    setPhase(3);
    await sleep(1800);
    const t3: EurIncomingTx = {
      id: t3Id, transactionType: "MERCHANT_PROJECT_INCOMING_EUR",
      checkout_payment_id: checkoutId,
      currency: invoiceCurrency,
      actual_received_amount: netSettlement,
      total_fee_deducted: totalFeeEur,
      sender_name: "SETTLEMENT PROVIDER",
      sender_account: "GB29SETTL00997712345678",
      beneficiary_iban: projectIbanFiat,
      bank_reference: `SETTL ${allocationRef}`,
      bank_transaction_id: uid("BKTX"),
      project_id: projectId,
      project_balance_posting_id: uid("POST"),
      t2_reference: t2Id,
      status: "ACCEPTED", posted_at: now(),
    };

    const order: CheckoutOrder = {
      checkout_payment_id: checkoutId,
      crypto_operation_id: cryptoOpId,
      merchant_id: "mrch-payd-001",
      project_id: projectId,
      order_reference: reference,
      order_amount: fiatAmt.toFixed(2),
      order_currency: invoiceCurrency,
      selected_crypto_asset: sel.sym ?? "USDT",
      selected_network: sel.net ?? "ETHEREUM (ERC20)",
      crypto_submid_id: `submid-${(sel.id)}`,
      payment_status: "ACCEPTED",
      settlement_status: "ACCEPTED",
      project_iban: projectIbanFiat,
      project_allocation_reference: allocationRef,
      t1_id: t1Id, t2_id: t2Id, t3_id: t3Id,
      created_at: now(),
      customerId, pid: `PID-${checkoutId.slice(-8)}`, type: "CHECKOUT",
      paymentMethod: `${sel.sym ?? "USDT"} (${(sel.net ?? "").split(" ")[0]})`,
      project_reference: projectReference,
      network_fee: networkFeeUsdt, provider_fee_eur: providerFeeEur,
      commission_eur: commissionEur, commission_rate: `${(COMMISSION_RATE * 100).toFixed(1)}%`,
      total_fee_eur: totalFeeEur,
    };

    onAddCheckout(order, t2, t3);
    // T3: credit net settlement to the matching banking balance
    const updAcc = { ...account };
    if (invoiceCurrency === "USD") {
      updAcc.bankingUsdBalance = (parseFloat(account.bankingUsdBalance || "0") + parseFloat(netSettlement)).toFixed(2);
    } else if (invoiceCurrency === "GBP") {
      updAcc.bankingGbpBalance = (parseFloat(account.bankingGbpBalance || "0") + parseFloat(netSettlement)).toFixed(2);
    } else {
      updAcc.bankingEurBalance = (parseFloat(account.bankingEurBalance || "0") + parseFloat(netSettlement)).toFixed(2);
    }
    onUpdateAcc(updAcc);
    setResult({ order, t1, t2, t3 });
    setPhase(4);
    setStep("done");
  }

  const Row = ({ l, v, mono, copy }: { l: string; v: string; mono?: boolean; copy?: boolean }) => (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-zinc-800/60 last:border-0">
      <span className="text-zinc-500 text-xs shrink-0">{l}</span>
      <span className={`text-xs text-right flex items-center gap-1 ${mono ? "font-mono text-zinc-300 text-[10px]" : "text-zinc-200"}`}>{v}{copy && <CopyBtn text={v} />}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget && step !== "processing") onClose(); }}>
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 sticky top-0 bg-zinc-950 z-10">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-indigo-400" />
            <div><p className="font-semibold text-white text-sm">Checkout</p><p className="text-[10px] text-zinc-500">BVNK Embedded · Crypto payment flow</p></div>
          </div>
          {step !== "processing" && <button onClick={onClose} className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center cursor-pointer hover:bg-zinc-700"><X className="w-4 h-4 text-zinc-400" /></button>}
        </div>

        {/* STEP: invoice */}
        {step === "invoice" && (
          <div className="p-4 space-y-3">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Create Invoice</p>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Order reference</label>
              <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 h-8 text-xs text-white outline-none focus:border-indigo-500"
                value={reference} onChange={e => setReference(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Description</label>
              <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 h-8 text-xs text-white outline-none focus:border-indigo-500"
                value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Invoice currency</label>
              <div className="flex gap-1.5">
                {["EUR", "USD", "GBP"].map(ccy => (
                  <button key={ccy} onClick={() => setInvoiceCurrency(ccy)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${invoiceCurrency === ccy ? "border-indigo-500 bg-indigo-500/15 text-white" : "border-zinc-700 text-zinc-400 hover:border-zinc-600"}`}>
                    <CIcon sym={ccy} size={14} />{ccy}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Amount</label>
              <div className="flex gap-2">
                <div className="flex items-center bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 h-8 text-xs text-zinc-400 shrink-0">{invoiceCurrency}</div>
                <input type="number" className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 h-8 text-sm text-white font-semibold outline-none focus:border-indigo-500"
                  value={amount} onChange={e => setAmount(e.target.value)} min="1" />
              </div>
            </div>
            <div className="rounded-xl bg-zinc-800/60 border border-zinc-700 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Order total</span>
                <span className="text-base font-bold text-white">{fiatSym}{(parseFloat(amount) || 0).toFixed(2)} {invoiceCurrency}</span>
              </div>
            </div>
            <button onClick={() => setStep("method")} disabled={!amount || parseFloat(amount) <= 0}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 cursor-pointer flex items-center justify-center gap-2">
              Choose payment method <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP: method */}
        {step === "method" && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Payment Method</p>
              <span className="text-sm font-bold text-white">{fiatSym}{(parseFloat(amount) || 0).toFixed(2)} {invoiceCurrency}</span>
            </div>
            <p className="text-[10px] text-zinc-500 uppercase font-semibold">Fiat</p>
            <div className="space-y-1.5">
              {PAYMENT_METHODS.filter(m => m.category === "fiat").map(pm => (
                <button key={pm.id} onClick={() => setMethod(pm.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all text-left ${method === pm.id ? "border-indigo-500 bg-indigo-500/10" : "border-zinc-700 hover:border-zinc-600"}`}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-zinc-700 flex items-center justify-center text-xs font-bold text-white">{pm.icon}</div>
                    <span className="text-xs font-medium text-white">{pm.label}</span>
                  </div>
                  <span className="text-[10px] text-zinc-500">{pm.desc}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-zinc-500 uppercase font-semibold pt-1">Crypto</p>
            <div className="space-y-1.5">
              {PAYMENT_METHODS.filter(m => m.category === "crypto").map(pm => (
                <button key={pm.id} onClick={() => setMethod(pm.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all text-left ${method === pm.id ? "border-indigo-500 bg-indigo-500/10" : "border-zinc-700 hover:border-zinc-600"}`}>
                  <div className="flex items-center gap-2.5">
                    <CIcon sym={pm.sym ?? "USDT"} size={26} />
                    <div>
                      <span className="text-xs font-medium text-white">{pm.label}</span>
                      <p className="text-[10px] text-zinc-500">{pm.net}</p>
                    </div>
                  </div>
                  {method === pm.id && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setStep("invoice")} className="px-4 border border-zinc-700 text-zinc-400 text-sm rounded-xl py-2.5 cursor-pointer hover:bg-zinc-800">Back</button>
              <button onClick={() => sel.category === "crypto" ? setStep("quote") : undefined}
                disabled={sel.category !== "crypto"}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 cursor-pointer flex items-center justify-center gap-2">
                {sel.category === "crypto" ? <>Get quote <ArrowRight className="w-4 h-4" /></> : "Fiat — not available in demo"}
              </button>
            </div>
          </div>
        )}

        {/* STEP: quote */}
        {step === "quote" && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Payment Quote</p>
              <CountdownBadge seconds={3600} />
            </div>
            {/* EUR settlement breakdown */}
            <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-3 space-y-1.5">
              <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">{invoiceCurrency} Settlement Breakdown</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-300 font-semibold">Invoice amount</span>
                <span className="text-xs font-bold text-white">{fiatSym}{(parseFloat(amount) || 0).toFixed(2)} {invoiceCurrency}</span>
              </div>
              <div className="border-t border-zinc-700/60 mt-1 pt-1.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Network fee</span>
                  <span className="text-xs text-zinc-400">+{NETWORK_FEE_USDT.toFixed(6)} {sel.sym}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Fee ({(PROVIDER_FEE_RATE * 100).toFixed(1)}%)</span>
                  <span className="text-xs font-semibold text-orange-400">-{fiatSym}{providerFeeEur}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Commission ({(COMMISSION_RATE * 100).toFixed(1)}%)</span>
                  <span className="text-xs font-semibold text-orange-400">-{fiatSym}{commissionEur}</span>
                </div>
                <div className="flex items-center justify-between border-t border-zinc-700 pt-1.5">
                  <span className="text-xs text-zinc-500">Total fees</span>
                  <span className="text-xs text-orange-400 font-semibold">-{fiatSym}{totalFeeEur} {invoiceCurrency}</span>
                </div>
              </div>
              <div className="border-t border-zinc-600 pt-2 flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-200">Project receives</span>
                <span className="text-base font-bold text-emerald-400">{fiatSym}{netSettlement} {invoiceCurrency}</span>
              </div>
            </div>
            {/* Crypto payment details */}
            <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-3 space-y-1.5">
              <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Crypto Payment Details</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Exchange rate</span>
                <span className="text-xs text-white font-semibold">1 {sel.sym} = {fiatSym}{selCryptoFiatPrice.toFixed(2)} {invoiceCurrency}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Network fee</span>
                <span className="text-xs text-zinc-400">+{networkFeeUsdt} {sel.sym}</span>
              </div>
              <div className="border-t border-zinc-700 pt-1.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300">Customer sends</span>
                <div className="text-right">
                  <p className="text-base font-bold text-indigo-300">{usdtRequested} {sel.sym}</p>
                  <p className="text-[10px] text-zinc-500">{sel.net}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-lg px-2 py-1">
                <Clock className="w-3 h-3" />Rate locked for 1 hour. Send exact amount only.
              </div>
            </div>
            <div className="flex justify-center py-1"><QRMock data={depositAddr} size={140} /></div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Send to address ({sel.sym} · {sel.net})</label>
              <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2">
                <span className="text-[10px] font-mono text-zinc-300 flex-1 truncate">{depositAddr}</span>
                <CopyBtn text={depositAddr} />
              </div>
            </div>
            <p className="text-[10px] text-zinc-600 text-center">Only send {sel.sym} on {(sel.net ?? "").split(" ")[0]} network. Other assets may be permanently lost.</p>
            <div className="flex gap-2">
              <button onClick={() => setStep("method")} className="px-4 border border-zinc-700 text-zinc-400 text-sm rounded-xl py-2.5 cursor-pointer hover:bg-zinc-800">Back</button>
              <button onClick={simulatePayment}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl py-2.5 cursor-pointer flex items-center justify-center gap-2">
                Simulate payment → <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP: processing */}
        {step === "processing" && (
          <div className="p-6 space-y-4">
            <div className="text-center mb-2">
              <Loader2 className="w-9 h-9 text-indigo-400 animate-spin mx-auto mb-2" />
              <p className="text-sm font-semibold text-white">Processing checkout…</p>
              <p className="text-xs text-zinc-500">Please wait, do not close this window</p>
            </div>
            <div className="space-y-2">
              {[
                { ph: 1, l: "T1 — Crypto incoming", sub: `+${usdtReceived} ${sel.sym} (network fee: ${networkFeeUsdt} ${sel.sym})` },
                { ph: 2, l: `T2 — FX exchange (${sel.sym}→${invoiceCurrency})`, sub: `Gross ${fiatSym}${convertedFiat} − fee ${fiatSym}${providerFeeEur} − commission ${fiatSym}${commissionEur} = ${fiatSym}${netSettlement}` },
                { ph: 3, l: `T3 — ${invoiceCurrency} incoming to Project Account`, sub: `${fiatSym}${netSettlement} ${invoiceCurrency} net · ref: T2` },
              ].map(item => (
                <div key={item.ph} className={`flex items-start gap-3 p-3 rounded-xl border ${phase > item.ph ? "border-emerald-500/30 bg-emerald-500/5" : phase === item.ph ? "border-indigo-500/30 bg-indigo-500/5" : "border-zinc-800"}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${phase > item.ph ? "bg-emerald-600" : phase === item.ph ? "bg-indigo-600" : "bg-zinc-800"}`}>
                    {phase > item.ph ? <Check className="w-3.5 h-3.5 text-white" /> : phase === item.ph ? <Loader2 className="w-3 h-3 text-white animate-spin" /> : <div className="w-2 h-2 rounded-full bg-zinc-600" />}
                  </div>
                  <div><p className={`text-xs font-semibold ${phase >= item.ph ? "text-white" : "text-zinc-600"}`}>{item.l}</p><p className={`text-[10px] ${phase >= item.ph ? "text-zinc-400" : "text-zinc-700"}`}>{item.sub}</p></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP: done */}
        {step === "done" && result && (
          <div className="p-4 space-y-3">
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-full bg-emerald-600/20 border-2 border-emerald-500 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <p className="text-sm font-bold text-white">Checkout complete!</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">3 transactions created · Reference: {reference}</p>
            </div>
            <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-3 space-y-1.5">
              <Row l="Checkout ID" v={result.order.checkout_payment_id} mono copy />
              <Row l="Crypto Operation" v={result.order.crypto_operation_id} mono />
              <Row l="Project Reference" v={result.order.project_reference} mono copy />
              <Row l="Order Reference" v={result.order.order_reference} />
              <Row l="Order Amount (invoice)" v={`${FIAT_RATES[result.order.order_currency]?.symbol ?? ""}${result.order.order_amount} ${result.order.order_currency}`} />
              <Row l={`↳ Network fee`} v={`+${result.t2.network_fee_usdt} ${result.t1.cryptoCurrency}`} />
              <Row l={`↳ Fee (${(PROVIDER_FEE_RATE * 100).toFixed(1)}%)`} v={`-${FIAT_RATES[result.order.order_currency]?.symbol ?? ""}${result.t2.provider_fee_eur} ${result.order.order_currency}`} />
              <Row l={`↳ Commission (${result.t2.commission_rate})`} v={`-${FIAT_RATES[result.order.order_currency]?.symbol ?? ""}${result.t2.commission_eur} ${result.order.order_currency}`} />
              <Row l="Project receives" v={`${FIAT_RATES[result.order.order_currency]?.symbol ?? ""}${result.t3.actual_received_amount} ${result.order.order_currency}`} />
              <Row l="Payment Status" v={result.order.payment_status} />
              <Row l="Settlement Status" v={result.order.settlement_status} />
              <Row l="Project IBAN" v={result.order.project_iban} mono copy />
            </div>
            <div className="space-y-2">
              {[
                { label: "T1 · Crypto Incoming", id: result.t1.id, detail: `+${result.t1.receivedCryptoAmount} ${result.t1.cryptoCurrency} · network fee: ${result.t1.networkFee ?? result.t1.providerFee} ${result.t1.cryptoCurrency}`, color: "emerald" },
                { label: "T2 · FX Exchange", id: result.t2.id, detail: `${result.t2.crypto_debit_amount} ${result.t2.source_currency} @ ${parseFloat(result.t2.customer_exchange_rate).toFixed(4)} ${result.t2.target_currency} (−${((parseFloat(result.t2.provider_exchange_rate) - parseFloat(result.t2.customer_exchange_rate)) / parseFloat(result.t2.provider_exchange_rate) * 100).toFixed(2)}% markup) → ${FIAT_RATES[result.t2.target_currency]?.symbol ?? ""}${result.t2.gross_converted_eur}`, color: "blue" },
                { label: `T3 · ${result.order.order_currency} Incoming`, id: result.t3.id, detail: `${FIAT_RATES[result.t3.currency]?.symbol ?? ""}${result.t3.actual_received_amount} ${result.t3.currency} credited to Project · fee ${FIAT_RATES[result.t3.currency]?.symbol ?? ""}${result.t3.total_fee_deducted} deducted · ref T2: ${result.t2.id.slice(0, 12)}…`, color: "indigo" },
              ].map(item => (
                <div key={item.id} className={`flex items-start gap-2.5 p-2.5 rounded-xl border border-${item.color}-500/20 bg-${item.color}-500/5`}>
                  <CheckCircle2 className={`w-4 h-4 text-${item.color}-400 shrink-0 mt-0.5`} />
                  <div><p className={`text-xs font-semibold text-${item.color}-400`}>{item.label}</p><p className="text-[10px] text-zinc-400">{item.detail}</p><p className="text-[9px] font-mono text-zinc-600">{item.id}</p></div>
                </div>
              ))}
            </div>
            <button onClick={onClose} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl py-2.5 cursor-pointer">
              Done — view in Transactions
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   UNIFIED WITHDRAW POPUP  (input → quote → processing → done)
════════════════════════════════════════════ */
function UnifiedWithdrawPopup({ account, onUpdateAcc, onAddTx, onAddWithdrawal, defaultSource, onClose }: {
  account: CryptoAcc; onUpdateAcc: (a: CryptoAcc) => void;
  onAddTx: (tx: IncomeTx) => void;
  onAddWithdrawal: (w: WithdrawalTx) => void;
  defaultSource?: string;
  onClose: () => void;
}) {
  const walletKeys = Object.keys(account.wallets);
  const initSource = defaultSource ?? (walletKeys[0] ?? "banking_EUR");
  const [source, setSource] = useState(initSource);
  type DestType = "banking" | "wallet" | "external";
  const [destType, setDestType] = useState<DestType>(initSource.startsWith("banking_") ? "wallet" : "banking");
  const [targetCrypto, setTargetCrypto] = useState(walletKeys[0] ?? "USDT");
  const [withdrawCurrency, setWithdrawCurrency] = useState("EUR");
  const [amount, setAmount] = useState(() =>
    initSource.startsWith("banking_") ? "100" : parseFloat(account.wallets[initSource]?.balance || "0").toFixed(6)
  );
  const [extAddress, setExtAddress] = useState("");
  const [step, setStep] = useState<"input" | "quote" | "processing" | "done">("input");
  const [procPhase, setProcPhase] = useState(0);
  const [doneData, setDoneData] = useState<{ label: string; txId: string; rows: [string, string, string?][] } | null>(null);

  const isBanking = source.startsWith("banking_");
  const sourceCcy = isBanking ? source.replace("banking_", "") : "";
  const cryptoSym = isBanking ? targetCrypto : source;
  const sourceFiatRate = FIAT_RATES[sourceCcy] ?? FIAT_RATES.EUR;
  const bankingBal = isBanking
    ? (sourceCcy === "USD" ? parseFloat(account.bankingUsdBalance || "0")
      : sourceCcy === "GBP" ? parseFloat(account.bankingGbpBalance || "0")
      : parseFloat(account.bankingEurBalance || "0"))
    : 0;
  const cryptoBal = isBanking ? 0 : parseFloat(account.wallets[source]?.balance || "0");


  // fiat rates for the chosen withdrawal currency
  const wdFiatRate = FIAT_RATES[withdrawCurrency]?.rate ?? FIAT_RATES.EUR.rate;
  const wdFiatSym  = FIAT_RATES[withdrawCurrency]?.symbol ?? "€";

  // per-crypto USD price → fiat price
  const cryptoUsdRate  = CRYPTO_USD_RATES[cryptoSym] ?? 1;
  const cryptoFiatRate = cryptoUsdRate * wdFiatRate; // how many fiat units = 1 crypto

  // Banking → crypto derived values
  const eurAmt = parseFloat(amount) || 0;
  const bNetFeeUsdt   = NETWORK_FEE_USDT.toFixed(6);
  const bProvFee      = (eurAmt * PROVIDER_FEE_RATE).toFixed(2);
  const bCommFee      = (eurAmt * COMMISSION_RATE).toFixed(2);
  const bTotalFee     = (parseFloat(bProvFee) + parseFloat(bCommFee)).toFixed(2);
  const bNetFiat      = (eurAmt - parseFloat(bTotalFee)).toFixed(2);
  // Legacy aliases for quote display
  const bProvFeeEur = bProvFee;
  const bCommEur    = bCommFee;
  const bNetEur     = bNetFiat;
  // Convert net fiat → target crypto
  const bCryptoUsdRate = CRYPTO_USD_RATES[targetCrypto] ?? 1;
  const bCryptoFiatRate = bCryptoUsdRate * (sourceFiatRate.rate);
  const bCryptoEurRate  = bCryptoFiatRate; // kept for display
  const bCryptoRcvd   = (parseFloat(bNetFiat) / bCryptoFiatRate).toFixed(8);
  const bDepositAddr  = account.wallets[targetCrypto]?.address ?? `0x${Math.random().toString(16).slice(2, 42)}`;

  // Crypto → project balance derived values (use real crypto rate)
  const cryptoAmt  = parseFloat(amount) || 0;
  const cNetFeeUsd = NETWORK_FEE_USDT * (1 / cryptoUsdRate); // network fee expressed in crypto units
  const cNetFee    = cNetFeeUsd.toFixed(8);
  const cProvFee   = (cryptoAmt * PROVIDER_FEE_RATE).toFixed(8);
  const cCommFee   = (cryptoAmt * COMMISSION_RATE).toFixed(8);
  const cNetCrypto = Math.max(0, cryptoAmt - parseFloat(cNetFee) - parseFloat(cProvFee) - parseFloat(cCommFee)).toFixed(8);
  const cNetFiat   = (parseFloat(cNetCrypto) * cryptoFiatRate).toFixed(2);

  const bankBalForCcy = withdrawCurrency === "USD" ? parseFloat(account.bankingUsdBalance || "0")
    : withdrawCurrency === "GBP" ? parseFloat(account.bankingGbpBalance || "0")
    : parseFloat(account.bankingEurBalance || "0");

  const inputValid = isBanking
    ? (eurAmt > 0 && eurAmt <= bankingBal)
    : (cryptoAmt > 0 && cryptoAmt <= cryptoBal && (destType !== "external" || extAddress.trim().length > 10));

  async function executeWithdraw() {
    setStep("processing");
    setProcPhase(1);
    const customerId = `${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const transferId = `${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const wdId = uid("WD");

    await sleep(1200);
    setProcPhase(2);
    await sleep(1000);
    setProcPhase(3);

    if (isBanking) {
      // Banking → crypto wallet
      const tId = uid("T1");
      const t1: IncomeTx = {
        id: tId, transactionType: "CRYPTO_INCOMING", transferId, customerId,
        providerPaymentId: uid("wdpay"), requestedCryptoAmount: bCryptoRcvd,
        receivedCryptoAmount: bCryptoRcvd, creditedCryptoAmount: bCryptoRcvd,
        cryptoCurrency: targetCrypto, network: "ETHEREUM", networkDisplay: "ERC20",
        senderAddress: "WITHDRAWAL PROVIDER", recipientAddress: bDepositAddr,
        transactionHash: `0x${Math.random().toString(16).slice(2, 16)}...${Math.random().toString(16).slice(2, 8)}`,
        networkFee: bNetFeeUsdt, providerFee: bNetFeeUsdt,
        providerFeeEur: bProvFeeEur, commissionEur: bCommEur, commissionRate: `${(COMMISSION_RATE * 100).toFixed(1)}%`,
        bvnkWalletId: `bvnk-wlt-${targetCrypto.toLowerCase()}`,
        status: "ACCEPTED", detectedAt: now(), updatedAt: now(), confirmedAt: now(),
      };
      onAddTx(t1);
      const wd: WithdrawalTx = {
        id: wdId, transactionType: "FIAT_TO_CRYPTO_WITHDRAWAL", direction: "FIAT_TO_CRYPTO",
        customerId, transferId: uid("WDTRF"), pid: `PID-${wdId.slice(-8)}`,
        paymentMethod: `Banking ${sourceCcy} → ${targetCrypto}`, status: "ACCEPTED",
        eurAmount: eurAmt.toFixed(2), networkFeeUsdt: bNetFeeUsdt,
        providerFeeEur: bProvFeeEur, commissionEur: bCommEur, commissionRate: `${(COMMISSION_RATE * 100).toFixed(1)}%`,
        totalFeeEur: bTotalFee, netCryptoAmount: bCryptoRcvd,
        targetCurrency: targetCrypto, targetNetwork: "ETHEREUM (ERC20)",
        depositAddress: bDepositAddr, conversionRate: bCryptoFiatRate.toFixed(2),
        t1_reference: tId, sourceBankAccount: `Banking ${sourceCcy} Account`,
        createdAt: now(), updatedAt: now(),
      };
      onAddWithdrawal(wd);
      const updWallets = { ...account.wallets };
      if (updWallets[targetCrypto]) updWallets[targetCrypto] = { ...updWallets[targetCrypto], balance: (parseFloat(updWallets[targetCrypto].balance || "0") + parseFloat(bCryptoRcvd)).toFixed(8) };
      const updAccCrypto = { ...account, wallets: updWallets };
      if (sourceCcy === "USD") updAccCrypto.bankingUsdBalance = (bankingBal - eurAmt).toFixed(2);
      else if (sourceCcy === "GBP") updAccCrypto.bankingGbpBalance = (bankingBal - eurAmt).toFixed(2);
      else updAccCrypto.bankingEurBalance = (bankingBal - eurAmt).toFixed(2);
      onUpdateAcc(updAccCrypto);
      setDoneData({ label: `Banking ${sourceCcy} → ${targetCrypto}`, txId: wdId, rows: [
        ["Withdrawal ID", wdId, "mono"],
        [`${sourceCcy} spent`, `${sourceFiatRate.symbol}${eurAmt.toFixed(2)}`],
        ["Provider fee (0.5%)", `-${sourceFiatRate.symbol}${bProvFeeEur}`],
        ["Commission (1.5%)", `-${sourceFiatRate.symbol}${bCommEur}`],
        ["Exchange rate", `1 ${targetCrypto} = ${sourceFiatRate.symbol}${bCryptoFiatRate.toFixed(2)}`],
        [`${targetCrypto} received`, `+${bCryptoRcvd} ${targetCrypto}`, "positive"],
      ]});

    } else if (destType === "banking") {
      // Crypto → banking wallet (chosen currency)
      const wd: WithdrawalTx = {
        id: wdId, transactionType: "CRYPTO_TO_EUR_WITHDRAWAL", direction: "CRYPTO_TO_EUR",
        customerId, transferId, pid: `PID-${wdId.slice(-8)}`,
        paymentMethod: `${source} → Banking ${withdrawCurrency}`, status: "ACCEPTED",
        eurAmount: cNetFiat, networkFeeUsdt: cNetFee,
        providerFeeEur: (parseFloat(cProvFee) * cryptoFiatRate).toFixed(2),
        commissionEur: (parseFloat(cCommFee) * cryptoFiatRate).toFixed(2),
        commissionRate: `${(COMMISSION_RATE * 100).toFixed(1)}%`,
        totalFeeEur: ((parseFloat(cProvFee) + parseFloat(cCommFee)) * cryptoFiatRate).toFixed(2),
        netCryptoAmount: cNetCrypto, targetCurrency: withdrawCurrency, targetNetwork: "SEPA",
        depositAddress: FIAT_RATES[withdrawCurrency]?.iban ?? "—", conversionRate: cryptoFiatRate.toFixed(2),
        sourceBankAccount: `${source} Wallet`,
        cryptoAmount: cryptoAmt.toFixed(8), cryptoCurrency: source,
        networkFeeCrypto: cNetFee, providerFeeCrypto: cProvFee, commissionCrypto: cCommFee,
        netEurAmount: cNetFiat, createdAt: now(), updatedAt: now(),
      };
      onAddWithdrawal(wd);
      const updWallets = { ...account.wallets };
      if (updWallets[source]) updWallets[source] = { ...updWallets[source], balance: Math.max(0, cryptoBal - cryptoAmt).toFixed(8) };
      const updAcc = { ...account, wallets: updWallets };
      if (withdrawCurrency === "USD") updAcc.bankingUsdBalance = (parseFloat(account.bankingUsdBalance || "0") + parseFloat(cNetFiat)).toFixed(2);
      else if (withdrawCurrency === "GBP") updAcc.bankingGbpBalance = (parseFloat(account.bankingGbpBalance || "0") + parseFloat(cNetFiat)).toFixed(2);
      else updAcc.bankingEurBalance = (parseFloat(account.bankingEurBalance || "0") + parseFloat(cNetFiat)).toFixed(2);
      onUpdateAcc(updAcc);
      setDoneData({ label: `${source} → Banking ${withdrawCurrency}`, txId: wdId, rows: [
        ["Withdrawal ID", wdId, "mono"],
        [`${source} withdrawn`, `${cryptoAmt.toFixed(8)} ${source}`],
        ["Network fee", `-${cNetFee} ${source}`],
        ["Provider fee (0.5%)", `-${cProvFee} ${source}`],
        ["Commission (1.5%)", `-${cCommFee} ${source}`],
        ["Exchange rate", `1 ${source} = ${wdFiatSym}${cryptoFiatRate.toFixed(2)}`],
        [`Banking ${withdrawCurrency} credited`, `+${wdFiatSym}${cNetFiat}`, "positive"],
      ]});

    } else {
      // Crypto → external wallet
      await sleep(800);
      setProcPhase(4);
      await sleep(1200);
      const hash = `0x${Math.random().toString(16).slice(2, 16)}${Math.random().toString(16).slice(2, 16)}`;
      const wd: WithdrawalTx = {
        id: wdId, transactionType: "CRYPTO_TO_EXTERNAL_WITHDRAWAL", direction: "CRYPTO_TO_EXTERNAL",
        customerId, transferId, pid: `PID-${wdId.slice(-8)}`,
        paymentMethod: `${source} → External Wallet`, status: "ACCEPTED",
        eurAmount: "0", networkFeeUsdt: cNetFee,
        providerFeeEur: (parseFloat(cProvFee) * cryptoFiatRate).toFixed(2),
        commissionEur: (parseFloat(cCommFee) * cryptoFiatRate).toFixed(2),
        commissionRate: `${(COMMISSION_RATE * 100).toFixed(1)}%`,
        totalFeeEur: ((parseFloat(cProvFee) + parseFloat(cCommFee)) * cryptoFiatRate).toFixed(2),
        netCryptoAmount: cNetCrypto, targetCurrency: source, targetNetwork: "BLOCKCHAIN",
        depositAddress: extAddress.trim(), conversionRate: "1",
        sourceBankAccount: `${source} Wallet`,
        cryptoAmount: cryptoAmt.toFixed(8), cryptoCurrency: source,
        networkFeeCrypto: cNetFee, providerFeeCrypto: cProvFee, commissionCrypto: cCommFee,
        externalAddress: extAddress.trim(), txHash: hash,
        createdAt: now(), updatedAt: now(),
      };
      onAddWithdrawal(wd);
      const updWallets = { ...account.wallets };
      if (updWallets[source]) updWallets[source] = { ...updWallets[source], balance: Math.max(0, cryptoBal - cryptoAmt).toFixed(8) };
      onUpdateAcc({ ...account, wallets: updWallets });
      setDoneData({ label: `${source} → External Wallet`, txId: wdId, rows: [
        ["Withdrawal ID", wdId, "mono"],
        [`${source} sent`, `${cNetCrypto} ${source}`],
        ["Network fee", `-${cNetFee} ${source}`],
        ["Provider fee (0.5%)", `-${cProvFee} ${source}`],
        ["Commission (1.5%)", `-${cCommFee} ${source}`],
        ["Destination", extAddress.trim().slice(0, 20) + "…", "mono"],
        ["Tx Hash", hash.slice(0, 24) + "…", "mono"],
      ]});
    }

    await sleep(400);
    setStep("done");
  }

  /* ── STEP INDICATORS ── */
  const steps = ["Details", "Quote", "Confirm", "Done"];
  const stepIdx = step === "input" ? 0 : step === "quote" ? 1 : step === "processing" ? 2 : 3;

  /* ── DONE SCREEN ── */
  if (step === "done" && doneData) return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl p-5 max-h-[92vh] overflow-y-auto">
        <div className="text-center py-2 mb-4">
          <div className="w-14 h-14 rounded-full bg-emerald-600/20 border-2 border-emerald-500 flex items-center justify-center mx-auto mb-3"><CheckCircle2 className="w-7 h-7 text-emerald-400" /></div>
          <p className="text-base font-bold text-white">Withdrawal complete</p>
          <p className="text-xs text-zinc-500 mt-0.5">{doneData.label}</p>
        </div>
        {destType === "external" && !isBanking && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 mb-3 flex items-start gap-2">
            <span className="text-orange-400 text-sm shrink-0">⚠</span>
            <p className="text-[10px] text-orange-300">Crypto transfers are <strong>irreversible</strong>. The funds cannot be recalled once confirmed on-chain.</p>
          </div>
        )}
        <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-3 space-y-2 mb-4">
          {doneData.rows.map(([k, v, hint]) => (
            <div key={k} className="flex justify-between items-baseline">
              <span className="text-xs text-zinc-400">{k}</span>
              <span className={`text-xs ${hint === "positive" ? "text-emerald-400 font-bold" : hint === "mono" ? "text-zinc-300 font-mono text-[9px]" : "text-white"}`}>{v}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl py-2.5 cursor-pointer">View Transactions</button>
        </div>
      </div>
    </div>
  );

  /* ── PROCESSING SCREEN ── */
  if (step === "processing") {
    const procSteps = destType === "external"
      ? ["Validating request", "Deducting wallet balance", "Broadcasting to blockchain", "Awaiting confirmation"]
      : ["Validating request", "Deducting balance", "Crediting destination"];
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl p-5">
          <div className="text-center mb-5">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-2" />
            <p className="text-sm font-semibold text-white">Processing withdrawal…</p>
          </div>
          <div className="space-y-3">
            {procSteps.map((l, i) => {
              const ph = i + 1;
              const done2 = procPhase > ph;
              const active = procPhase === ph;
              return (
                <div key={l} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${done2 ? "bg-emerald-600/20 border border-emerald-500" : active ? "bg-indigo-600/20 border border-indigo-500" : "bg-zinc-800 border border-zinc-700"}`}>
                    {done2 ? <Check className="w-3 h-3 text-emerald-400" /> : active ? <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" /> : <div className="w-2 h-2 rounded-full bg-zinc-700" />}
                  </div>
                  <div className="flex-1">
                    <p className={`text-xs font-medium ${done2 ? "text-emerald-400" : active ? "text-white" : "text-zinc-600"}`}>{l}</p>
                    {done2 && <p className="text-[10px] text-zinc-500 mt-0.5">Completed</p>}
                    {active && <p className="text-[10px] text-indigo-400 mt-0.5">In progress…</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget && step === "input") onClose(); }}>
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 sticky top-0 bg-zinc-950 z-10">
          <div className="flex items-center gap-2">
            {step === "quote" && <button onClick={() => setStep("input")} className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center cursor-pointer hover:bg-zinc-700 mr-1"><ChevronLeft className="w-4 h-4 text-zinc-400" /></button>}
            <ArrowUpRight className="w-4 h-4 text-orange-400" />
            <div>
              <p className="font-semibold text-white text-sm">Withdraw</p>
              <p className="text-[10px] text-zinc-500">{step === "input" ? "Enter withdrawal details" : "Review quote"}</p>
            </div>
          </div>
          {step === "input" && <button onClick={onClose} className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center cursor-pointer hover:bg-zinc-700"><X className="w-4 h-4 text-zinc-400" /></button>}
        </div>

        {/* Step pills */}
        <div className="flex gap-0 px-4 pt-3">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className={`flex items-center gap-1 ${i === stepIdx ? "text-white" : i < stepIdx ? "text-emerald-400" : "text-zinc-600"}`}>
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold border ${i === stepIdx ? "border-indigo-500 bg-indigo-500/20 text-indigo-300" : i < stepIdx ? "border-emerald-500 bg-emerald-500/20" : "border-zinc-700 bg-zinc-900"}`}>
                  {i < stepIdx ? <Check className="w-2.5 h-2.5" /> : i + 1}
                </div>
                <span className="text-[10px] font-medium hidden sm:block">{s}</span>
              </div>
              {i < steps.length - 1 && <div className={`flex-1 h-px mx-1 ${i < stepIdx ? "bg-emerald-700" : "bg-zinc-800"}`} />}
            </div>
          ))}
        </div>

        <div className="p-4 space-y-3">
          {/* ── INPUT STEP ── */}
          {step === "input" && (
            <>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">From</label>
                <select value={source} onChange={e => { const v = e.target.value; setSource(v); setDestType(v.startsWith("banking_") ? "wallet" : "banking"); setAmount(v.startsWith("banking_") ? "100" : parseFloat(account.wallets[v]?.balance || "0").toFixed(6)); }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 h-9 text-sm text-white outline-none focus:border-indigo-500 cursor-pointer">
                  <optgroup label="Banking Accounts">
                    <option value="banking_EUR">Banking EUR — €{parseFloat(account.bankingEurBalance || "0").toLocaleString("en-GB", { minimumFractionDigits: 2 })}</option>
                    <option value="banking_USD">Banking USD — ${parseFloat(account.bankingUsdBalance || "0").toLocaleString("en-GB", { minimumFractionDigits: 2 })}</option>
                    <option value="banking_GBP">Banking GBP — £{parseFloat(account.bankingGbpBalance || "0").toLocaleString("en-GB", { minimumFractionDigits: 2 })}</option>
                  </optgroup>
                  {walletKeys.length > 0 && (
                    <optgroup label="Crypto Wallets">
                      {walletKeys.map(sym => (
                        <option key={sym} value={sym}>{sym} Wallet — {parseFloat(account.wallets[sym]?.balance || "0").toFixed(8)} {sym}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {!isBanking && (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Destination</label>
                    <div className="flex gap-1.5">
                      <button onClick={() => setDestType("banking")}
                        className={`flex-1 py-2 text-xs font-semibold rounded-lg border cursor-pointer transition-all ${destType === "banking" ? "border-indigo-500 bg-indigo-500/15 text-white" : "border-zinc-700 text-zinc-400 hover:border-zinc-600"}`}>
                        → Banking Wallet
                      </button>
                      <button onClick={() => setDestType("external")}
                        className={`flex-1 py-2 text-xs font-semibold rounded-lg border cursor-pointer transition-all ${destType === "external" ? "border-orange-500 bg-orange-500/10 text-orange-300" : "border-zinc-700 text-zinc-400 hover:border-zinc-600"}`}>
                        → External Wallet
                      </button>
                    </div>
                  </div>
                  {destType === "banking" && (
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Receive currency</label>
                      <div className="flex gap-1.5">
                        {(["EUR", "USD", "GBP"] as const).map(ccy => (
                          <button key={ccy} onClick={() => setWithdrawCurrency(ccy)}
                            className={`flex-1 py-2 text-xs font-semibold rounded-lg border cursor-pointer transition-all ${withdrawCurrency === ccy ? "border-indigo-500 bg-indigo-500/15 text-white" : "border-zinc-700 text-zinc-400 hover:border-zinc-600"}`}>
                            {FIAT_RATES[ccy].symbol} {ccy}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-1">
                        Banking {withdrawCurrency} balance: {FIAT_RATES[withdrawCurrency].symbol}{bankBalForCcy.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {isBanking && (
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Target crypto</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {(walletKeys.length > 0 ? walletKeys : ["USDT"]).map(sym => (
                      <button key={sym} onClick={() => setTargetCrypto(sym)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs cursor-pointer transition-all ${targetCrypto === sym ? "border-indigo-500 bg-indigo-500/15 text-white" : "border-zinc-700 text-zinc-400 hover:border-zinc-600"}`}>
                        <CIcon sym={sym} size={14} />{sym}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Amount ({isBanking ? sourceCcy : cryptoSym})</label>
                <div className="relative">
                  <input type="number"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 h-10 text-sm text-white font-semibold outline-none focus:border-indigo-500 pr-16"
                    value={amount} onChange={e => setAmount(e.target.value)} min="0.000001" step="0.000001" />
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-indigo-400 hover:text-indigo-300 cursor-pointer px-1.5 py-0.5 rounded bg-indigo-500/10"
                    onClick={() => setAmount(isBanking ? bankingBal.toFixed(2) : cryptoBal.toFixed(6))}>MAX</button>
                </div>
                {isBanking && eurAmt > bankingBal && <p className="text-[10px] text-red-400 mt-0.5">Exceeds banking balance ({sourceFiatRate.symbol}{bankingBal.toFixed(2)})</p>}
                {!isBanking && cryptoAmt > cryptoBal && <p className="text-[10px] text-red-400 mt-0.5">Exceeds wallet balance ({cryptoBal.toFixed(6)} {source})</p>}
              </div>

              {!isBanking && destType === "external" && (
                <>
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 flex items-start gap-2">
                    <span className="text-orange-400 text-sm shrink-0 mt-0.5">⚠</span>
                    <p className="text-[10px] text-orange-300 leading-relaxed">Crypto transfers are <strong>irreversible</strong>. Once broadcast to the blockchain, funds cannot be recalled or reversed. Verify the destination address carefully before proceeding.</p>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Destination address ({cryptoSym})</label>
                    <input type="text"
                      placeholder={`Enter ${cryptoSym} wallet address`}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 h-8 text-xs text-white font-mono outline-none focus:border-indigo-500"
                      value={extAddress} onChange={e => setExtAddress(e.target.value)} />
                    {extAddress && extAddress.trim().length < 10 && <p className="text-[10px] text-red-400 mt-0.5">Address too short</p>}
                  </div>
                </>
              )}

              <button onClick={() => setStep("quote")} disabled={!inputValid}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 cursor-pointer flex items-center justify-center gap-2">
                Get Quote <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {/* ── QUOTE STEP ── */}
          {step === "quote" && (
            <>
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-3 mb-1">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider">Quote Summary</p>
                  <span className="text-[9px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded px-1.5 py-0.5">Rate locked · 60s</span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <CIcon sym={isBanking ? sourceCcy : cryptoSym} size={20} />
                    <span className="text-sm font-bold text-white">{isBanking ? `${sourceFiatRate.symbol}${eurAmt.toFixed(2)}` : `${cryptoAmt.toFixed(6)} ${source}`}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-500" />
                  <div className="flex items-center gap-1.5">
                    <CIcon sym={isBanking ? targetCrypto : destType === "banking" ? withdrawCurrency : cryptoSym} size={20} />
                    <span className="text-sm font-bold text-emerald-400">
                      {isBanking ? `${bCryptoRcvd} ${targetCrypto}` : destType === "banking" ? `${wdFiatSym}${cNetFiat}` : `${cNetCrypto} ${source}`}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-zinc-700 pt-2.5">
                  {isBanking ? (
                    <>
                      <div className="flex justify-between text-xs"><span className="text-zinc-400">Amount ({sourceCcy})</span><span className="text-white">{sourceFiatRate.symbol}{eurAmt.toFixed(2)}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-zinc-400">Network fee ({targetCrypto})</span><span className="text-zinc-400">{bNetFeeUsdt} {targetCrypto}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-zinc-400">Provider fee (0.5%)</span><span className="text-orange-400">-{sourceFiatRate.symbol}{bProvFeeEur}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-zinc-400">Commission (1.5%)</span><span className="text-orange-400">-{sourceFiatRate.symbol}{bCommEur}</span></div>
                      <div className="flex justify-between text-xs border-t border-zinc-700/60 pt-1.5"><span className="text-zinc-400">Total fees</span><span className="text-orange-400 font-semibold">-{sourceFiatRate.symbol}{bTotalFee}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-zinc-500">Exchange rate</span><span className="text-zinc-300">1 {targetCrypto} = {sourceFiatRate.symbol}{bCryptoFiatRate.toFixed(2)}</span></div>
                      <div className="flex justify-between text-sm font-bold border-t border-zinc-600 pt-2 mt-1">
                        <span className="text-white">You receive</span>
                        <span className="text-emerald-400">+{bCryptoRcvd} {targetCrypto}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-xs"><span className="text-zinc-400">Crypto amount</span><span className="text-white">{cryptoAmt.toFixed(8)} {source}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-zinc-400">Network fee</span><span className="text-zinc-400">-{cNetFee} {source}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-zinc-400">Provider fee (0.5%)</span><span className="text-orange-400">-{cProvFee} {source}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-zinc-400">Commission (1.5%)</span><span className="text-orange-400">-{cCommFee} {source}</span></div>
                      <div className="flex justify-between text-xs border-t border-zinc-700/60 pt-1.5">
                        <span className="text-zinc-400">Total fees</span>
                        <span className="text-orange-400 font-semibold">-{(parseFloat(cNetFee) + parseFloat(cProvFee) + parseFloat(cCommFee)).toFixed(8)} {source}</span>
                      </div>
                      {destType === "banking" && <div className="flex justify-between text-xs"><span className="text-zinc-500">Exchange rate</span><span className="text-zinc-300">1 {source} = {wdFiatSym}{cryptoFiatRate.toFixed(2)} {withdrawCurrency}</span></div>}
                      <div className="flex justify-between text-sm font-bold border-t border-zinc-600 pt-2 mt-1">
                        <span className="text-white">{destType === "banking" ? `Banking ${withdrawCurrency} credited` : "Net sent to address"}</span>
                        <span className="text-emerald-400">{destType === "banking" ? `+${wdFiatSym}${cNetFiat}` : `${cNetCrypto} ${source}`}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {destType === "external" && !isBanking && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 flex items-start gap-2">
                  <span className="text-orange-400 shrink-0 mt-0.5 text-sm font-bold">⚠</span>
                  <div>
                    <p className="text-[10px] font-semibold text-orange-300 mb-0.5">Irreversible transfer</p>
                    <p className="text-[10px] text-orange-200/80">By confirming, you acknowledge that crypto transfers cannot be reversed. Funds sent to an incorrect address are permanently lost.</p>
                    <p className="text-[10px] text-orange-300 mt-1 font-mono break-all">{extAddress}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setStep("input")} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold rounded-xl py-2.5 cursor-pointer">
                  Edit
                </button>
                <button onClick={executeWithdraw} className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl py-2.5 cursor-pointer flex items-center justify-center gap-2">
                  Confirm Withdrawal <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   ACTIVE DASHBOARD
════════════════════════════════════════════ */
function Dashboard({ account, onUpdateAcc, incomeTxs, onAddTx, checkoutOrders, exchangeTxs, eurTxs, onCheckout, withdrawalTxs, onAddWithdrawal }: {
  account: CryptoAcc; onUpdateAcc: (a: CryptoAcc) => void;
  incomeTxs: IncomeTx[]; onAddTx: (tx: IncomeTx) => void;
  checkoutOrders: CheckoutOrder[]; exchangeTxs: ExchangeTx[]; eurTxs: EurIncomingTx[];
  onCheckout: (o: CheckoutOrder, ex: ExchangeTx, eur: EurIncomingTx) => void;
  withdrawalTxs: WithdrawalTx[]; onAddWithdrawal: (w: WithdrawalTx) => void;
}) {
  const [view, setView] = useState<"balances" | "transactions">("balances");
  const [balTab, setBalTab] = useState<"crypto" | "banking" | "project">("crypto");
  const [txTab, setTxTab] = useState<"income" | "exchange" | "withdrawals" | "checkout">("income");
  const [showTopUp, setShowTopUp] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState<string | false>(false); // false = closed; string = defaultSource
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [selTx, setSelTx] = useState<IncomeTx | null>(null);
  const [selExTx, setSelExTx] = useState<ExchangeTx | null>(null);
  const [selEurTx, setSelEurTx] = useState<EurIncomingTx | null>(null);
  const [selOrder, setSelOrder] = useState<CheckoutOrder | null>(null);
  const [selWd, setSelWd] = useState<WithdrawalTx | null>(null);

  const totalCrypto = Object.entries(account.wallets).reduce((s, [sym, w]) => s + parseFloat(w.balance || "0") * (CRYPTO_USD_RATES[sym] ?? 1) * FIAT_RATES.EUR.rate, 0);
  const projectEur = parseFloat(account.projectEurBalance || "0")
    + parseFloat(account.projectUsdBalance || "0") * FIAT_RATES.EUR.rate
    + parseFloat(account.projectGbpBalance || "0") * (FIAT_RATES.EUR.rate / FIAT_RATES.GBP.rate);
  const bankingEurTotal = parseFloat(account.bankingEurBalance || "0")
    + parseFloat(account.bankingUsdBalance || "0") * FIAT_RATES.EUR.rate
    + parseFloat(account.bankingGbpBalance || "0") * (FIAT_RATES.EUR.rate / FIAT_RATES.GBP.rate);

  const InfoRow = ({ label, value, mono, copy, href }: { label: string; value: string; mono?: boolean; copy?: boolean; href?: string }) => (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-zinc-800/60 last:border-0">
      <span className="text-zinc-500 text-xs shrink-0">{label}</span>
      <span className={`text-xs text-right flex items-center gap-1 ${mono ? "font-mono text-zinc-300 text-[10px]" : "text-zinc-200"}`}>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 hover:underline truncate max-w-[180px]">{value}</a>
        ) : value}
        {copy && <CopyBtn text={value} />}
      </span>
    </div>
  );

  return (
    <div className="flex gap-4">
      {/* Left sidebar */}
      <div className="w-44 shrink-0 space-y-1.5">
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          {[{ id: "balances" as const, I: Wallet, l: "Balances" }, { id: "transactions" as const, I: Activity, l: "Transactions" }].map(item => (
            <button key={item.id} onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm cursor-pointer transition-colors ${view === item.id ? "bg-indigo-600 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"}`}>
              <item.I className="w-4 h-4" />{item.l}
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <p className="text-[9px] text-zinc-600 font-semibold uppercase px-3 py-2 tracking-wider">Actions</p>
          <button onClick={() => setShowTopUp(true)} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-white cursor-pointer transition-colors">
            <ArrowDownLeft className="w-4 h-4 text-emerald-400" />Top Up
          </button>
          <button onClick={() => setShowWithdraw(Object.keys(account.wallets)[0] ?? "banking_eur")} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-white cursor-pointer transition-colors">
            <ArrowUpRight className="w-4 h-4 text-orange-400" />Withdraw
          </button>
          <button onClick={() => setShowCheckout(true)} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-white cursor-pointer transition-colors">
            <ShoppingCart className="w-4 h-4 text-indigo-400" />Checkout
          </button>
        </div>
        <div className="rounded-xl border border-zinc-800 p-3">
          <p className="text-[9px] text-zinc-600 font-semibold uppercase mb-1.5">BVNK Account</p>
          <div className="flex items-center gap-1 mb-1"><CheckCircle2 className="w-3 h-3 text-emerald-400" /><span className="text-[10px] text-emerald-400">Verified</span></div>
          <p className="text-[9px] font-mono text-zinc-600 break-all">{account.bvnkId}</p>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 min-w-0">
        {view === "balances" && (
          <div>
            <div className="rounded-2xl bg-gradient-to-br from-indigo-500/10 to-zinc-900 border border-indigo-500/20 p-5 mb-4">
              <p className="text-xs text-zinc-500 mb-0.5">Total balance (approx.)</p>
              <p className="text-2xl font-bold text-white">≈ €{(totalCrypto + bankingEurTotal + projectEur).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-zinc-500 mb-3">Total balance in EUR</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowTopUp(true)} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg cursor-pointer"><ArrowDownLeft className="w-3.5 h-3.5" />Top up</button>
                <button onClick={() => setShowWithdraw(Object.keys(account.wallets)[0] ?? "banking_eur")} className="flex items-center gap-1.5 border border-zinc-700 text-zinc-300 text-xs px-3 py-1.5 rounded-lg cursor-pointer hover:bg-zinc-800"><ArrowUpRight className="w-3.5 h-3.5" />Send</button>
                <button onClick={() => { setView("transactions"); setTxTab("exchange"); }} className="flex items-center gap-1.5 border border-zinc-700 text-zinc-300 text-xs px-3 py-1.5 rounded-lg cursor-pointer hover:bg-zinc-800"><RefreshCw className="w-3.5 h-3.5" />Exchange</button>
              </div>
            </div>
            <div className="flex gap-1 mb-3 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
              {(["crypto", "banking", "project"] as const).map(t => (
                <button key={t} onClick={() => setBalTab(t)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${balTab === t ? "bg-indigo-600 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
                  {t === "crypto" ? "Crypto" : t === "banking" ? "Banking" : "Project Account"}
                </button>
              ))}
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              {balTab === "crypto" && Object.entries(account.wallets).map(([sym, w]) => (
                <div key={sym} className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/30 cursor-pointer">
                  <div className="flex items-center gap-3"><CIcon sym={sym} size={32} /><div><p className="text-sm font-semibold text-white">{CRYPTO_OPTS.find(c => c.id === sym)?.name ?? sym}</p><p className="text-xs text-zinc-500">{sym}</p></div></div>
                  <div className="text-right"><p className="text-sm font-semibold text-white">{parseFloat(w.balance).toFixed(sym === "BTC" ? 8 : 6)} {sym}</p><p className="text-xs text-zinc-500">≈ €{(parseFloat(w.balance) * (CRYPTO_USD_RATES[sym] ?? 1) * FIAT_RATES.EUR.rate).toFixed(2)}</p></div>
                </div>
              ))}
              {balTab === "banking" && [["EUR", "Euro", parseFloat(account.bankingEurBalance || "0").toLocaleString("en-GB", { minimumFractionDigits: 2 })], ["USD", "US Dollar", parseFloat(account.bankingUsdBalance || "0").toLocaleString("en-GB", { minimumFractionDigits: 2 })], ["GBP", "Pound Sterling", parseFloat(account.bankingGbpBalance || "0").toLocaleString("en-GB", { minimumFractionDigits: 2 })]].map(([sym, name, bal]) => (
                <div key={sym} className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60 last:border-0">
                  <div className="flex items-center gap-3"><CIcon sym={sym} size={32} /><div><p className="text-sm font-semibold text-white">{name}</p><p className="text-xs text-zinc-500">{sym}</p></div></div>
                  <p className="text-sm font-semibold text-white">{bal} {sym}</p>
                </div>
              ))}
              {balTab === "project" && (
                <>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60">
                    <div className="flex items-center gap-3"><CIcon sym="EUR" size={32} /><div><p className="text-sm font-semibold text-white">Project EUR</p><p className="text-xs text-zinc-500">EUR · settled checkout proceeds</p></div></div>
                    <div className="text-right"><p className="text-sm font-semibold text-white">{projectEur.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR</p>{projectEur === 0 && <p className="text-[10px] text-zinc-600">Run a checkout to receive EUR</p>}</div>
                  </div>
                  {([["USD", "Project USD", account.projectUsdBalance ?? "0.00"], ["GBP", "Project GBP", account.projectGbpBalance ?? "0.00"]] as [string, string, string][]).map(([sym, name, bal]) => (
                    <div key={sym} className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60 last:border-0">
                      <div className="flex items-center gap-3"><CIcon sym={sym} size={32} /><div><p className="text-sm font-semibold text-white">{name}</p><p className="text-xs text-zinc-500">{sym}</p></div></div>
                      <p className="text-sm font-semibold text-white">{parseFloat(bal).toLocaleString("en-GB", { minimumFractionDigits: 2 })} {sym}</p>
                    </div>
                  ))}
                </>
              )}
            </div>
            {balTab === "crypto" && CRYPTO_OPTS.filter(c => !Object.keys(account.wallets).includes(c.id)).length > 0 && (
              <button onClick={() => setShowAddWallet(true)}
                className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs text-indigo-400 hover:text-indigo-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl cursor-pointer transition-colors">
                <Plus className="w-3.5 h-3.5" />Create new wallet
              </button>
            )}
          </div>
        )}

        {view === "transactions" && (
          <div>
            <div className="flex gap-1 mb-4 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
              {([
                { id: "income", label: "Income" },
                { id: "exchange", label: "Exchange" },
                { id: "withdrawals", label: "Withdrawals" },
                { id: "checkout", label: "Checkout" },
              ] as const).map(t => (
                <button key={t.id} onClick={() => setTxTab(t.id)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${txTab === t.id ? "bg-indigo-600 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>{t.label}</button>
              ))}
            </div>

            {txTab === "income" && (
              <div>
                {incomeTxs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <ArrowDownLeft className="w-6 h-6 text-zinc-700 mb-2" />
                    <p className="text-xs text-zinc-500">No income transactions yet</p>
                    <button onClick={() => setShowTopUp(true)} className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer">Top up to simulate →</button>
                  </div>
                ) : (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-12 gap-1 px-3 py-2 border-b border-zinc-800 text-[9px] font-semibold text-zinc-500 uppercase tracking-wider">
                      <div className="col-span-2">Transfer ID</div><div className="col-span-2">Customer ID</div><div className="col-span-2">Created</div><div className="col-span-2">Updated</div><div className="col-span-1">Crypto</div><div className="col-span-1">Status</div><div className="col-span-2">Amount & Fee</div>
                    </div>
                    {incomeTxs.map(tx => (
                      <div key={tx.id + tx.status} onClick={() => setSelTx(selTx?.id === tx.id ? null : tx)}
                        className={`grid grid-cols-12 gap-1 px-3 py-3 border-b border-zinc-800/60 last:border-0 cursor-pointer transition-colors items-center ${selTx?.id === tx.id ? "bg-indigo-500/10" : "hover:bg-zinc-800/30"}`}>
                        <div className="col-span-2"><p className="text-[10px] font-mono text-zinc-400 truncate">{tx.transferId ?? tx.id.slice(0, 10)}</p></div>
                        <div className="col-span-2"><p className="text-[10px] font-mono text-zinc-500 truncate">{tx.customerId ?? "—"}</p></div>
                        <div className="col-span-2"><p className="text-[10px] text-zinc-500">{fmtDate(tx.detectedAt)}</p></div>
                        <div className="col-span-2"><p className="text-[10px] text-zinc-500">{fmtDate(tx.updatedAt ?? tx.confirmedAt ?? tx.detectedAt)}</p></div>
                        <div className="col-span-1"><p className="text-xs text-zinc-300">{tx.cryptoCurrency}</p></div>
                        <div className="col-span-1"><SBadge s={tx.status} /></div>
                        <div className="col-span-2">
                          <p className="text-xs font-semibold text-emerald-400">+{tx.receivedCryptoAmount}</p>
                          <p className="text-[10px] text-zinc-500">{tx.checkout_payment_id ? `fee: ${tx.networkFee ?? tx.providerFee}` : "no fee"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selTx && (
                  <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-xs text-zinc-500 mb-0.5">T1 — Crypto Incoming</p>
                        <p className="text-xl font-bold text-white">+{selTx.receivedCryptoAmount} {selTx.cryptoCurrency}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <SBadge s={selTx.status} />
                        <button onClick={() => setSelTx(null)}><X className="w-4 h-4 text-zinc-500 hover:text-white cursor-pointer" /></button>
                      </div>
                    </div>
                    {/* Network fee (checkout only) */}
                    {selTx.checkout_payment_id && (
                      <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-3 mb-3 space-y-1.5">
                        <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Network Info</p>
                        <div className="flex justify-between text-xs"><span className="text-zinc-400">Network fee</span><span className="text-zinc-300">{selTx.networkFee ?? selTx.providerFee} {selTx.cryptoCurrency}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-zinc-400">Note</span><span className="text-zinc-500">Fee &amp; commission settled via T3</span></div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-x-6">
                      {[
                        { l: "Transfer ID", v: selTx.transferId ?? "—", mono: true, copy: true },
                        { l: "Customer ID", v: selTx.customerId ?? "—", mono: true },
                        { l: "Transaction Type", v: selTx.transactionType },
                        { l: "Provider Payment ID", v: selTx.providerPaymentId, mono: true, copy: true },
                        { l: "Requested Amount", v: `${selTx.requestedCryptoAmount} ${selTx.cryptoCurrency}` },
                        { l: "Received Amount", v: `${selTx.receivedCryptoAmount} ${selTx.cryptoCurrency}` },
                        { l: "Credited Amount", v: `${selTx.creditedCryptoAmount} ${selTx.cryptoCurrency}` },
                        { l: "Network fee", v: `${selTx.networkFee ?? selTx.providerFee} ${selTx.cryptoCurrency}` },
                        { l: "Network", v: `${selTx.network} (${selTx.networkDisplay})` },
                        { l: "Wallet ID", v: selTx.bvnkWalletId, mono: true },
                        { l: "Tx Hash", v: selTx.transactionHash, mono: true, copy: true, href: explorerTxUrl(selTx.network, selTx.transactionHash) },
                        { l: "Sender Address", v: selTx.senderAddress, mono: true, copy: true, href: explorerAddrUrl(selTx.network, selTx.senderAddress) },
                        { l: "Recipient Address", v: selTx.recipientAddress, mono: true, copy: true, href: explorerAddrUrl(selTx.network, selTx.recipientAddress) },
                        { l: "Created At", v: fmtDate(selTx.detectedAt) },
                        ...(selTx.confirmedAt ? [{ l: "Confirmed At", v: fmtDate(selTx.confirmedAt) }] : []),
                      ].map(row => <InfoRow key={row.l} label={row.l} value={row.v} mono={row.mono} copy={row.copy} href={(row as any).href} />)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {txTab === "exchange" && (
              <div>
                {exchangeTxs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <ArrowLeftRight className="w-6 h-6 text-zinc-700 mb-2" />
                    <p className="text-xs text-zinc-500">No exchange transactions yet</p>
                    <button onClick={() => setShowCheckout(true)} className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer">Create a checkout to generate one →</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                      <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-zinc-800 text-[9px] font-semibold text-zinc-500 uppercase tracking-wider">
                        <div className="col-span-2">Status</div><div className="col-span-3">Ref</div><div className="col-span-2">Debit</div><div className="col-span-2">Rate</div><div className="col-span-3">Settled EUR</div>
                      </div>
                      {exchangeTxs.map(tx => (
                        <div key={tx.id} onClick={() => setSelExTx(selExTx?.id === tx.id ? null : tx)}
                          className={`grid grid-cols-12 gap-2 px-4 py-3 border-b border-zinc-800/60 last:border-0 cursor-pointer transition-colors items-center ${selExTx?.id === tx.id ? "bg-indigo-500/10" : "hover:bg-zinc-800/30"}`}>
                          <div className="col-span-2"><SBadge s={tx.status} /></div>
                          <div className="col-span-3"><p className="text-[9px] font-mono text-zinc-500 truncate">{tx.checkout_payment_id}</p></div>
                          <div className="col-span-2"><p className="text-xs text-orange-400">-{tx.crypto_debit_amount}</p><p className="text-[10px] text-zinc-500">{tx.source_currency}</p></div>
                          <div className="col-span-2"><p className="text-[10px] text-zinc-400">{parseFloat(tx.provider_exchange_rate).toFixed(4)}</p></div>
                          <div className="col-span-3"><p className="text-xs font-semibold text-emerald-400">€{tx.net_settlement_amount}</p><p className="text-[10px] text-zinc-500">net</p></div>
                        </div>
                      ))}
                    </div>
                    {selExTx && (
                      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div><p className="text-xs text-zinc-500 mb-0.5">T2 — Crypto Withdrawal with FX</p><p className="text-lg font-bold text-white">-{selExTx.crypto_debit_amount} {selExTx.source_currency} → €{selExTx.net_settlement_amount}</p></div>
                          <div className="flex gap-2"><SBadge s={selExTx.status} /><button onClick={() => setSelExTx(null)}><X className="w-4 h-4 text-zinc-500 hover:text-white cursor-pointer" /></button></div>
                        </div>
                        {/* Exchange rate markup panel */}
                        <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-3 mb-3 space-y-1.5">
                          <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Exchange Rate Details</p>
                          <div className="flex justify-between text-xs"><span className="text-zinc-400">Market rate</span><span className="text-white">1 {selExTx.source_currency} = {parseFloat(selExTx.provider_exchange_rate).toFixed(4)} EUR</span></div>
                          <div className="flex justify-between text-xs"><span className="text-zinc-400">Customer rate</span><span className="text-white font-semibold">1 {selExTx.source_currency} = {parseFloat(selExTx.customer_exchange_rate).toFixed(4)} EUR</span></div>
                          <div className="flex justify-between text-xs"><span className="text-zinc-400">Markup</span><span className="text-orange-400">−{((parseFloat(selExTx.provider_exchange_rate) - parseFloat(selExTx.customer_exchange_rate)) / parseFloat(selExTx.provider_exchange_rate) * 100).toFixed(2)}%</span></div>
                          <div className="flex justify-between text-xs"><span className="text-zinc-400">Network fee</span><span className="text-zinc-400">{selExTx.network_fee_usdt} {selExTx.source_currency}</span></div>
                          <div className="flex justify-between text-xs border-t border-zinc-700 pt-1"><span className="text-zinc-200 font-bold">Gross EUR converted</span><span className="text-emerald-400 font-bold">€{selExTx.gross_converted_eur}</span></div>
                        </div>
                        <div className="mb-2">
                          {selExTx.t1_reference && (() => { const t1 = incomeTxs.find(t => t.id === selExTx.t1_reference); return t1 ? (
                            <button onClick={() => { setTxTab("income"); setSelTx(t1); setSelExTx(null); }}
                              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 bg-indigo-500/10 rounded-lg px-3 py-1.5 cursor-pointer transition-colors">
                              <ArrowDownLeft className="w-3.5 h-3.5" />View T1 · Crypto Incoming — {selExTx.t1_reference.slice(0, 16)}…
                            </button>
                          ) : null; })()}
                        </div>
                        <div className="grid grid-cols-2 gap-x-6">
                          {[
                            { l: "Transaction Type", v: selExTx.transactionType },
                            { l: "T1 Reference (crypto)", v: selExTx.t1_reference, mono: true, copy: true },
                            { l: "Checkout Payment ID", v: selExTx.checkout_payment_id, mono: true, copy: true },
                            { l: "Source Wallet ID", v: selExTx.source_wallet_id, mono: true },
                            { l: "Crypto Debit Amount", v: `${selExTx.crypto_debit_amount} ${selExTx.source_currency}` },
                            { l: "Source / Target", v: `${selExTx.source_currency} → ${selExTx.target_currency}` },
                            { l: "Market Exchange Rate", v: `1 ${selExTx.source_currency} = ${parseFloat(selExTx.provider_exchange_rate).toFixed(4)} EUR` },
                            { l: "Customer Exchange Rate", v: `1 ${selExTx.source_currency} = ${parseFloat(selExTx.customer_exchange_rate).toFixed(4)} EUR (−${((parseFloat(selExTx.provider_exchange_rate) - parseFloat(selExTx.customer_exchange_rate)) / parseFloat(selExTx.provider_exchange_rate) * 100).toFixed(2)}%)` },
                            { l: "Gross Converted EUR", v: `€${selExTx.gross_converted_eur}` },
                            { l: "Network Fee", v: `${selExTx.network_fee_usdt} ${selExTx.source_currency}` },
                            { l: "Net Settlement Amount", v: `€${selExTx.net_settlement_amount}` },
                            { l: "Transfer ID", v: selExTx.provider_transfer_id, mono: true, copy: true },
                            { l: "Payout ID", v: selExTx.provider_payout_id, mono: true, copy: true },
                            { l: "Destination IBAN", v: selExTx.destination_iban, mono: true, copy: true },
                            { l: "Allocation Reference", v: selExTx.allocation_reference, mono: true },
                            { l: "Created At", v: fmtDate(selExTx.created_at) },
                          ].map(row => <InfoRow key={row.l} label={row.l} value={row.v} mono={row.mono} copy={row.copy} />)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {txTab === "withdrawals" && (
              <div>
                {withdrawalTxs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-28 text-center">
                    <ArrowUpRight className="w-6 h-6 text-zinc-700 mb-2" /><p className="text-xs text-zinc-500">No withdrawals yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                      <div className="grid grid-cols-12 gap-1 px-3 py-2 border-b border-zinc-800 text-[9px] font-semibold text-zinc-500 uppercase tracking-wider">
                        <div className="col-span-2">Customer ID</div><div className="col-span-2">Transfer ID</div><div className="col-span-1">PID</div><div className="col-span-1">Type</div><div className="col-span-2">Method</div><div className="col-span-1">Status</div><div className="col-span-2">Amount & Fee</div><div className="col-span-1">Ccy</div>
                      </div>
                      {withdrawalTxs.map(wd => (
                        <div key={wd.id} onClick={() => setSelWd(selWd?.id === wd.id ? null : wd)}
                          className={`grid grid-cols-12 gap-1 px-3 py-3 border-b border-zinc-800/60 last:border-0 cursor-pointer transition-colors items-center ${selWd?.id === wd.id ? "bg-indigo-500/10" : "hover:bg-zinc-800/30"}`}>
                          <div className="col-span-2"><p className="text-[10px] font-mono text-zinc-500 truncate">{wd.customerId}</p></div>
                          <div className="col-span-2"><p className="text-[10px] font-mono text-zinc-400 truncate">{wd.transferId}</p></div>
                          <div className="col-span-1"><p className="text-[10px] text-zinc-500 truncate">{wd.pid}</p></div>
                          <div className="col-span-1"><p className="text-[10px] text-zinc-400">WITHDRAWAL</p></div>
                          <div className="col-span-2"><p className="text-[10px] text-zinc-300 truncate">{wd.paymentMethod}</p></div>
                          <div className="col-span-1"><SBadge s={wd.status} /></div>
                          <div className="col-span-2">
                            <p className="text-xs font-semibold text-white">€{wd.eurAmount}</p>
                            <p className="text-[10px] text-zinc-500">fee: €{wd.totalFeeEur}</p>
                          </div>
                          <div className="col-span-1"><p className="text-xs text-zinc-400">{wd.targetCurrency}</p></div>
                        </div>
                      ))}
                    </div>

                    {selWd && (
                      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div><p className="text-xs text-zinc-500 mb-0.5">EUR → Crypto Withdrawal</p><p className="text-lg font-bold text-white">€{selWd.eurAmount} → {selWd.netCryptoAmount} {selWd.targetCurrency}</p></div>
                          <button onClick={() => setSelWd(null)}><X className="w-4 h-4 text-zinc-500 hover:text-white cursor-pointer" /></button>
                        </div>
                        <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-3 space-y-1.5">
                          <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Fee Breakdown</p>
                          <div className="flex justify-between text-xs"><span className="text-zinc-400">Amount (EUR)</span><span className="text-white">€{selWd.eurAmount}</span></div>
                          <div className="flex justify-between text-xs"><span className="text-zinc-400">Network fee</span><span className="text-zinc-400">{selWd.networkFeeUsdt} {selWd.targetCurrency}</span></div>
                          <div className="flex justify-between text-xs"><span className="text-zinc-400">Fee ({(PROVIDER_FEE_RATE * 100).toFixed(1)}%)</span><span className="text-orange-400">-€{selWd.providerFeeEur}</span></div>
                          <div className="flex justify-between text-xs"><span className="text-zinc-400">Commission ({selWd.commissionRate})</span><span className="text-orange-400">-€{selWd.commissionEur}</span></div>
                          <div className="flex justify-between text-xs border-t border-zinc-700 pt-1"><span className="text-zinc-500">Total fees</span><span className="text-orange-400">-€{selWd.totalFeeEur}</span></div>
                          <div className="flex justify-between text-sm border-t border-zinc-600 pt-2"><span className="text-zinc-200 font-bold">Crypto received</span><span className="text-emerald-400 font-bold">+{selWd.netCryptoAmount} {selWd.targetCurrency}</span></div>
                        </div>
                        {selWd.t1_reference && (() => { const t1 = incomeTxs.find(t => t.id === selWd.t1_reference); return t1 ? (
                          <button onClick={() => { setTxTab("income"); setSelTx(t1); setSelWd(null); }}
                            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 bg-indigo-500/10 rounded-lg px-3 py-1.5 cursor-pointer transition-colors mb-2">
                            <ArrowDownLeft className="w-3.5 h-3.5" />View T1 · Crypto Incoming — {selWd.t1_reference.slice(0, 16)}…
                          </button>
                        ) : null; })()}
                        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-3 space-y-0">
                          {[
                            { l: "Withdrawal ID", v: selWd.id, mono: true, copy: true },
                            { l: "Customer ID", v: selWd.customerId, mono: true, copy: true },
                            { l: "Transfer ID", v: selWd.transferId, mono: true, copy: true },
                            { l: "PID", v: selWd.pid, mono: true },
                            { l: "Payment Method", v: selWd.paymentMethod },
                            { l: "Target Network", v: selWd.targetNetwork },
                            { l: "Deposit Address", v: selWd.depositAddress, mono: true, copy: true, href: selWd.direction !== "CRYPTO_TO_EUR" ? explorerAddrUrl(selWd.targetNetwork, selWd.depositAddress) : undefined },
                            ...(selWd.externalAddress ? [{ l: "External Wallet", v: selWd.externalAddress, mono: true, copy: true, href: explorerAddrUrl(selWd.targetNetwork, selWd.externalAddress) }] : []),
                            ...(selWd.txHash ? [{ l: "Tx Hash", v: selWd.txHash, mono: true, copy: true, href: explorerTxUrl(selWd.targetNetwork, selWd.txHash) }] : []),
                            { l: "Conversion Rate", v: `1 ${selWd.targetCurrency} = ${selWd.conversionRate}` },
                            { l: "Source Account", v: selWd.sourceBankAccount },
                            { l: "T1 Reference", v: selWd.t1_reference ?? "—", mono: true },
                            { l: "Status", v: selWd.status },
                            { l: "Created", v: selWd.createdAt },
                          ].map(row => <InfoRow key={row.l} label={row.l} value={row.v} mono={(row as any).mono} copy={(row as any).copy} href={(row as any).href} />)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {txTab === "checkout" && (
              <div>
                {checkoutOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <ShoppingCart className="w-6 h-6 text-zinc-700 mb-2" />
                    <p className="text-xs text-zinc-500">No checkout transactions yet</p>
                    <button onClick={() => setShowCheckout(true)} className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer">Create a test checkout →</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                      <div className="grid grid-cols-12 gap-1 px-3 py-2 border-b border-zinc-800 text-[9px] font-semibold text-zinc-500 uppercase tracking-wider">
                        <div className="col-span-2">Customer ID</div><div className="col-span-2">ID</div><div className="col-span-1">PID</div><div className="col-span-1">Type</div><div className="col-span-2">Method</div><div className="col-span-1">Status</div><div className="col-span-2">Amount & Fee</div><div className="col-span-1">Ccy</div>
                      </div>
                      {checkoutOrders.map(ord => (
                        <div key={ord.checkout_payment_id} onClick={() => setSelOrder(selOrder?.checkout_payment_id === ord.checkout_payment_id ? null : ord)}
                          className={`grid grid-cols-12 gap-1 px-3 py-3 border-b border-zinc-800/60 last:border-0 cursor-pointer transition-colors items-center ${selOrder?.checkout_payment_id === ord.checkout_payment_id ? "bg-indigo-500/10" : "hover:bg-zinc-800/30"}`}>
                          <div className="col-span-2"><p className="text-[10px] font-mono text-zinc-500 truncate">{ord.customerId ?? "—"}</p></div>
                          <div className="col-span-2"><p className="text-[10px] font-mono text-zinc-400 truncate">{ord.checkout_payment_id}</p></div>
                          <div className="col-span-1"><p className="text-[10px] text-zinc-500 truncate">{ord.pid ?? "—"}</p></div>
                          <div className="col-span-1"><p className="text-[10px] text-zinc-400">{ord.type ?? "CHECKOUT"}</p></div>
                          <div className="col-span-2"><p className="text-[10px] text-zinc-300 truncate">{ord.paymentMethod ?? ord.selected_crypto_asset}</p></div>
                          <div className="col-span-1"><SBadge s={ord.payment_status} /></div>
                          <div className="col-span-2">
                            <p className="text-xs font-semibold text-white">€{ord.order_amount}</p>
                            <p className="text-[10px] text-zinc-500">fee: €{ord.total_fee_eur ?? "—"}</p>
                          </div>
                          <div className="col-span-1"><p className="text-xs text-zinc-400">{ord.order_currency}</p></div>
                        </div>
                      ))}
                    </div>

                    {selOrder && (() => {
                      const t1 = incomeTxs.find(t => t.id === selOrder.t1_id);
                      const t2 = exchangeTxs.find(t => t.id === selOrder.t2_id);
                      const t3 = eurTxs.find(t => t.id === selOrder.t3_id);
                      return (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div><p className="text-xs text-zinc-500 mb-0.5">Checkout Parent Operation</p><p className="text-lg font-bold text-white">€{selOrder.order_amount} {selOrder.order_currency}</p></div>
                            <button onClick={() => setSelOrder(null)}><X className="w-4 h-4 text-zinc-500 hover:text-white cursor-pointer" /></button>
                          </div>
                          {/* Fee breakdown */}
                          {selOrder.total_fee_eur && (
                            <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-3 mb-3 space-y-1">
                              <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Fee Breakdown (T3 EUR)</p>
                              <div className="flex justify-between text-xs"><span className="text-zinc-400">Invoice amount</span><span className="text-white font-semibold">€{selOrder.order_amount}</span></div>
                              <div className="flex justify-between text-xs"><span className="text-zinc-400">Network fee</span><span className="text-zinc-400">{selOrder.network_fee} {selOrder.selected_crypto_asset}</span></div>
                              <div className="flex justify-between text-xs"><span className="text-zinc-400">Fee ({(PROVIDER_FEE_RATE * 100).toFixed(1)}%)</span><span className="text-orange-400">-€{selOrder.provider_fee_eur}</span></div>
                              <div className="flex justify-between text-xs"><span className="text-zinc-400">Commission ({selOrder.commission_rate})</span><span className="text-orange-400">-€{selOrder.commission_eur}</span></div>
                              <div className="flex justify-between text-sm border-t border-zinc-600 pt-1 mt-1"><span className="text-zinc-200 font-bold">Project receives</span><span className="text-emerald-400 font-bold">€{(parseFloat(selOrder.order_amount) - parseFloat(selOrder.total_fee_eur)).toFixed(2)}</span></div>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-x-6">
                            {[
                              { l: "Invoice ID", v: selOrder.checkout_payment_id, mono: true, copy: true },
                              { l: "Project Reference", v: selOrder.project_reference ?? "—", mono: true, copy: true },
                              { l: "Customer ID", v: selOrder.customerId ?? "—", mono: true },
                              { l: "PID", v: selOrder.pid ?? "—", mono: true },
                              { l: "Type", v: selOrder.type ?? "CHECKOUT" },
                              { l: "Payment Method", v: selOrder.paymentMethod ?? selOrder.selected_crypto_asset },
                              { l: "Crypto Operation ID", v: selOrder.crypto_operation_id, mono: true },
                              { l: "Order Reference", v: selOrder.order_reference, copy: true },
                              { l: "Order Amount", v: `€${selOrder.order_amount} ${selOrder.order_currency}` },
                              { l: "Network Fee", v: `${selOrder.network_fee} ${selOrder.selected_crypto_asset}` },
                              { l: "Fee (0.5%)", v: `-€${selOrder.provider_fee_eur}` },
                              { l: "Commission (1.5%)", v: `-€${selOrder.commission_eur}` },
                              { l: "Selected Crypto", v: selOrder.selected_crypto_asset },
                              { l: "Selected Network", v: selOrder.selected_network },
                              { l: "Payment Status", v: selOrder.payment_status },
                              { l: "Settlement Status", v: selOrder.settlement_status },
                              { l: "Project IBAN", v: selOrder.project_iban, mono: true, copy: true },
                              { l: "Allocation Reference", v: selOrder.project_allocation_reference },
                              { l: "T1 Reference", v: selOrder.t1_id, mono: true },
                              { l: "T2 Reference", v: selOrder.t2_id, mono: true },
                              { l: "T3 Reference", v: selOrder.t3_id, mono: true },
                              { l: "Created At", v: fmtDate(selOrder.created_at) },
                            ].map(row => <InfoRow key={row.l} label={row.l} value={row.v} mono={row.mono} copy={row.copy} />)}
                          </div>
                          <div className="border-t border-zinc-800 pt-3 space-y-2">
                            <p className="text-[10px] font-semibold text-zinc-500 uppercase">Linked Transactions</p>
                            {[
                              { label: "T1 · Crypto Incoming", tx: t1, detail: t1 ? `+${t1.receivedCryptoAmount} ${t1.cryptoCurrency} · ${t1.status}` : "—", color: "emerald" },
                              { label: "T2 · FX Exchange", tx: t2, detail: t2 ? `${t2.crypto_debit_amount} ${t2.source_currency} → €${t2.net_settlement_amount} · ${t2.status}` : "—", color: "blue" },
                              { label: "T3 · EUR Incoming", tx: t3, detail: t3 ? `€${t3.actual_received_amount} to Project · ${t3.status}` : "—", color: "indigo" },
                            ].map(item => (
                              <button key={item.label} onClick={() => {
                                if (item.label.includes("T1") && t1) { setView("transactions"); setTxTab("income"); setSelTx(t1); setSelOrder(null); }
                                if (item.label.includes("T2") && t2) { setView("transactions"); setTxTab("exchange"); setSelExTx(t2); setSelOrder(null); }
                                if (item.label.includes("T3") && t3) { setSelEurTx(t3); }
                              }}
                                className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-${item.color}-500/20 bg-${item.color}-500/5 hover:bg-${item.color}-500/10 cursor-pointer text-left`}>
                                <ArrowRight className={`w-3.5 h-3.5 text-${item.color}-400 shrink-0`} />
                                <div className="flex-1 min-w-0">
                                  <p className={`text-xs font-semibold text-${item.color}-400`}>{item.label}</p>
                                  <p className="text-[10px] text-zinc-400 truncate">{item.detail}</p>
                                </div>
                                <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />
                              </button>
                            ))}
                          </div>
                          {selEurTx && (
                            <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-3">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-white">T3 · EUR Incoming detail</p>
                                <button onClick={() => setSelEurTx(null)}><X className="w-3.5 h-3.5 text-zinc-500 cursor-pointer" /></button>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4">
                                {[
                                  { l: "Transaction Type", v: selEurTx.transactionType },
                                  { l: "Checkout Payment ID", v: selEurTx.checkout_payment_id, mono: true, copy: true },
                                  { l: "T2 Reference (FX)", v: selEurTx.t2_reference, mono: true, copy: true },
                                  { l: "Currency", v: selEurTx.currency },
                                  { l: "Actual Received Amount", v: `€${selEurTx.actual_received_amount} EUR` },
                                  { l: "Total Fee Deducted (in T2)", v: `€${selEurTx.total_fee_deducted ?? "—"}` },
                                  { l: "Sender Name", v: selEurTx.sender_name },
                                  { l: "Sender Account", v: selEurTx.sender_account, mono: true },
                                  { l: "Beneficiary IBAN", v: selEurTx.beneficiary_iban, mono: true, copy: true },
                                  { l: "Bank Reference", v: selEurTx.bank_reference },
                                  { l: "Bank Transaction ID", v: selEurTx.bank_transaction_id, mono: true },
                                  { l: "Project ID", v: selEurTx.project_id },
                                  { l: "Balance Posting ID", v: selEurTx.project_balance_posting_id, mono: true },
                                  { l: "Status", v: selEurTx.status },
                                  { l: "Posted At", v: fmtDate(selEurTx.posted_at) },
                                ].map(row => <InfoRow key={row.l} label={row.l} value={row.v} mono={row.mono} copy={row.copy} />)}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showTopUp && <TopUpPopup account={account} onUpdateAcc={onUpdateAcc} onAddTx={onAddTx} onClose={() => setShowTopUp(false)} />}
      {showCheckout && (
        <CheckoutPopup
          account={account}
          onUpdateAcc={onUpdateAcc}
          onAddIncomeTx={onAddTx}
          onAddCheckout={(o, ex, eur) => { onCheckout(o, ex, eur); setView("transactions"); setTxTab("checkout"); }}
          onClose={() => setShowCheckout(false)}
        />
      )}
      {showWithdraw !== false && (
        <UnifiedWithdrawPopup
          account={account}
          onUpdateAcc={onUpdateAcc}
          onAddTx={onAddTx}
          onAddWithdrawal={(w) => { onAddWithdrawal(w); setView("transactions"); setTxTab("withdrawals"); }}
          defaultSource={showWithdraw}
          onClose={() => setShowWithdraw(false)}
        />
      )}
      {showAddWallet && (
        <AddWalletPopup
          account={account}
          onUpdateAcc={onUpdateAcc}
          onClose={() => setShowAddWallet(false)}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════ */
export default function CryptoPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [state, setState] = useState<CState>(() => {
    try { return localStorage.getItem("bvnk_acc_v3") ? "active" : "banner"; } catch { return "banner"; }
  });
  const [account, setAccount] = useState<CryptoAcc | null>(() => {
    try { const s = localStorage.getItem("bvnk_acc_v3"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [incomeTxs, setIncomeTxs] = useState<IncomeTx[]>(() => {
    try { return JSON.parse(localStorage.getItem("bvnk_inc_v3") || "[]"); } catch { return []; }
  });
  const [checkoutOrders, setCheckoutOrders] = useState<CheckoutOrder[]>(() => {
    try { return JSON.parse(localStorage.getItem("bvnk_checkout_v3") || "[]"); } catch { return []; }
  });
  const [exchangeTxs, setExchangeTxs] = useState<ExchangeTx[]>(() => {
    try { return JSON.parse(localStorage.getItem("bvnk_exchange_v3") || "[]"); } catch { return []; }
  });
  const [eurTxs, setEurTxs] = useState<EurIncomingTx[]>(() => {
    try { return JSON.parse(localStorage.getItem("bvnk_eur_v3") || "[]"); } catch { return []; }
  });
  const [withdrawalTxs, setWithdrawalTxs] = useState<WithdrawalTx[]>(() => {
    try { return JSON.parse(localStorage.getItem("bvnk_wd_v3") || "[]"); } catch { return []; }
  });

  useEffect(() => {
    fetch("/api/auth/me").then(async r => {
      if (r.status === 401) { router.push("/login"); return; }
      const d = await r.json(); setUser(d.user);
    });
  }, [router]);

  function persist(acc: CryptoAcc) {
    setAccount(acc); try { localStorage.setItem("bvnk_acc_v3", JSON.stringify(acc)); } catch {}
  }
  function persistTxs(txs: IncomeTx[]) {
    setIncomeTxs(txs); try { localStorage.setItem("bvnk_inc_v3", JSON.stringify(txs)); } catch {}
  }

  function handleDone(acc: CryptoAcc) { persist(acc); setState("active"); }
  function handleUpdateAcc(acc: CryptoAcc) { persist(acc); }
  function handleAddTx(tx: IncomeTx) {
    setIncomeTxs(prev => {
      const updated = [tx, ...prev.filter(t => t.id !== tx.id)];
      persistTxs(updated); return updated;
    });
  }
  function handleAddCheckout(o: CheckoutOrder, ex: ExchangeTx, eur: EurIncomingTx) {
    setCheckoutOrders(prev => { const u = [o, ...prev.filter(x => x.checkout_payment_id !== o.checkout_payment_id)]; try { localStorage.setItem("bvnk_checkout_v3", JSON.stringify(u)); } catch {} return u; });
    setExchangeTxs(prev => { const u = [ex, ...prev.filter(x => x.id !== ex.id)]; try { localStorage.setItem("bvnk_exchange_v3", JSON.stringify(u)); } catch {} return u; });
    setEurTxs(prev => { const u = [eur, ...prev.filter(x => x.id !== eur.id)]; try { localStorage.setItem("bvnk_eur_v3", JSON.stringify(u)); } catch {} return u; });
  }
  function handleAddWithdrawal(w: WithdrawalTx) {
    setWithdrawalTxs(prev => { const u = [w, ...prev.filter(x => x.id !== w.id)]; try { localStorage.setItem("bvnk_wd_v3", JSON.stringify(u)); } catch {} return u; });
  }
  function reset() {
    setState("banner"); setAccount(null); setIncomeTxs([]); setCheckoutOrders([]); setExchangeTxs([]); setEurTxs([]); setWithdrawalTxs([]);
    try {
      localStorage.removeItem("bvnk_acc_v3"); localStorage.removeItem("bvnk_inc_v3");
      localStorage.removeItem("bvnk_checkout_v3"); localStorage.removeItem("bvnk_exchange_v3");
      localStorage.removeItem("bvnk_eur_v3"); localStorage.removeItem("bvnk_wd_v3");
    } catch {}
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <DashNav user={user} />
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-bold text-white">Crypto (BVNK Embedded)</h1>
            <p className="text-xs text-zinc-500">PayDo × BVNK Embedded Model</p>
          </div>
          {state === "active" && (
            <button onClick={reset} className="text-xs text-zinc-500 hover:text-red-400 cursor-pointer border border-zinc-800 hover:border-red-500/30 px-2 py-1 rounded-lg transition-colors">Reset demo</button>
          )}
        </div>
        {state === "banner" && <Banner onActivate={() => setState("onboarding")} />}
        {state === "onboarding" && <Onboarding onDone={handleDone} />}
        {state === "active" && account && (
          <Dashboard
            account={account}
            onUpdateAcc={handleUpdateAcc}
            incomeTxs={incomeTxs}
            onAddTx={handleAddTx}
            checkoutOrders={checkoutOrders}
            exchangeTxs={exchangeTxs}
            eurTxs={eurTxs}
            onCheckout={handleAddCheckout}
            withdrawalTxs={withdrawalTxs}
            onAddWithdrawal={handleAddWithdrawal}
          />
        )}
      </div>
    </div>
  );
}
